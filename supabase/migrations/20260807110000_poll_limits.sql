-- Phase 16 · Two changes to the poll-creation and poll-editing RPCs.
--
-- 1. A 7-day cap on expires_at, in both create_poll and update_poll. The
--    deadline picker's `max` attribute is a hint — a Server Action is a public
--    HTTP endpoint, so the cap has to live in the database, same reasoning as
--    the 3-per-week limit below.
-- 2. An active 30-day pass (entitlements.kind = 'sub_monthly') lifts the
--    3-per-week poll cap. Checked inside the same transaction as the insert so
--    two rapid submits cannot both slip past a check-then-insert race.
--
-- Both functions are re-created in full — the bodies below are copied from
-- pg_get_functiondef() on the live database, not from an earlier draft, so
-- every existing guard (the Space-size gate, the label cleaning, the REMOVED
-- check) survives untouched.

create or replace function create_poll(
  p_slug text, p_space uuid, p_title text, p_subject_type text,
  p_category text, p_expires timestamptz, p_options text[]
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_recent int; v_poll uuid; v_label text; v_clean text;
  v_space_owner uuid; v_members int;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;
  if p_subject_type not in ('person','thing') then raise exception 'BAD_SUBJECT'; end if;
  if array_length(p_options, 1) is null or array_length(p_options, 1) < 2 then
    raise exception 'TOO_FEW_OPTIONS';
  end if;
  if array_length(p_options, 1) > 10 then raise exception 'TOO_MANY_OPTIONS'; end if;

  if p_expires is not null then
    if p_expires <= now() then raise exception 'EXPIRY_IN_PAST'; end if;
    if p_expires > now() + interval '7 days' then raise exception 'EXPIRY_TOO_FAR'; end if;
  end if;

  -- An active 30-day pass lifts the 3-per-week cap.
  if not exists (
    select 1 from entitlements
     where user_id = v_user
       and kind = 'sub_monthly'
       and (expires_at is null or expires_at > now())
  ) then
    select count(*) into v_recent
      from polls
     where created_by = v_user and created_at > now() - interval '7 days';
    if v_recent >= 3 then raise exception 'WEEKLY_LIMIT'; end if;
  end if;

  if p_space is not null then
    select created_by, member_count into v_space_owner, v_members
      from spaces where id = p_space;
    if v_space_owner is null then raise exception 'NO_SPACE'; end if;
    if v_space_owner <> v_user and coalesce(v_members, 0) < 3 then
      raise exception 'SPACE_TOO_SMALL';
    end if;
  end if;

  insert into polls (slug, space_id, created_by, title, subject_type, category, expires_at)
  values (p_slug, p_space, v_user, p_title, p_subject_type, p_category, p_expires)
  returning id into v_poll;

  foreach v_label in array p_options loop
    v_clean := left(btrim(v_label), 80);
    if char_length(v_clean) >= 2 then
      insert into options (poll_id, label, added_by) values (v_poll, v_clean, v_user);
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

create or replace function update_poll(
  p_poll uuid, p_title text default null, p_expires timestamptz default null,
  p_clear_expiry boolean default false, p_close boolean default false,
  p_lock_options boolean default null
)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare v_user uuid := auth.uid(); v_owner uuid; v_status text; v_title text;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;

  select created_by, status into v_owner, v_status
    from polls where id = p_poll for update;

  if v_owner is null then raise exception 'NO_POLL'; end if;
  if v_owner <> v_user then raise exception 'NOT_OWNER'; end if;
  -- 'removed' is a moderation outcome. Letting the creator edit their way out of
  -- it would make the 3-report auto-hide advisory.
  if v_status = 'removed' then raise exception 'REMOVED'; end if;

  v_title := nullif(btrim(coalesce(p_title, '')), '');
  if v_title is not null and char_length(v_title) < 4 then
    raise exception 'TITLE_TOO_SHORT';
  end if;

  -- An extension must not resurrect a poll people already saw end, and a new
  -- deadline in the past would close it the instant the cron next runs.
  if p_expires is not null and p_expires <= now() then
    raise exception 'EXPIRY_IN_PAST';
  end if;
  if p_expires is not null and p_expires > now() + interval '7 days' then
    raise exception 'EXPIRY_TOO_FAR';
  end if;

  update polls set
    title = coalesce(v_title, title),
    expires_at = case
      when p_clear_expiry then null
      when p_expires is not null then p_expires
      else expires_at
    end,
    status = case when p_close then 'closed' else status end,
    options_locked = coalesce(p_lock_options, options_locked)
  where id = p_poll;
end $$;

revoke execute on function update_poll(uuid, text, timestamptz, boolean, boolean, boolean) from public, anon;
grant  execute on function update_poll(uuid, text, timestamptz, boolean, boolean, boolean) to authenticated;
