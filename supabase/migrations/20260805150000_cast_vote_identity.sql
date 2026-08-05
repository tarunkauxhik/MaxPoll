-- cast_vote trusted the caller's word about who was voting.
--
-- Found while revoking direct INSERT on messages/options, and it is the same
-- defect one table over — except this one is the core of the product.
--
-- The function is `security definer`, so RLS never sees the insert, and it wrote
-- `user_id = p_user` straight from a parameter. `votes_insert` (auth.uid() =
-- user_id) looked like the guard and never ran. Any authenticated user could:
--
--   rpc/cast_vote { p_poll, p_option, p_device, p_user: <anyone's uuid> }
--
-- and the vote landed under that person's id with the counters incremented.
-- `profiles` is public-read by design, so the uuids are free. One signed-in
-- account could therefore drive any leaderboard to any result, bounded only by
-- the number of registered users — the unique index stops a *second* vote per
-- victim, not the first. Verified live before writing this.
--
-- Three fixes, all inside the same function:
--   1. the session decides who voted, never the parameter
--   2. the option must belong to the poll — otherwise a vote on poll A could
--      increment an option of poll B, and counters stop matching rows
--   3. no voting on a closed or expired poll
--
-- Plus the door: INSERT revoked, so cast_vote is the only way a vote appears.

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
  -- which connect as the owner or with the secret key. A signed-in caller can no
  -- longer choose whose vote this is, which is the entire point.
  v_user := coalesce(auth.uid(), p_user);
  if v_user is null then raise exception 'SIGNED_OUT'; end if;

  select * into v_poll from polls where id = p_poll;
  if not found or v_poll.status <> 'live' then raise exception 'CLOSED'; end if;
  if v_poll.expires_at is not null and v_poll.expires_at <= now() then
    raise exception 'CLOSED';
  end if;

  -- Without this, `p_option` from another poll increments that poll's option
  -- while this poll's total moves, and sum(options) = polls.vote_count — the
  -- invariant Gate 4 checks — quietly stops being true.
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
exception when unique_violation then
  raise exception 'ALREADY_VOTED';
end $$;

revoke execute on function cast_vote(uuid, uuid, text, uuid) from public, anon;
grant  execute on function cast_vote(uuid, uuid, text, uuid) to authenticated;

-- A direct insert bypassed every line above and left the denormalised counters
-- untouched, so the vote existed but never appeared on the board. cast_vote is
-- now the only door. service_role keeps its grant: /settings account deletion
-- and the gate scripts write votes with the secret key.
revoke insert on votes from anon, authenticated;
