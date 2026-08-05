-- The activity feed has a spec (03 §H), CSS (04 §5.11) and a finished component,
-- and nothing has ever written a row to it except `new_follower`. This migration
-- adds the writers, and it adds them in the database because the next migration
-- revokes the client's INSERT on `activity` — a signed-in user could otherwise
-- write any notification into anyone's feed, which was verified live:
--
--   POST /rest/v1/activity {user_id: <victim>, payload: {poll_title: "Tap to claim ₹500"}}
--     -> 201, and the victim's feed renders it
--
-- ⚠️ That request answers 403 *if* you send `Prefer: return=representation`, because
-- the read-back trips `activity_read`. The write still lands. A probe that trusts
-- the status code reports "safe" while the row is in the table — see LEARNINGS.
--
-- Everything here is additive. Applying it changes no existing behaviour, so it is
-- safe to run against production before the new application code ships.

-- ============================================================ dedupe indexes

-- One same_as_you row per person per poll. There is already one vote per person
-- per poll, so this is belt-and-braces rather than load-bearing.
create unique index if not exists activity_same_uniq
  on activity (user_id, ((payload->>'poll_id'))) where type = 'same_as_you';

-- One climb notification per person per option per rank, so a leader that
-- oscillates between #2 and #3 cannot notify the same people every 60 seconds.
create unique index if not exists activity_climb_uniq
  on activity (user_id, ((payload->>'option_id')), ((payload->>'rank')))
  where type = 'option_climbed';

-- ============================================================ same_as_you

-- Written on the vote, one row, for the voter only.
--
-- The obvious design — store a count and fan out an update to every co-voter on
-- each vote — costs N row writes on the hottest path in the product. So the row
-- stores no count: `same_as_you_names()` computes it with the names at read time,
-- in the one query the /activity page already runs. The count is then always
-- right, and voting stays a single insert.
create or replace function cast_vote(p_poll uuid, p_option uuid, p_device text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_poll polls;
begin
  -- The session wins wherever there is one. p_user survives only for the paths
  -- that legitimately have no session — supabase/seed.sql and the admin scripts,
  -- which connect as the owner. See DECISIONS D2c.
  v_user := coalesce(auth.uid(), p_user);
  if v_user is null then raise exception 'SIGNED_OUT'; end if;

  select * into v_poll from polls where id = p_poll;
  if not found or v_poll.status <> 'live' then raise exception 'CLOSED'; end if;
  if v_poll.expires_at is not null and v_poll.expires_at <= now() then
    raise exception 'CLOSED';
  end if;

  if not exists (
    select 1 from options where id = p_option and poll_id = p_poll and hidden = false
  ) then
    raise exception 'BAD_OPTION';
  end if;

  insert into votes (poll_id, option_id, device_id, user_id)
  values (p_poll, p_option, p_device, v_user);

  update options set vote_count = vote_count + 1 where id = p_option;
  update polls   set vote_count = vote_count + 1 where id = p_poll;

  update polls set options_locked = true
    where id = p_poll and vote_count >= 10 and options_locked = false;

  insert into activity (user_id, type, payload)
  values (v_user, 'same_as_you', jsonb_build_object(
    'poll_id', p_poll, 'poll_slug', v_poll.slug,
    'poll_title', v_poll.title, 'option_id', p_option))
  on conflict do nothing;
exception when unique_violation then
  raise exception 'ALREADY_VOTED';
end $$;

revoke execute on function cast_vote(uuid, uuid, text, uuid) from public, anon;
grant  execute on function cast_vote(uuid, uuid, text, uuid) to authenticated;

-- ============================================================ the two free names

-- 03 §H: two real names visible, the rest blurred — "two real names showing proves
-- it isn't a tease; a fully blurred list reads as fake". So exactly two names cross
-- the wire, and the cap is here rather than in a query the client controls.
--
-- Two things make this safe, and it is the most security-sensitive function in the
-- project after verify_order:
--   1. `mine.user_id = auth.uid()` — you only ever learn about a poll you voted in,
--      on the option you personally chose. A caller who never voted gets no rows.
--   2. `limit 2` is inside the function. There is no limit or offset parameter, so
--      the names cannot be paginated out of it one pair at a time.
create or replace function same_as_you_names(p_polls uuid[])
returns table (poll_id uuid, total int, names text[])
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    mine.poll_id,
    (select count(*)::int
       from votes v
      where v.poll_id = mine.poll_id and v.option_id = mine.option_id
        and v.user_id is not null and v.user_id <> mine.user_id),
    (select coalesce(array_agg(p.display_name), '{}'::text[])
       from (
         select pr.display_name
           from votes v2
           join profiles pr on pr.id = v2.user_id
          where v2.poll_id = mine.poll_id and v2.option_id = mine.option_id
            and v2.user_id <> mine.user_id
          order by v2.created_at
          limit 2
       ) p)
  from votes mine
  where mine.user_id = auth.uid()
    and mine.poll_id = any(p_polls);
$$;

revoke execute on function same_as_you_names(uuid[]) from public, anon;
grant  execute on function same_as_you_names(uuid[]) to authenticated;

-- ============================================================ option_climbed

-- snapshot_ranks already carries a 60s guard, so the notification inherits the
-- rate limit rather than needing its own. The insert is a CTE of the same
-- statement that rewrites the snapshot, so both read one consistent set of ranks.
create or replace function snapshot_ranks(p_poll uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_slug text;
begin
  if not exists (
    select 1 from options
     where poll_id = p_poll and hidden = false and merged_into is null
       and (snapshot_at is null or now() - snapshot_at > interval '60 seconds')
  ) then
    return;
  end if;

  select slug into v_slug from polls where id = p_poll;

  with ranked as (
    select id, label, rank_snapshot,
           row_number() over (order by vote_count desc, created_at) as rn
      from options
     where poll_id = p_poll and hidden = false and merged_into is null
  ),
  -- Top 3 only. An option moving from #47 to #46 is not news, and notifying it
  -- would put a row in every voter's feed every minute.
  -- ponytail: widen if the feed looks sparse — far easier than un-spamming.
  climbers as (
    select * from ranked where rank_snapshot is not null and rn < rank_snapshot and rn <= 3
  ),
  notified as (
    insert into activity (user_id, type, payload)
    select distinct v.user_id, 'option_climbed',
           jsonb_build_object('poll_id', p_poll, 'poll_slug', v_slug,
                              'option_id', c.id, 'label', c.label, 'rank', c.rn)
      from climbers c
      join votes v on v.option_id = c.id
     where v.user_id is not null
    on conflict do nothing
    returning 1
  )
  update options o set rank_snapshot = r.rn, snapshot_at = now()
    from ranked r where o.id = r.id;
end $$;

revoke execute on function snapshot_ranks(uuid) from public;
grant  execute on function snapshot_ranks(uuid) to anon, authenticated;

-- ============================================================ new_follower

-- Was an insert in app/u/[handle]/actions.ts. Moved here so the next migration can
-- revoke the client's INSERT on activity.
--
-- ⚠️ `security definer` is not decoration: a trigger function runs as the invoking
-- role, so a plain one would start failing the moment that grant is revoked.
create or replace function trg_follow_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into activity (user_id, type, payload)
  select new.following_id, 'new_follower',
         jsonb_build_object('handle', p.handle, 'display_name', p.display_name)
    from profiles p where p.id = new.follower_id
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists follow_activity on follows;
create trigger follow_activity after insert on follows
  for each row execute function trg_follow_activity();

-- ============================================================ create_space

-- Spaces were inserted straight from the client, which meant two things: no limit
-- on how many a person could create, and `is_verified` was whatever the client
-- sent. That tick is rendered on /s/[slug] and doc 03 §I calls it the mark of a
-- real institution. Verified live: an insert with `is_verified: true` returned 201
-- with the tick granted.
create or replace function create_space(p_slug text, p_name text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_recent int; v_space uuid;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'BAD_NAME'; end if;
  -- 03 §I: description is required — "thin descriptions are how fakes get through".
  if char_length(btrim(coalesce(p_description, ''))) < 10 then
    raise exception 'BAD_DESCRIPTION';
  end if;

  select count(*) into v_recent
    from spaces
   where created_by = v_user and created_at > now() - interval '7 days';
  if v_recent >= 3 then raise exception 'WEEKLY_LIMIT'; end if;

  -- is_verified is never taken from the caller. It is granted by us or not at all.
  insert into spaces (slug, name, description, created_by, is_verified)
  values (p_slug, left(btrim(p_name), 60), left(btrim(p_description), 300), v_user, false)
  returning id into v_space;

  insert into space_members (space_id, user_id) values (v_space, v_user)
  on conflict do nothing;

  return v_space;
end $$;

revoke execute on function create_space(text, text, text) from public, anon;
grant  execute on function create_space(text, text, text) to authenticated;
