-- Polls never actually ended.
--
-- `isExpired()` computes closure at read time, so the poll page always looked
-- right — but `polls.status` stayed 'live' forever. Checked against production:
-- all 6 polls were 'live' and one had expired two hours earlier.
--
-- Three things followed. The landing page counts `status='live'` for its headline
-- number, so it counted dead polls. `getFeed()` pulls 40 rows of `status='live'`,
-- so expired polls ate the budget live ones needed. And `poll_closed` — doc 03 §H's
-- third retention hook — could never fire, because nothing in the system marked the
-- moment a poll ends.
--
-- The daily keep-alive cron is the natural place: it already exists, it is the one
-- cron Hobby allows, and closure is not time-critical because the read path is
-- already correct.

-- One notification per person per poll, so re-running the cron is free.
create unique index if not exists activity_closed_uniq
  on activity (user_id, ((payload->>'poll_id'))) where type = 'poll_closed';

create or replace function close_expired_polls()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_ids uuid[];
begin
  with closed as (
    update polls set status = 'closed'
     where status = 'live' and expires_at is not null and expires_at <= now()
     returning id
  )
  select array_agg(id) into v_ids from closed;

  if v_ids is null then return 0; end if;

  -- Everyone who voted hears the result, not just that it ended — 03 §H asks for
  -- "result of a poll you voted in".
  --
  -- ⚠️ The winner's ordering must stay `vote_count desc, created_at`. That is what
  -- rankOptions() and search_options() use; any other order here would name a
  -- different winner than the board showed a minute earlier.
  insert into activity (user_id, type, payload)
  select distinct v.user_id, 'poll_closed',
         jsonb_build_object(
           'poll_id', p.id,
           'poll_slug', p.slug,
           'poll_title', p.title,
           'winner', w.label)
    from polls p
    join votes v on v.poll_id = p.id and v.user_id is not null
    left join lateral (
      select o.label
        from options o
       where o.poll_id = p.id and o.hidden = false and o.merged_into is null
       order by o.vote_count desc, o.created_at
       limit 1
    ) w on true
   where p.id = any(v_ids)
  on conflict do nothing;

  return coalesce(array_length(v_ids, 1), 0);
end $$;

-- Granted to anon for the same reason snapshot_ranks is: the cron route uses the
-- cookie-free client, and the function is safe by construction — it only touches
-- polls that are *already* past their expiry, and the notification is deduped by
-- the index above. Calling it directly achieves nothing the next cron wouldn't.
-- That is why the route's CRON_SECRET guard protects our invocation quota rather
-- than the data.
revoke execute on function close_expired_polls() from public;
grant  execute on function close_expired_polls() to anon, authenticated;
