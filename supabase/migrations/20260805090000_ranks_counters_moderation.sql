-- Phase 5/6: rank snapshots, the denormalised counters nothing was maintaining,
-- moderation, and the server-side poll limit.
-- Reference: docs/02-architecture.md, DECISIONS A3 / A6.

-- ============================================================ rank snapshots

-- Movement badges (▲2 / ▼1) need a previous rank to diff against. The board
-- handler cannot write it: `options` is creator-writable only under RLS, so an
-- anonymous board request would silently never persist a snapshot and no badge
-- would ever appear.
--
-- security definer fixes that, and doing the ranking in SQL collapses N updates
-- into one round trip on the hottest route in the product.
--
-- The 60s guard lives INSIDE the function so it holds no matter who calls it:
-- the board route is cached at s-maxage=4, so without it a badge would flicker
-- in and out every 4 seconds while the design calls for persistent badges (A3).
create or replace function snapshot_ranks(p_poll uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from options
     where poll_id = p_poll and hidden = false and merged_into is null
       and (snapshot_at is null or now() - snapshot_at > interval '60 seconds')
  ) then
    update options o
       set rank_snapshot = r.rn, snapshot_at = now()
      from (
        select id, row_number() over (order by vote_count desc, created_at) as rn
          from options
         where poll_id = p_poll and hidden = false and merged_into is null
      ) r
     where o.id = r.id;
  end if;
end $$;

revoke execute on function snapshot_ranks(uuid) from public;
grant  execute on function snapshot_ranks(uuid) to anon, authenticated;

-- ============================================================ denormalised counters

-- spaces.member_count and polls.option_count are denormalised so no screen ever
-- runs count(*). Nothing was maintaining them, so both sat at 0 forever — which
-- would have quietly broken the 20-member results gate and every "28 options"
-- chip in the product.

create or replace function bump_member_count()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    update spaces set member_count = member_count + 1 where id = new.space_id;
  else
    update spaces set member_count = greatest(0, member_count - 1) where id = old.space_id;
  end if;
  return null;
end $$;

create trigger space_members_count
  after insert or delete on space_members
  for each row execute function bump_member_count();

create or replace function bump_option_count()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    update polls set option_count = option_count + 1 where id = new.poll_id;
  elsif tg_op = 'DELETE' then
    update polls set option_count = greatest(0, option_count - 1) where id = old.poll_id;
  -- Hiding or merging an option removes it from the board, so it must leave the
  -- count too, or "28 options" disagrees with 26 visible rows.
  elsif (new.hidden is distinct from old.hidden)
     or (new.merged_into is distinct from old.merged_into) then
    update polls set option_count = (
      select count(*) from options
       where poll_id = new.poll_id and hidden = false and merged_into is null
    ) where id = new.poll_id;
  end if;
  return null;
end $$;

create trigger options_count
  after insert or delete or update on options
  for each row execute function bump_option_count();

-- ============================================================ moderation

-- Merge, not delete — 03-ux-flows F. Deleting an option with votes silently
-- changes every percentage on the board; merging preserves the total.
create or replace function merge_options(p_from uuid, p_into uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_poll uuid; v_owner uuid; v_count int;
begin
  select o.poll_id, p.created_by, o.vote_count
    into v_poll, v_owner, v_count
    from options o join polls p on p.id = o.poll_id
   where o.id = p_from
   for update;

  if not found then raise exception 'NO_SUCH_OPTION'; end if;
  if v_owner is distinct from auth.uid() then raise exception 'NOT_OWNER'; end if;

  if (select poll_id from options where id = p_into) is distinct from v_poll then
    raise exception 'DIFFERENT_POLL';
  end if;
  if p_from = p_into then raise exception 'SAME_OPTION'; end if;

  -- Move the votes themselves, not just the counter, or the vote rows would
  -- still point at a hidden option and voter names would go missing from the
  -- merged row for people who paid to see them.
  update votes set option_id = p_into where option_id = p_from;
  update options set vote_count = vote_count + v_count where id = p_into;
  update options set vote_count = 0, merged_into = p_into, hidden = true where id = p_from;
end $$;

revoke execute on function merge_options(uuid, uuid) from public, anon;
grant  execute on function merge_options(uuid, uuid) to authenticated;

-- reports.target_id was uuid, but messages.id is bigserial — chat messages could
-- never have been reported. Widened to text so one table covers every target
-- type. Safe: the table is empty, and bigserial is correct for messages (ordered
-- `id desc` pagination and the chat's `?since=` cursor both depend on it).
alter table reports alter column target_id type text using target_id::text;

-- Report → auto-hide at 3. Counted with count(*) deliberately: reports are rare
-- and the volume here is nil, unlike votes.
create or replace function report_target(p_type text, p_id text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count int;
begin
  if auth.uid() is null then raise exception 'SIGNED_OUT'; end if;
  if p_type not in ('option','message','poll') then raise exception 'BAD_TARGET'; end if;

  insert into reports (target_type, target_id, reporter_id, reason)
  values (p_type, p_id, auth.uid(), left(coalesce(p_reason, ''), 300))
  on conflict do nothing;

  select count(distinct reporter_id) into v_count
    from reports where target_type = p_type and target_id = p_id;

  if v_count >= 3 then
    if p_type = 'option' then
      update options set hidden = true where id = p_id::uuid;
    elsif p_type = 'message' then
      update messages set hidden = true where id = p_id::bigint;
    elsif p_type = 'poll' then
      update polls set status = 'removed' where id = p_id::uuid;
    end if;
  end if;
end $$;

revoke execute on function report_target(text, text, text) from public, anon;
grant  execute on function report_target(text, text, text) to authenticated;

-- One report per person per target, so three reports means three people.
create unique index reports_once_uniq on reports (target_type, target_id, reporter_id)
  where reporter_id is not null;

-- ============================================================ poll creation limit

-- 3 polls/week, enforced server-side (build plan 7.1). In a function rather than
-- the app so two rapid submits cannot both pass the check — the row lock and the
-- insert are in one transaction.
create or replace function create_poll(
  p_slug text, p_space uuid, p_title text, p_subject_type text,
  p_category text, p_expires timestamptz, p_options text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_recent int; v_poll uuid; v_label text;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  if p_subject_type not in ('person','thing') then raise exception 'BAD_SUBJECT'; end if;
  if array_length(p_options, 1) is null or array_length(p_options, 1) < 2 then
    raise exception 'TOO_FEW_OPTIONS';
  end if;
  if array_length(p_options, 1) > 10 then raise exception 'TOO_MANY_OPTIONS'; end if;

  select count(*) into v_recent
    from polls
   where created_by = v_user and created_at > now() - interval '7 days';
  if v_recent >= 3 then raise exception 'WEEKLY_LIMIT'; end if;

  insert into polls (slug, space_id, created_by, title, subject_type, category, expires_at)
  values (p_slug, p_space, v_user, p_title, p_subject_type, p_category, p_expires)
  returning id into v_poll;

  foreach v_label in array p_options loop
    if btrim(v_label) <> '' then
      insert into options (poll_id, label, added_by) values (v_poll, btrim(v_label), v_user);
    end if;
  end loop;

  -- Creating a poll joins its Space; the trigger keeps member_count honest.
  if p_space is not null then
    insert into space_members (space_id, user_id) values (p_space, v_user)
    on conflict do nothing;
  end if;

  return v_poll;
end $$;

revoke execute on function create_poll(text, uuid, text, text, text, timestamptz, text[]) from public, anon;
grant  execute on function create_poll(text, uuid, text, text, text, timestamptz, text[]) to authenticated;

-- ============================================================ activity

-- Activity rows are written by the paths that cause them — no cron, per CLAUDE.md.
create policy activity_insert on activity for insert with check (true);
