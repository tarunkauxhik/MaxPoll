-- Development seed. NOT a migration: it must never auto-apply, and production
-- must never carry demo content.
--
--   apply:  pnpm supabase db execute --db-url "$SUPABASE_DB_URL" -f supabase/seed.sql
--   wipe:   the last block of this file, run on its own
--
-- Real profiles need real auth.users rows, so this seeds one synthetic user via
-- auth.users directly. Everything hangs off it and is removed by the wipe.

-- ============================================================ wipe first
-- Idempotent: re-running the seed gives the same state, never doubles it.
delete from votes    where device_id = 'seed-device';
delete from options  where added_by  in (select id from profiles where handle like 'seed_%');
delete from polls    where created_by in (select id from profiles where handle like 'seed_%');
delete from spaces   where slug like 'seed-%';
delete from profiles where handle like 'seed_%';
delete from auth.users where email like 'seed+%@maxpoll.test';

-- ============================================================ users
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'seed+' || i || '@maxpoll.test', '', now(), now(), now(),
  '{"provider":"google","providers":["google"]}'::jsonb, '{}'::jsonb
from generate_series(1, 12) i;

insert into profiles (id, handle, display_name, dob, bio)
select u.id,
       'seed_' || row_number() over (order by u.email),
       (array['Aarav Sharma','Priya Mehta','Rohan Gupta','Ananya Iyer','Kabir Singh',
              'Diya Nair','Arjun Rao','Isha Kapoor','Vivaan Joshi','Meera Pillai',
              'Aditya Bose','Sara Khan'])[row_number() over (order by u.email)],
       date '2003-05-14',
       'Seeded account for local testing.'
from auth.users u
where u.email like 'seed+%@maxpoll.test';

-- ============================================================ space
insert into spaces (slug, name, description, created_by, is_verified)
select 'seed-dtu', 'DTU · 1st year',
       'First-year students at Delhi Technological University.',
       id, true
from profiles where handle = 'seed_1';

-- Everyone joins, which pushes member_count past the 20-member results gate…
-- except it doesn't: 12 members is deliberately UNDER 20, so the "12/20 members
-- to unlock results" state is what you see. Add more users here to cross it.
insert into space_members (space_id, user_id)
select s.id, p.id
from spaces s cross join profiles p
where s.slug = 'seed-dtu' and p.handle like 'seed_%';

-- ============================================================ polls
insert into polls (slug, space_id, created_by, title, subject_type, category, expires_at)
select 'seed-' || t.slug, s.id, p.id, t.title, t.subject, t.cat,
       now() + (t.hours || ' hours')::interval
from spaces s, profiles p,
  (values
    ('best-teacher',  'Best 1st year teacher',       'person', 'people',  30),
    ('worst-canteen', 'Best canteen on campus',      'thing',  'things',  50),
    ('best-society',  'Most underrated society',     'thing',  'things',  20),
    ('best-lab',      'Most helpful lab assistant',  'person', 'people',   4),
    ('best-hostel',   'Best hostel block',           'thing',  'things',  72),
    ('closing-soon',  'Funniest professor',          'person', 'people',   1)
  ) as t(slug, title, subject, cat, hours)
where s.slug = 'seed-dtu' and p.handle = 'seed_1';

-- ============================================================ options
insert into options (poll_id, label, added_by)
select pl.id, o.label, pr.id
from polls pl, profiles pr,
  (values
    ('seed-best-teacher', 'Rajma Sir'),
    ('seed-best-teacher', 'Verma Ma''am'),
    ('seed-best-teacher', 'Anand Sir'),
    ('seed-best-teacher', 'Dr. Priyadarshini Venkataraman (Chemistry)'),
    ('seed-best-teacher', 'Khanna Sir'),
    ('seed-best-teacher', 'Bhatt Ma''am'),
    ('seed-worst-canteen', 'Nescafe'),
    ('seed-worst-canteen', 'Main Canteen'),
    ('seed-worst-canteen', 'Tuck Shop'),
    ('seed-best-society', 'Robotics'),
    ('seed-best-society', 'Dramatics'),
    ('seed-best-society', 'Music'),
    ('seed-best-lab', 'Ramesh ji'),
    ('seed-best-lab', 'Sunita ji'),
    ('seed-best-hostel', 'Block A'),
    ('seed-best-hostel', 'Block C'),
    ('seed-closing-soon', 'Prof. Iyer'),
    ('seed-closing-soon', 'Prof. Dutta')
  ) as o(poll_slug, label)
where pl.slug = o.poll_slug and pr.handle = 'seed_1';

-- ============================================================ votes
-- Through cast_vote() rather than raw inserts, so the denormalised counters are
-- incremented by the same code path production uses. A seed that writes counts
-- by hand would hide a broken counter, which is exactly the bug Gate 4 hunts.
do $$
declare v_poll uuid; v_opt uuid; v_user uuid; i int := 0;
begin
  for v_poll in select id from polls where slug like 'seed-%' loop
    for v_user in
      select id from profiles where handle like 'seed_%' order by handle
    loop
      i := i + 1;
      -- Skewed toward the first option so ranks are visibly different.
      select id into v_opt from options
       where poll_id = v_poll and hidden = false
       order by case when (i % 3) = 0 then random() else 0 end, created_at
       limit 1 offset (i % greatest(1, (select count(*) from options where poll_id = v_poll)))::int;

      if v_opt is not null and (i % 4) <> 0 then
        begin
          perform cast_vote(v_poll, v_opt, 'seed-device', v_user);
        exception when others then null;  -- already voted on this poll
        end;
      end if;
    end loop;
  end loop;
end $$;

-- ============================================================ wipe (run alone)
-- delete from votes    where device_id = 'seed-device';
-- delete from options  where added_by  in (select id from profiles where handle like 'seed_%');
-- delete from polls    where created_by in (select id from profiles where handle like 'seed_%');
-- delete from spaces   where slug like 'seed-%';
-- delete from profiles where handle like 'seed_%';
-- delete from auth.users where email like 'seed+%@maxpoll.test';
