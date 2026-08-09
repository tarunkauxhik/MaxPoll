-- Owner deletes, and changing your vote.
--
-- Three changes, all owner-facing:
--   1. delete_poll() loses its "no votes yet" guard — the creator asked for an
--      unconditional delete. See DECISIONS D16 for what that reverses.
--   2. delete_space() is new. Refused once the Space holds a poll somebody else
--      made, so one tap can never destroy another person's board.
--   3. change_vote() is new. One vote per person per poll still holds; this
--      moves it rather than adding one.
--
-- Idempotent. Safe to run against production before the app code ships: nothing
-- here is called by the code that is live now.

-- ============================================================ delete_poll

-- The vote guard is gone.
--
-- It existed on the reasoning that once strangers have voted the board is their
-- record as much as the creator's, and "stop voting" is the honest action. The
-- owner overruled that: a person who put their name on a question must be able
-- to take it down, and a poll about named people is exactly where that matters
-- most. The cost is named in the confirmation screen instead of enforced here.
--
-- Ownership is still checked against auth.uid() and nothing else. `polls` has no
-- delete policy and does not get one — this function stays the only path.
create or replace function delete_poll(p_poll uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_owner uuid;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;

  select created_by into v_owner from polls where id = p_poll for update;

  if v_owner is null then raise exception 'NO_POLL'; end if;
  if v_owner <> v_user then raise exception 'NOT_OWNER'; end if;

  -- Cascades to options, votes, messages, entitlements and activity.
  delete from polls where id = p_poll;
end $$;

revoke execute on function delete_poll(uuid) from public, anon;
grant  execute on function delete_poll(uuid) to authenticated;

-- ============================================================ delete_space

-- `polls.space_id` is `on delete cascade`, so deleting a Space deletes every
-- poll inside it and every vote on those polls. That blast radius is the whole
-- design problem here, and the answer is to bound it rather than to warn about
-- it: a Space is deletable while it is empty, or while everything in it is the
-- owner's own. The moment somebody else has posted, their poll is not the
-- Space owner's to destroy.
--
-- Admins are not routed through this. /admin uses the service role, which
-- bypasses RLS and this function both — that is deliberate and is the only
-- unbounded delete in the product.
create or replace function delete_space(p_space uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user   uuid := auth.uid();
  v_owner  uuid;
  v_others int;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;

  select created_by into v_owner from spaces where id = p_space for update;

  if v_owner is null then raise exception 'NO_SPACE'; end if;
  if v_owner <> v_user then raise exception 'NOT_OWNER'; end if;

  select count(*) into v_others
    from polls
   where space_id = p_space
     and created_by is distinct from v_user
     and status <> 'removed';

  if v_others > 0 then raise exception 'HAS_OTHERS_POLLS'; end if;

  -- Cascades to space_members and to the owner's own polls beneath it.
  delete from spaces where id = p_space;
end $$;

revoke execute on function delete_space(uuid) from public, anon;
grant  execute on function delete_space(uuid) to authenticated;

-- ============================================================ change_vote

-- Move an existing vote to another option.
--
-- Not a second `cast_vote`: `votes_poll_user_uniq` means one row per person per
-- poll, and that constraint is the guard, so a change is an UPDATE of that row
-- plus a −1/+1 on the two option counters. `polls.vote_count` does not move —
-- it is still one vote, and treating a change as a new vote would inflate every
-- total on the site.
--
-- Same identity rule as everything else here: `auth.uid()`, never an argument.
-- DECISIONS D2c — cast_vote took a p_user once and let anyone vote as anyone.
create or replace function change_vote(p_poll uuid, p_option uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_poll polls;
  v_old  uuid;
begin
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

  select option_id into v_old
    from votes where poll_id = p_poll and user_id = v_user
    for update;

  if v_old is null then raise exception 'NO_VOTE'; end if;
  if v_old = p_option then return; end if;   -- already there; not an error

  update votes set option_id = p_option
   where poll_id = p_poll and user_id = v_user;

  update options set vote_count = greatest(vote_count - 1, 0) where id = v_old;
  update options set vote_count = vote_count + 1              where id = p_option;

  -- `same_as_you` activity is not touched: same_as_you_names() reads the votes
  -- table directly, so it follows the move on its own.
end $$;

revoke execute on function change_vote(uuid, uuid) from public, anon;
grant  execute on function change_vote(uuid, uuid) to authenticated;
