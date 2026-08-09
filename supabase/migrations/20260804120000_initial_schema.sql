-- MaxPoll initial schema.
-- Reference: docs/RULES.md. Corrections applied: docs/RULES.md A3, A4, A6.

create extension if not exists pg_trgm;

-- ============================================================ tables

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique not null,
  display_name text not null,
  bio text,
  dob date not null,                    -- 18+ gate; NEVER exposed publicly
  instagram text, x_handle text, snapchat text,
  created_at timestamptz default now()
);

create table spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  created_by uuid references profiles,
  member_count int default 0,           -- denormalised
  is_verified boolean default false,
  created_at timestamptz default now()
);

create table space_members (
  space_id uuid references spaces on delete cascade,
  user_id uuid references profiles on delete cascade,
  joined_at timestamptz default now(),
  primary key (space_id, user_id)
);

create table polls (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  space_id uuid references spaces on delete cascade,
  created_by uuid references profiles,
  title text not null,
  adjective_id int,
  subject_type text not null check (subject_type in ('person','thing')),
  category text not null,
  is_private boolean default false,
  expires_at timestamptz,
  vote_count int default 0,             -- denormalised — never count(*)
  option_count int default 0,           -- denormalised
  options_locked boolean default false, -- true once vote_count >= 10
  status text default 'live' check (status in ('live','closed','removed')),
  og_version int default 1,             -- bumped on leader change
  created_at timestamptz default now()
);
create index on polls (space_id, status, created_at desc);
-- 3-polls-per-week limit is counted off this
create index on polls (created_by, created_at desc);

create table options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls on delete cascade,
  label text not null,
  -- Generated, so it can never drift from label. Immutable expression, which is
  -- what a stored generated column requires.
  label_norm text generated always as (
    regexp_replace(lower(btrim(label)), '[^a-z0-9 ]', '', 'g')
  ) stored,
  added_by uuid references profiles,
  vote_count int default 0,             -- denormalised — never count(*)
  -- RULES.md: no `rank` column. Rank is row_number() at read time, always
  -- correct and never drifts. Only the movement snapshot persists.
  rank_snapshot int,
  snapshot_at timestamptz,
  merged_into uuid references options,
  hidden boolean default false,
  created_at timestamptz default now()
);
create index on options using gin (label_norm gin_trgm_ops);
create index on options (poll_id, vote_count desc);

create table votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls on delete cascade,
  option_id uuid references options on delete cascade,
  user_id uuid references profiles on delete set null,  -- nulled on account delete
  device_id text not null,
  created_at timestamptz default now()
);
-- The real guard: one vote per person per poll.
create unique index votes_poll_user_uniq on votes (poll_id, user_id) where user_id is not null;
-- RULES.md: device_id is a velocity SIGNAL, not a constraint. A unique index
-- here would block two people sharing a laptop, which is common on a campus.
create index on votes (poll_id, device_id);
create index on votes (option_id);

-- The single source of access truth. Every payment rail writes here and nowhere
-- else, so votes_read_entitled below never has to know how the money arrived.
create table entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  poll_id uuid references polls on delete cascade,      -- null = subscription
  kind text not null check (kind in ('poll_unlock','sub_monthly')),
  expires_at timestamptz,
  -- RULES.md — money. 'comp' hand-grants access (a friend, a bug apology) without
  -- inventing a fake payment.
  source text not null check (source in ('manual_upi','razorpay','comp')),
  payment_ref text,                     -- UTR for manual_upi, payment id for razorpay
  created_at timestamptz default now()
);
-- Idempotency. A UTR and a Razorpay payment id could theoretically collide as
-- strings, so the source is part of the key.
create unique index entitlements_payment_uniq
  on entitlements (source, payment_ref) where payment_ref is not null;
create index on entitlements (user_id, poll_id);

-- The manual UPI ledger — RULES.md — money. orders records the payment, entitlements
-- records the access; verify_order() is the only bridge between them.
create table orders (
  id uuid primary key default gen_random_uuid(),
  -- Shown to the payer and sent as the UPI `tr` field, so it must stay short and
  -- alphanumeric — a UUID does not fit. Defaulted, so it is never client-authored.
  ref text unique not null default 'MP' || upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  user_id uuid not null references profiles on delete cascade,
  poll_id uuid references polls on delete cascade,      -- null for the 30-day pass
  kind text not null check (kind in ('poll_unlock','pass_30d')),
  -- Generated, not passed in. The admin panel shows this as "expected", and it is
  -- the ONLY amount check a manual pipeline has — a UPI intent's `am` is editable
  -- in several apps and a static QR carries no amount at all. A client that could
  -- write this could show the admin "₹9 expected" on a ₹99 order.
  -- Mirrored by PRICES in lib/payments.ts; change both or neither.
  amount_paise int generated always as (
    case kind when 'pass_30d' then 9900 else 900 end
  ) stored,
  utr text,                             -- 12-digit reference, submitted by the payer
  contact text,                         -- optional; user_id is the real identity
  status text not null default 'pending'
    check (status in ('pending','submitted','verified','rejected')),
  admin_note text,                      -- the only thing a rejected payer gets back
  created_at timestamptz default now(),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references profiles
);
-- One UTR unlocks exactly once. Without this, one person pays ₹9 and forwards the
-- reference number to fifty friends.
create unique index orders_utr_uniq on orders (upper(btrim(utr))) where utr is not null;
-- One open order per user per thing — stops the admin queue filling with junk.
-- `nulls not distinct` matters: poll_id is null for the pass, and the default
-- unique semantics would treat every one of those nulls as a different row.
create unique index orders_open_uniq on orders (user_id, poll_id, kind)
  nulls not distinct where status in ('pending','submitted');
create index on orders (status, created_at);   -- the admin queue's only query

create table badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  type text not null check (type in ('top_creator','added_won')),
  poll_id uuid references polls on delete cascade,
  space_id uuid references spaces on delete cascade,
  period text,                          -- '2026-W31' — weekly, so it stays winnable
  earned_at timestamptz default now()
);
create index on badges (user_id);

create table follows (
  follower_id uuid references profiles on delete cascade,
  following_id uuid references profiles on delete cascade,
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index on follows (following_id);

create table activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  type text not null,
  payload jsonb not null,
  read boolean default false,
  created_at timestamptz default now()
);
create index on activity (user_id, read, created_at desc);

create table messages (
  id bigserial primary key,
  poll_id uuid references polls on delete cascade,
  user_id uuid references profiles on delete set null,
  anon_handle text,                     -- 'owl4713' when posted anonymously
  body text not null,
  hidden boolean default false,
  created_at timestamptz default now()
);
create index on messages (poll_id, id desc);

create table reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  reporter_id uuid references profiles on delete set null,
  reason text,
  created_at timestamptz default now()
);
create index on reports (target_type, target_id);

-- ============================================================ functions

-- Vote and increment the denormalised counters in one transaction.
-- security definer so it can write past RLS; search_path pinned because a
-- definer function without it is a privilege-escalation hole (RULES.md).
create or replace function cast_vote(p_poll uuid, p_option uuid, p_device text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into votes (poll_id, option_id, device_id, user_id)
  values (p_poll, p_option, p_device, p_user);

  update options set vote_count = vote_count + 1 where id = p_option;
  update polls   set vote_count = vote_count + 1 where id = p_poll;

  update polls set options_locked = true
    where id = p_poll and vote_count >= 10 and options_locked = false;
exception when unique_violation then
  raise exception 'ALREADY_VOTED';
end $$;

revoke execute on function cast_vote(uuid, uuid, text, uuid) from public;
grant  execute on function cast_vote(uuid, uuid, text, uuid) to authenticated;

-- Typeahead dedupe. Returns rank alongside the count, because "#2 · 82 votes" is
-- what actually stops someone adding a duplicate.
create or replace function search_options(p_poll uuid, p_query text)
returns table (id uuid, label text, vote_count int, rank bigint)
language sql
stable
-- invoker, not definer: options are publicly readable, so RLS applying here is
-- correct and this needs no elevated privilege.
set search_path = public, pg_temp
as $$
  with ranked as (
    select o.id, o.label, o.vote_count, o.label_norm,
           row_number() over (order by o.vote_count desc, o.created_at) as rank
    from options o
    where o.poll_id = p_poll and o.hidden = false and o.merged_into is null
  )
  select r.id, r.label, r.vote_count, r.rank
  from ranked r
  where similarity(r.label_norm, regexp_replace(lower(btrim(p_query)), '[^a-z0-9 ]', '', 'g')) > 0.3
  order by similarity(r.label_norm, regexp_replace(lower(btrim(p_query)), '[^a-z0-9 ]', '', 'g')) desc,
           r.vote_count desc
  limit 5;
$$;

revoke execute on function search_options(uuid, text) from public;
grant  execute on function search_options(uuid, text) to anon, authenticated;

-- Approve a manual UPI payment: flip the order and grant access in ONE
-- transaction. Half of this happening is someone paying and not getting in, or
-- getting in without a ledger row. Both are worse than failing outright.
--
-- security definer with a pinned search_path, same reasoning as cast_vote
-- (RULES.md). Execute is revoked from every client role — only service_role
-- reaches this, from the admin panel. There is deliberately no client path.
create or replace function verify_order(p_order uuid, p_admin uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare o orders;
begin
  select * into o from orders
   where id = p_order and status = 'submitted'
   for update;
  if not found then raise exception 'NOT_PENDING'; end if;

  insert into entitlements (user_id, poll_id, kind, source, payment_ref, expires_at)
  values (
    o.user_id,
    o.poll_id,
    case o.kind when 'pass_30d' then 'sub_monthly' else 'poll_unlock' end,
    'manual_upi',
    upper(btrim(o.utr)),
    -- RULES.md — money: the ₹99 tier is a 30-day pass, not a subscription. No
    -- mandate, no auto-renew, and votes_read_entitled already expires it.
    case o.kind when 'pass_30d' then now() + interval '30 days' end
  );

  update orders
     set status = 'verified', decided_at = now(), decided_by = p_admin
   where id = p_order;
end $$;

revoke execute on function verify_order(uuid, uuid) from public, anon, authenticated;

-- ============================================================ RLS
-- Enabled on every table. A table with RLS on and no matching policy denies
-- everything to anon/authenticated; service_role bypasses RLS entirely.

alter table profiles      enable row level security;
alter table spaces        enable row level security;
alter table space_members enable row level security;
alter table polls         enable row level security;
alter table options       enable row level security;
alter table votes         enable row level security;
alter table entitlements  enable row level security;
alter table orders        enable row level security;
alter table badges        enable row level security;
alter table follows       enable row level security;
alter table activity      enable row level security;
alter table messages      enable row level security;
alter table reports       enable row level security;

-- profiles: public read, self write. dob is never selected by the app.
create policy profiles_read   on profiles for select using (true);
create policy profiles_insert on profiles for insert with check (auth.uid() = id);
create policy profiles_update on profiles for update using (auth.uid() = id);

-- spaces
create policy spaces_read   on spaces for select using (true);
create policy spaces_insert on spaces for insert with check (auth.uid() = created_by);
create policy spaces_update on spaces for update using (auth.uid() = created_by);

create policy space_members_read  on space_members for select using (true);
create policy space_members_join  on space_members for insert with check (auth.uid() = user_id);
create policy space_members_leave on space_members for delete using (auth.uid() = user_id);

-- polls: private polls are creator-only. Removed polls stay readable on purpose —
-- the UI has to distinguish "was removed" from "never existed" (RULES.md),
-- and it can't do that if RLS returns zero rows for both. Feeds filter on status.
create policy polls_read on polls
  for select using (is_private = false or auth.uid() = created_by);
create policy polls_insert on polls for insert with check (auth.uid() = created_by);
create policy polls_update on polls for update using (auth.uid() = created_by);

-- options: anyone signed in can add one; only the poll owner edits
create policy options_read   on options for select using (hidden = false);
create policy options_insert on options for insert with check (auth.uid() = added_by);
create policy options_update on options for update
  using (exists (select 1 from polls p where p.id = options.poll_id and p.created_by = auth.uid()));

-- votes: insert freely, but SELECT is the paid layer.
-- You always see your own vote. Everyone else's needs an entitlement.
create policy votes_insert on votes for insert with check (auth.uid() = user_id);
create policy votes_read_own on votes for select using (auth.uid() = user_id);
create policy votes_read_entitled on votes for select using (
  exists (
    select 1 from entitlements e
    where e.user_id = auth.uid()
      and (e.poll_id = votes.poll_id or e.kind = 'sub_monthly')
      and (e.expires_at is null or e.expires_at > now())
  )
);

-- entitlements: self read only. Writes are service_role (webhook + verify), which
-- bypasses RLS, so there is deliberately no insert/update policy here.
create policy entitlements_read on entitlements for select using (auth.uid() = user_id);

-- orders: you can create your own and attach a UTR to it. You can never approve
-- one, and you can never see anyone else's.
--
-- Note what is NOT here: no admin select policy. The admin panel reads through
-- the secret key, which bypasses RLS entirely — so other people's orders aren't
-- protected by a policy that has to be written correctly, they're unreachable
-- because no policy exposes them at all.
create policy orders_insert   on orders for insert with check (auth.uid() = user_id);
create policy orders_read_own on orders for select using (auth.uid() = user_id);
-- Scoped to 'pending' on purpose: once a UTR is submitted the row is the admin's.
-- A client can attach a reference number. It can never mark itself verified, and
-- `utr is not null` stops an empty submission clogging the queue.
create policy orders_submit_utr on orders for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'submitted' and utr is not null);

-- RLS decides WHICH rows you may touch; it says nothing about which COLUMNS. The
-- policy above would otherwise let a payer flip their own pending ₹99 order to
-- kind='poll_unlock' and pay ₹9 for it. Column grants are the right tool.
revoke update on orders from anon, authenticated;
grant  update (utr, contact, status, submitted_at) on orders to authenticated;
-- Same reasoning at insert: kind and poll_id are chosen once, and everything a
-- payer must not author (status, admin_note, decided_*) is left out.
revoke insert on orders from anon, authenticated;
grant  insert (user_id, poll_id, kind, contact) on orders to authenticated;

create policy badges_read on badges for select using (true);

create policy follows_read   on follows for select using (true);
create policy follows_insert on follows for insert with check (auth.uid() = follower_id);
create policy follows_delete on follows for delete using (auth.uid() = follower_id);

-- activity is private to its owner
create policy activity_read   on activity for select using (auth.uid() = user_id);
create policy activity_update on activity for update using (auth.uid() = user_id);

create policy messages_read   on messages for select using (hidden = false);
create policy messages_insert on messages for insert with check (auth.uid() = user_id);

-- reports: write-only from the client. Nobody reads them back.
create policy reports_insert on reports for insert with check (auth.uid() = reporter_id);
