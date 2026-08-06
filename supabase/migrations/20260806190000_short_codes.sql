-- Short share codes: /p/aB3kZ9 alongside /p/greatest-indian-odi-batter-x8f2q.
--
-- Both forms resolve. The readable slug stays canonical, because it is what
-- search engines index and what tells a reader in a WhatsApp group what they are
-- about to tap. The code exists for the paste itself — a link that fits on one
-- line survives a group chat better than one that wraps.
--
-- A column DEFAULT rather than app code, deliberately: there are four writers
-- (create_poll(), create_space(), seed.sql, scripts/launch.mjs) and only one of
-- them is TypeScript. A default covers writers that do not exist yet, which is
-- the same reason options.created_at was fixed with a default and not a patch to
-- each caller.

-- Alphabet excludes 0/O/1/l/I — a code gets read aloud and typed by hand.
-- 31 chars ^ 7 = 27.5 billion, against a unique index, so a collision is not a
-- practical failure mode. (A DEFAULT cannot retry, which is why the space is
-- sized this far past what is needed rather than at the 5 chars slugs use.)
create or replace function short_code(len int default 7)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  out text := '';
  i int;
begin
  for i in 1..len loop
    -- gen_random_bytes is pgcrypto and may not be present; random() is seeded
    -- per-backend and is fine here — this is a URL, not a secret. Guessing a
    -- code buys nothing a public poll page does not already give away.
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out;
end;
$$;

alter table polls  add column if not exists code text;
alter table spaces add column if not exists code text;

-- Backfill before the default and the constraint, so existing rows — including
-- every link already shared — get a code without a rewrite later.
update polls  set code = short_code() where code is null;
update spaces set code = short_code() where code is null;

alter table polls  alter column code set default short_code();
alter table spaces alter column code set default short_code();
alter table polls  alter column code set not null;
alter table spaces alter column code set not null;

create unique index if not exists polls_code_key  on polls  (code);
create unique index if not exists spaces_code_key on spaces (code);

-- Lookup is `slug = $1 or code = $1` on every poll and Space page load. The slug
-- indexes already exist from the initial schema; these complete the pair.
--
-- `insert, update` on both tables is already revoked from anon/authenticated
-- (column_guards), so no client can choose or rewrite its own code. Nothing to
-- grant: `select` is what RLS already governs.
