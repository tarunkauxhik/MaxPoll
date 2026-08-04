# Architecture

Corrected against the providers' current docs. Where this differs from the original
drafts, [DECISIONS.md](DECISIONS.md) §A explains why. **Re-check the free-tier
numbers before launch — providers move them.**

## Stack

| Layer | Choice | Why |
|---|---|---|
| Host | **Vercel** (Hobby → Pro later) | Best-in-class Next.js DX, zero-config deploys |
| Framework | **Next.js 16 App Router** | Route Handlers, Cron, `next/og` all native |
| UI | **Plain CSS**, ported from the prototypes | See [DECISIONS](DECISIONS.md) D1 — no Tailwind, no shadcn |
| DB | **Supabase Postgres** (Mumbai) | Free, RLS, `pg_trgm` for typeahead |
| Auth | **Supabase Auth → Google OAuth only** | Free, no SMS cost, no password surface |
| Live | **Edge-cached HTTP polling** | Not websockets — see below |
| Payments | **Razorpay** Standard Checkout + webhook | UPI, 2% + GST |
| OG images | **`next/og` `ImageResponse`**, edge-cached | Native, no separate render step |
| Analytics | Vercel Web Analytics | Free on Hobby, no cookie banner |
| Cron | **Vercel Cron** (`vercel.json`) | Native scheduling, once daily max |

## The three load-bearing constraints

### 1. No websockets for the leaderboard

Supabase Free gives **200 concurrent realtime connections and 2M messages/month**,
and *every subscribed client counts toward usage for every message delivered*. One
viral poll with 300 watchers **exceeds the connection cap outright**. 200 viewers ×
100 votes = 20,000 messages from a single poll.

The pattern that works and costs ₹0:

```
Client polls  GET /api/poll/:id/board  every 4s
        ↓
Next.js Route Handler, response cached at Vercel's CDN
        ↓
One function invocation per 4s — regardless of 10 or 10,000 viewers
```

A CDN hit never re-invokes the function, so viewer count is irrelevant to the bill.
This scales further than websockets. Users cannot tell 4-second polling from true
realtime on a leaderboard.

Client polling backs off to **10s when `document.hidden`** and **stops entirely on
closed polls**.

**Chat** uses the same approach in v1: `GET /api/poll/:id/messages?since=<cursor>`
every 3s, cached 2s. A real transport is the v2 upgrade *if chat proves used*.

### 2. `Set-Cookie` silently disables that cache

Vercel's CDN **refuses to cache any response carrying `Set-Cookie`**, and any request
carrying `Authorization`. `@supabase/ssr` middleware sets auth cookies on every
response it touches — so routing the board through it makes `s-maxage` decorative,
with no error and nothing visibly wrong. The only symptom is the usage graph climbing
with viewer count.

```ts
// middleware.ts — cached routes are excluded from the matcher
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/poll/.*/board|api/poll/.*/messages|og/).*)'],
};
```

Cached handlers build an anon client from `NEXT_PUBLIC_*` keys only and never touch
cookies. Headers:

```
Cache-Control:     public, max-age=0
CDN-Cache-Control: public, s-maxage=4, stale-while-revalidate=10
```

`Cache-Control` alone would work, but Vercel strips `s-maxage`/`stale-while-revalidate`
before the response reaches the browser, leaving ambiguous browser caching. The
targeted header is explicit: CDN caches, browser doesn't, every client poll reaches
the edge.

**Vercel's CDN is segmented per region**, so "one invocation per 4s" holds per edge
region. Fine for India-first.

Verify with `x-vercel-cache: HIT`. Never "it felt fast".

### 3. Functions must run in Mumbai

Vercel Hobby runs **all functions in one region, defaulting to `iad1`** (Virginia).
The database is in Mumbai. Unpinned, every query crosses the Atlantic twice.

```json
// vercel.json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "regions": ["bom1"] }
```

Hobby permits exactly one region, so this is free. Largest single latency win
available.

## Performance rules — non-negotiable

1. **Never `count(*)` for vote counts.** Increment `vote_count` inside the same
   transaction as the insert. One `count(*)` on a viral poll exhausts the compute
   budget. Grep for `count(` before shipping.
2. **Rank is computed at read time**, inside the cached board handler:
   `row_number() over (order by vote_count desc, created_at)`. No `rank` column to
   drift, no cron, no write amplification.
3. **Movement uses a 60s snapshot window.** The handler rewrites
   `rank_snapshot`/`snapshot_at` only when the snapshot is older than 60s, and only
   for rows whose rank changed. Diffing per request would make a ▲2 badge appear
   and vanish inside one 4s cache window.
4. **Edge-cache the board.** This is what makes viewer count irrelevant *and* what
   makes rule 2 cheap — a cache hit never reaches the function or the database.
5. **RLS on every table.** Voter names readable only by entitlement holders.
6. **Board JSON stays lean** — no joins, no voter names. Hobby's Fast Origin
   Transfer (~10GB/mo) is tighter than its bandwidth allowance, and only cache
   misses consume it.

## Schema

```sql
create extension if not exists pg_trgm;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique not null,
  display_name text not null,
  bio text,
  dob date not null,                      -- 18+ gate; NEVER shown publicly
  instagram text, x_handle text, snapchat text,
  created_at timestamptz default now()
);

create table spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  created_by uuid references profiles,
  member_count int default 0,             -- denormalised
  is_verified boolean default false,
  created_at timestamptz default now()
);

create table space_members (
  space_id uuid references spaces on delete cascade,
  user_id uuid references profiles on delete cascade,
  joined_at timestamptz default now(),
  primary key (space_id, user_id)
);

create table polls (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  space_id uuid references spaces on delete cascade,
  created_by uuid references profiles,
  title text not null,
  adjective_id int,                       -- NOT NULL when subject_type='person'
  subject_type text check (subject_type in ('person','thing')) not null,
  category text not null,
  is_private boolean default false,
  expires_at timestamptz,
  vote_count int default 0,               -- denormalised
  option_count int default 0,             -- denormalised
  options_locked boolean default false,   -- true once vote_count >= 10
  status text default 'live',             -- live | closed | removed
  og_version int default 1,               -- bumped on leader change
  created_at timestamptz default now()
);

create table options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls on delete cascade,
  label text not null,
  label_norm text not null,               -- lowercased, trimmed, punctuation stripped
  added_by uuid references profiles,
  vote_count int default 0,               -- denormalised — NEVER count(*)
  rank_snapshot int,                      -- for ▲▼, refreshed at most every 60s
  snapshot_at timestamptz,
  merged_into uuid references options,
  hidden boolean default false,
  created_at timestamptz default now()
);
create index on options using gin (label_norm gin_trgm_ops);
create index on options (poll_id, vote_count desc);

create table votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls on delete cascade,
  option_id uuid references options on delete cascade,
  user_id uuid references profiles,       -- nulled on account deletion, never deleted
  device_id text not null,                -- fraud signal only, NOT a constraint
  created_at timestamptz default now()
);
create unique index on votes (poll_id, user_id) where user_id is not null;
create index on votes (poll_id, device_id);   -- velocity flagging

create table entitlements (
  user_id uuid references profiles on delete cascade,
  poll_id uuid references polls on delete cascade,  -- null = subscription
  kind text not null,                     -- 'poll_unlock' | 'sub_monthly'
  expires_at timestamptz,
  razorpay_payment_id text,
  created_at timestamptz default now()
);
create unique index entitlements_payment_uniq
  on entitlements(razorpay_payment_id) where razorpay_payment_id is not null;

create table badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  type text not null,                     -- 'top_creator' | 'added_won'
  poll_id uuid references polls,
  space_id uuid references spaces,
  period text,                            -- '2026-W31' — weekly, so it stays winnable
  earned_at timestamptz default now()
);

create table follows (
  follower_id uuid references profiles on delete cascade,
  following_id uuid references profiles on delete cascade,
  primary key (follower_id, following_id)
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  type text not null,     -- same_as_you | poll_closed | option_climbed |
                          -- chat_reply | chat_hot | new_follower | badge_earned
  payload jsonb not null,
  read boolean default false,
  created_at timestamptz default now()
);
create index on activity (user_id, read, created_at desc);

create table messages (
  id bigserial primary key,
  poll_id uuid references polls on delete cascade,
  user_id uuid references profiles,
  anon_handle text,       -- 'owl4713' when posted anonymously
  body text not null,
  hidden boolean default false,
  created_at timestamptz default now()
);
create index on messages (poll_id, id desc);

create table reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null, target_id uuid not null,
  reporter_id uuid references profiles,
  reason text, created_at timestamptz default now()
);
```

### Why `device_id` is not unique

Every vote is authenticated — the vote flow forces Google sign-in before the vote
lands — so `unique(poll_id, user_id)` is already the real guard. A unique device
index adds nothing and breaks the shared-laptop case, which is common on an Indian
campus: user A votes, signs out, user B signs in → `ALREADY_VOTED`. It stays as a
velocity signal, which is what "flag, don't block" actually needs.

### Vote → counter, atomically

```sql
create or replace function cast_vote(p_poll uuid, p_option uuid, p_device text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp   -- without this, a privilege-escalation hole
as $$
begin
  insert into votes (poll_id, option_id, device_id, user_id)
  values (p_poll, p_option, p_device, p_user);

  update options set vote_count = vote_count + 1 where id = p_option;
  update polls   set vote_count = vote_count + 1 where id = p_poll;

  update polls set options_locked = true
    where id = p_poll and vote_count >= 10 and options_locked = false;
exception when unique_violation then
  raise exception 'ALREADY_VOTED';
end $$;

revoke execute on function cast_vote from public;
grant  execute on function cast_vote to authenticated;
```

### Typeahead dedupe (the "narendra" problem)

```sql
select id, label, vote_count
from options
where poll_id = $1 and hidden = false and merged_into is null
  and similarity(label_norm, $2) > 0.3
order by similarity(label_norm, $2) desc, vote_count desc
limit 5;
```

Debounce 250ms client-side. **Show each suggestion's rank and vote count** — that's
what actually stops the duplicate, because "#2, 82 votes" makes voting for the
existing one the obvious move. Soft-warn above 0.8 similarity. Ship the owner
**merge** action before launch; retro-merging polls with thousands of votes is far
messier.

Devanagari won't trigram-match Latin ("मोदी" vs "Modi"). Don't solve it now — just
make sure merge exists.

### Rate limiting

No free Redis. Counters live in Postgres inside the same `security definer` RPC as
the write they guard — one extra row, no new service, no new dependency. Applies to:
votes, poll creation, option adds, messages.

## Free-tier limits (verified 2026-08-04)

**Supabase Free** — 500MB DB · 50,000 MAU · 5GB egress + 5GB cached egress · 1GB
storage · 500k edge function invocations · 200 concurrent realtime connections · 2M
realtime messages · **2 active projects** · shared CPU, 500MB RAM · **no backups** ·
**pauses after 7 days idle** (dashboard visits count as activity; paused projects
don't count toward the 2-project limit and restore within a year).

**Vercel Hobby** — 100GB Fast Data Transfer · **~10GB Fast Origin Transfer** · 1M
invocations · **4 CPU-hrs Active CPU** · 1M edge requests · 360 GB-hrs provisioned
memory · 60s function timeout · **cron once daily, 10s timeout** · 100 deployments/day
· 45min build limit · single function region · no automatic overage (a maxed resource
pauses until the next cycle) · non-commercial use only · cannot connect to org-owned
Git repos.

### Capacity

| Resource | Ceiling | Headroom |
|---|---|---|
| DB 500MB | ~2–3M votes at ~120B/row + indexes | Comfortable to ~500k votes |
| Supabase egress 5GB | Board JSON ~2KB | ~2.5M board fetches/mo |
| MAU 50k | Sign-ins only | Not the bottleneck |
| Vercel invocations 1M | Only cache **misses** invoke | ~900 possible/hour/poll at `s-maxage=4` |
| **Active CPU 4 hrs** | Only busy time counts | **Bites first** — watch it |
| **Fast Origin Transfer ~10GB** | Only misses count | Second to bite |

**Active CPU is the real ceiling.** A cached-miss board query (~20–40ms) × ~1M
invocations approaches 4 CPU-hours. Mitigations already in the design: back polling
off to 10s when hidden, stop on closed polls, keep the board query to the indexed
`ORDER BY vote_count DESC` — no joins, no `count(*)`.

## Upgrade path

1. **Supabase Pro $25/mo** (8GB, 250GB egress, backups, no pausing) — at ~500k votes
2. **Vercel Pro $20/mo** — when Active CPU or the daily-cron limit binds; also
   removes the non-commercial restriction, which is a prerequisite for taking real
   money
3. A real-time transport for chat — only if chat proves used

Realistic cost at meaningful scale: **~$45/month.**
