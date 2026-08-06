-- Chat is unconditionally anonymous as of 20260808100000, but messages sent
-- before that under the old p_anon=false path still have a null handle.
-- Same derivation as send_message() — stable per (user, poll).
update messages
set anon_handle = (array['owl','fox','cat','bee','elk','ram','jay','koi','yak','ant'])
    [1 + (get_byte(d, 0) % 10)]
    || lpad(((get_byte(d, 1) * 256 + get_byte(d, 2)) % 10000)::text, 4, '0')
from (
  select id, decode(md5(user_id::text || ':' || poll_id::text), 'hex') as d
  from messages
  where anon_handle is null
) backfill
where messages.id = backfill.id;
