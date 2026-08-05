-- DECISIONS D2b said RLS picks rows, not columns, and applied column grants to
-- `orders`. It applies to four more tables, and all four were verified live before
-- this was written — as the poll's own creator, with a real session:
--
--   PATCH /rest/v1/polls?id=eq.<own>   {vote_count: 99999}          -> 204, persisted
--   PATCH /rest/v1/polls?id=eq.<own>   {options_locked:false,...}   -> 204
--   PATCH /rest/v1/options?id=eq.<own> {vote_count: 4242}           -> 204, persisted
--   POST  /rest/v1/spaces  {is_verified: true}                      -> 201, tick granted
--   POST  /rest/v1/polls   {...}                                    -> 201, straight
--                                          past create_poll and its 3-per-week limit
--
-- The first three mean a creator could fabricate the entire result of their own
-- poll, since the board reads exactly these denormalised counters — and could
-- un-hide an option that three reports had auto-hidden. The fourth forges the tick
-- 03 §I reserves for real institutions.
--
-- Nothing in the application writes these columns: no poll-edit screen, no
-- profile-edit screen, and `create_poll` / `create_space` / `cast_vote` /
-- `merge_options` / `snapshot_ranks` are all `security definer`, as are both
-- `bump_*` count triggers. That was traced before writing a single revoke — the
-- one way to get this wrong is to revoke a grant something quietly depends on.
--
-- ⚠️ Applied AFTER the code that calls create_space() is deployed. Revoking first
-- is how chat broke on production for two minutes last session.

revoke insert, update on polls    from anon, authenticated;  -- create_poll() only
revoke update            on options  from anon, authenticated;  -- add_option()/merge_options()
revoke insert, update on spaces   from anon, authenticated;  -- create_space() only
revoke update            on profiles from anon, authenticated;  -- insert at onboarding, then fixed

-- activity is written only by the paths that cause it: cast_vote(), snapshot_ranks()
-- and the follows trigger. Verified live that a client could otherwise write any
-- notification into anyone's feed:
--
--   POST /rest/v1/activity {user_id: <victim>, payload:{poll_title:"Tap to claim ₹500"}}
--     -> 201, and the victim's feed renders it
--
-- That same request answers 403 when sent with `Prefer: return=representation`,
-- because the read-back trips activity_read. The write still lands. A probe that
-- believes the status code reports "safe" while the row sits in the table.
revoke insert, update on activity from anon, authenticated;

-- The one write a client still makes: marking your own notifications read. Column
-- grant plus the surviving activity_update policy (auth.uid() = user_id) — the
-- D2b shape, rows from the policy and columns from the grant.
grant update (read) on activity to authenticated;

-- Dead policies, dropped rather than kept.
--
-- This differs from the messages/options/votes inserts deliberately, and the rule
-- is: keep a policy when a legitimate client path exists but is routed through an
-- RPC — it documents intent, and a careless future `grant` then still fails closed.
-- Drop it when the operation should never come from a client at all, which is every
-- policy below. Leaving `polls_update` in place would say creators may edit polls,
-- and the next person to add a grant would believe it.
drop policy if exists polls_update    on polls;
drop policy if exists options_update  on options;
drop policy if exists spaces_update   on spaces;
drop policy if exists profiles_update on profiles;
drop policy if exists activity_insert on activity;

-- DELETE is deliberately untouched. `authenticated` holds the grant on most tables,
-- but the only DELETE policies that exist are follows_delete and
-- space_members_leave — both self-scoped and both wanted. Everywhere else RLS
-- default-denies, so a revoke here would change nothing observable.
