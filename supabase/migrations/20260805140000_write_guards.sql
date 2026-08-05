-- Chat and add-option: move the guards into the database.
--
-- Until now every rule on these two tables lived in a Server Action:
-- `chat/actions.ts` trimmed the body to 300 chars, `option-actions.ts` capped
-- labels at 80 and refused closed or `options_locked` polls. All real, all
-- bypassable — the policies behind them only asked *are you you?*
--
--   create policy messages_insert on messages for insert with check (auth.uid() = user_id);
--   create policy options_insert  on options  for insert with check (auth.uid() = added_by);
--
-- A signed-in user holding the publishable key — which ships to every browser by
-- design — could POST straight to /rest/v1/messages with a 10MB body, at any
-- rate, or add options to a locked poll. DECISIONS D2b said the same thing about
-- `orders` and column grants; this is that lesson on two more tables.
--
-- Pattern is the one cast_vote / create_poll / verify_order already use: a
-- security definer function with a pinned search_path, and the direct write
-- revoked so the function is the only door.

-- ============================================================ constraints

-- Belt to the functions' braces: these hold even if a function is later dropped
-- or replaced carelessly. Safe against existing rows — the longest seeded label
-- is 41 characters.
alter table messages add constraint messages_body_len
  check (char_length(body) between 1 and 300);
alter table options add constraint options_label_len
  check (char_length(label) between 2 and 80);

-- The rate window counts by user; the existing index is (poll_id, id desc).
create index if not exists messages_user_recent on messages (user_id, created_at desc);
create index if not exists options_added_recent on options (added_by, created_at desc);

-- ============================================================ chat

create or replace function send_message(p_poll uuid, p_body text, p_anon boolean)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
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

  if p_anon then
    -- Derived here rather than passed in. As a parameter the client could post
    -- under someone else's pseudonym, which is the opposite of what anonymity
    -- is for. Stable per (user, poll): the same person is always `owl4713` in
    -- one thread and someone else entirely in the next, so a handle cannot be
    -- followed between polls.
    v_d := decode(md5(v_user::text || ':' || p_poll::text), 'hex');
    v_handle := (array['owl','fox','cat','bee','elk','ram','jay','koi','yak','ant'])
                  [1 + (get_byte(v_d, 0) % 10)]
                || lpad(((get_byte(v_d, 1) * 256 + get_byte(v_d, 2)) % 10000)::text, 4, '0');
  end if;

  -- user_id is stored even when anonymous: moderation and the 3-report auto-hide
  -- both need it. Anonymity is from other users, not from us — and the API route
  -- never selects a name alongside anon_handle.
  insert into messages (poll_id, user_id, body, anon_handle)
  values (p_poll, v_user, v_text, v_handle)
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function send_message(uuid, text, boolean) from public, anon;
grant  execute on function send_message(uuid, text, boolean) to authenticated;

-- ============================================================ add option

create or replace function add_option(p_poll uuid, p_label text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_label text;
  v_poll polls;
  v_recent int;
  v_id uuid;
begin
  if v_user is null then raise exception 'SIGNED_OUT'; end if;

  v_label := left(btrim(coalesce(p_label, '')), 80);
  if char_length(v_label) < 2 then raise exception 'TOO_SHORT'; end if;

  -- Locked inside the transaction so two rapid submits cannot both read
  -- option_count = 59 and both insert.
  select * into v_poll from polls where id = p_poll for update;
  if not found then raise exception 'CLOSED'; end if;
  if v_poll.status <> 'live' then raise exception 'CLOSED'; end if;
  if v_poll.expires_at is not null and v_poll.expires_at <= now() then
    raise exception 'CLOSED';
  end if;
  if v_poll.options_locked then raise exception 'LOCKED'; end if;
  if v_poll.option_count >= 60 then raise exception 'OPTION_CAP'; end if;

  -- Only options added to *other people's* polls count. Creating a poll inserts
  -- up to 10 options through create_poll, and counting those would lock the
  -- creator out of adding anything for an hour immediately after creating.
  -- Stuffing your own poll is already bounded by OPTION_CAP above.
  select count(*) into v_recent
    from options o
    join polls p on p.id = o.poll_id
   where o.added_by = v_user
     and o.created_at > now() - interval '1 hour'
     and p.created_by is distinct from v_user;
  if v_recent >= 10 then raise exception 'RATE_LIMITED'; end if;

  insert into options (poll_id, label, added_by)
  values (p_poll, v_label, v_user)
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function add_option(uuid, text) from public, anon;
grant  execute on function add_option(uuid, text) to authenticated;

-- ============================================================ close the doors

-- The functions above are now the only way a client writes to either table.
-- The insert policies stay: dead weight while the grant is gone, but they
-- document intent, and a future `grant` that forgets them fails closed.
revoke insert on messages from anon, authenticated;
revoke insert on options  from anon, authenticated;

-- ============================================================ create_poll

-- Unchanged except for the option labels: it used to insert btrim(label) with no
-- cap, which the new options_label_len constraint would now reject outright. A
-- real user typing a long name should not see a constraint violation, so the
-- same truncation the rest of the system applies happens here too.
create or replace function create_poll(
  p_slug text, p_space uuid, p_title text, p_subject_type text,
  p_category text, p_expires timestamptz, p_options text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_recent int; v_poll uuid; v_label text; v_clean text;
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
