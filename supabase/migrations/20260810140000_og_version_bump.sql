-- ============================================================ og_version
--
-- `og_version` has been a dead column since the initial schema. It defaults to
-- 1, `app/p/[slug]/page.tsx` versions the og:image URL with it, and *nothing
-- ever incremented it*. So an edited poll kept advertising itself with the card
-- it was created with: same `/og/<slug>?v=1` URL, so every scraper that already
-- had that URL kept serving the render it took on day one.
--
-- A trigger rather than a line inside `update_poll()`, because the card is
-- changed by four different writers — `update_poll`, `add_option`, the admin
-- hide/merge path, and the nightly `close_expired_polls` cron. A bump in one of
-- them leaves the other three stale, and the trigger is the one place all four
-- already route through.
--
-- What deliberately does NOT bump it: `vote_count`. It moves on every single
-- vote, and the og route is CDN-cached per URL — a new URL per vote would mean
-- a fresh Satori render on every share. The card is refreshed by
-- `s-maxage=60` for that; `og_version` is for the things that change once and
-- stay changed.

comment on column polls.og_version is
  'bumped by trigger when the share card''s content changes — title, deadline, status, options';

-- ---------------------------------------------------------------- polls
-- BEFORE, not AFTER: an AFTER trigger would have to `update polls` and re-enter
-- itself. Writing to NEW costs one assignment and cannot recurse.
create or replace function polls_bump_og()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.og_version := coalesce(old.og_version, 1) + 1;
  return new;
end $$;

drop trigger if exists polls_og_bump on polls;
create trigger polls_og_bump
  before update on polls
  for each row
  when (
    old.title      is distinct from new.title
    or old.expires_at is distinct from new.expires_at
    or old.status     is distinct from new.status
  )
  execute function polls_bump_og();

-- ---------------------------------------------------------------- options
-- security definer: `polls` has no update policy for client roles at all (every
-- write goes through an RPC), so a trigger running as `authenticated` could not
-- write the counter back.
create or replace function options_bump_og()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_poll uuid;
begin
  -- NEW is unassigned in a DELETE trigger; referencing it raises rather than
  -- returning null, so this branches instead of coalescing.
  if tg_op = 'DELETE' then v_poll := old.poll_id; else v_poll := new.poll_id; end if;
  update polls set og_version = og_version + 1 where id = v_poll;
  return null;
end $$;

drop trigger if exists options_og_bump on options;
create trigger options_og_bump
  after insert or delete on options
  for each row execute function options_bump_og();

drop trigger if exists options_og_bump_edit on options;
create trigger options_og_bump_edit
  after update on options
  for each row
  when (
    old.label        is distinct from new.label
    or old.hidden       is distinct from new.hidden
    or old.merged_into  is distinct from new.merged_into
  )
  execute function options_bump_og();

-- Every poll that exists today was shared as `?v=1` whatever has happened to it
-- since. One bump gives them all a URL no scraper has seen.
update polls set og_version = og_version + 1;
