-- Chat is unconditionally anonymous now — Phase 17. There is no "post as
-- yourself" mode, so `p_anon` can't be a parameter: dropping it means no
-- code path can ever leave `anon_handle` null.
drop function if exists send_message(uuid, text, boolean);

create or replace function send_message(p_poll uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_text text;
  v_recent int;
  v_handle text;
  v_d bytea;
  v_id bigint;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;

  v_text := left(btrim(coalesce(p_body, '')), 300);
  if v_text = '' then raise exception 'EMPTY'; end if;

  if not exists (select 1 from polls where id = p_poll and status = 'live') then
    raise exception 'CLOSED';
  end if;

  select count(*) into v_recent
    from messages
   where user_id = v_user and created_at > now() - interval '1 minute';
  if v_recent >= 10 then raise exception 'RATE_LIMITED'; end if;

  -- Derived here rather than passed in. As a parameter the client could post
  -- under someone else's pseudonym, which is the opposite of what anonymity
  -- is for. Stable per (user, poll): the same person is always `owl4713` in
  -- one thread and someone else entirely in the next, so a handle cannot be
  -- followed between polls.
  v_d := decode(md5(v_user::text || ':' || p_poll::text), 'hex');
  v_handle := (array['owl','fox','cat','bee','elk','ram','jay','koi','yak','ant'])
                [1 + (get_byte(v_d, 0) % 10)]
              || lpad(((get_byte(v_d, 1) * 256 + get_byte(v_d, 2)) % 10000)::text, 4, '0');

  -- user_id is stored even when anonymous: moderation and the 3-report auto-hide
  -- both need it. Anonymity is from other users, not from us — and the API route
  -- never selects a name alongside anon_handle.
  insert into messages (poll_id, user_id, body, anon_handle)
  values (p_poll, v_user, v_text, v_handle)
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function send_message(uuid, text) from public, anon;
grant  execute on function send_message(uuid, text) to authenticated;
