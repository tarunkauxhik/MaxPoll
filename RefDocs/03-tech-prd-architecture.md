# 03 — Tech PRD & Architecture

> Verified against 2026 provider docs. Two findings below change the obvious stack. Re-check limits before launch — they move.

---

## Hosting — Vercel

Vercel Hobby, deployed at **maxpoll.vercel.app** to start. No custom domain purchase yet — a real domain gets added later if/when the project moves to a paid plan. Bandwidth on Hobby is 100 GB/month; revisit if that ever becomes the actual bottleneck.

## ⚠️ FINDING 2 — Do not use Supabase Realtime for the leaderboard

Supabase free tier gives **200 concurrent realtime connections and 2M messages/month**, and *"every subscribed client counts toward usage for every message delivered — a dashboard with 100 concurrent viewers multiplies each event by 100."*

Run the numbers on your own design: one viral poll with 300 people watching **exceeds the connection cap outright**. And 200 viewers × 100 votes = 20,000 messages from a single poll. A few viral polls burn 2M/month.

**Your live leaderboard must not use websockets.**

### The pattern that works and costs ₹0
```
Client polls  GET /api/poll/:id/board  every 4s
        ↓
Next.js Route Handler, response cached at Vercel's edge
(Cache-Control: s-maxage=4, stale-while-revalidate=10)
        ↓
One function invocation every 4s — regardless of 10 or 10,000 viewers
```
Vercel serves cached responses straight from its CDN — a cache hit never re-invokes your function, so it costs nothing against your invocation or Active CPU budget. Edge caching means viewer count is irrelevant to your bill. This scales further than websockets and costs nothing. Users cannot tell the difference between 4-second polling and true realtime on a leaderboard.

**Chat:** same approach in v1 — poll `GET /api/poll/:id/messages?since=<cursor>` every 3s, cached 2s. A real-time transport (Supabase Realtime for just the chat channel, or Pusher's free tier) is the v2 upgrade if chat actually gets used.

## ⚠️ FINDING 3 — Supabase free projects pause after 7 days of inactivity
Set up an uptime ping — a **Vercel Cron Job** hitting a `/api/cron/ping` health-check endpoint daily. Cheap insurance against your database sleeping mid-launch.

---

## Verified free-tier limits

**Supabase Free:** 500 MB DB · 50,000 MAU · 5 GB egress + 5 GB cached egress · 1 GB file storage · 500k edge function invocations · 200 concurrent realtime connections · 2M realtime messages · 2 active projects · shared CPU, 500 MB RAM · **no backups** · pauses after 7 days idle

**Vercel Hobby:** 100 GB Fast Data Transfer (bandwidth) · 1M function invocations/mo · 1M edge requests/mo · **4 CPU-hours of Active CPU/mo** (only actual execution time counts, not idle/wait time) · 60s function timeout · 6,000 build minutes · 1 GB Blob storage. Hobby has **no automatic overage** — a maxed-out resource pauses that feature until the next monthly cycle, it doesn't bill you.

MAU only counts users who *sign in* that month. 50k MAU is genuinely generous — you will hit DB size or egress first. On Vercel, **4 CPU-hours is the tightest number** — see the capacity table below.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Host | **Vercel** (Hobby → Pro later) | Best-in-class Next.js DX, zero-config deploys |
| Framework | **Next.js (App Router)** | Native to Vercel — Route Handlers, Cron, `next/og` all built in |
| UI | shadcn/ui + Tailwind | Matches prototype |
| DB | **Supabase Postgres** | Free, RLS, `pg_trgm` for typeahead |
| Auth | **Supabase Auth → Google OAuth only** | Free, no SMS cost, no password surface |
| Live | **Edge-cached HTTP polling** | See Finding 2 |
| Payments | **Razorpay** Standard Checkout + webhook | UPI, 2% + GST |
| OG images | **`next/og` `ImageResponse`** rendered on-demand, edge-cached | Native to Vercel, no separate render step |
| Analytics | Vercel Web Analytics | Free tier on Hobby, no cookie banner |
| Cron | **Vercel Cron Jobs** (`vercel.json`) | Native scheduling, no separate service |

---

## Schema

```sql
create extension if not exists pg_trgm;

-- users (extends supabase auth.users)
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
  is_verified boolean default false,      -- you flip this; fakes get removed
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
  category text not null,                 -- campus/food/music/cricket/film/random
  is_private boolean default false,
  expires_at timestamptz,
  vote_count int default 0,               -- denormalised
  option_count int default 0,             -- denormalised
  options_locked boolean default false,   -- true once vote_count >= 10
  status text default 'live',             -- live | closed | removed
  created_at timestamptz default now()
);

create table options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls on delete cascade,
  label text not null,
  label_norm text not null,               -- lowercased, trimmed, punctuation stripped
  added_by uuid references profiles,
  vote_count int default 0,               -- denormalised — NEVER count(*)
  rank int,                               -- recomputed, see below
  prev_rank int,                          -- for ▲▼ badges
  merged_into uuid references options,    -- dedupe merges
  hidden boolean default false,
  created_at timestamptz default now()
);
create index on options using gin (label_norm gin_trgm_ops);
create index on options (poll_id, vote_count desc);

create table votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references polls on delete cascade,
  option_id uuid references options on delete cascade,
  user_id uuid references profiles,       -- null until claimed
  device_id text not null,                -- localStorage uuid + fingerprint hash
  created_at timestamptz default now()
);
create unique index on votes (poll_id, device_id);
create unique index on votes (poll_id, user_id) where user_id is not null;

create table entitlements (               -- who paid for what
  user_id uuid references profiles on delete cascade,
  poll_id uuid references polls on delete cascade,  -- null = subscription
  kind text not null,                     -- 'poll_unlock' | 'subscription'
  expires_at timestamptz,
  razorpay_payment_id text,
  created_at timestamptz default now()
);

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

### ⚠️ FINDING 4 — Vercel Hobby cron jobs run at most once per day
**Any sub-daily schedule fails at deploy time** — `*/1 * * * *` or even `0 * * * *` (hourly) will be rejected outright, not silently throttled. This kills the obvious design of "a cron every 30s recomputes ranks." Two crons only, both daily: the Supabase keep-alive ping, and a nightly badge/leaderboard rollup. **Everything else that needs to happen frequently must be computed on read, inside the cached route handler — never on a schedule.**

### The non-negotiable performance rules
1. **Never `count(*)` to get vote counts.** Increment `vote_count` inside the same transaction as the insert. A single `count(*)` on a viral poll will exhaust your compute budget.
2. **Compute ranks live, inside the cached board handler — no cron.** On each request that actually reaches the function (i.e. at most every 4s per poll, thanks to edge caching — see rule 3), query options `ORDER BY vote_count DESC` (cheap, already indexed), diff the new order against the `prev_rank` stored on each row to derive `▲/▼`, then write the new `prev_rank` back. This bounds recompute frequency to the cache window without needing any cron at all — which is fortunate, since Finding 4 rules out a frequent cron on Hobby anyway.
3. **Edge-cache the board endpoint** with `s-maxage=4`. This is what makes viewer count irrelevant, and it's also what makes rule 2 cheap — a cache hit never reaches your function or the database.
4. **Row Level Security on everything.** Voter names readable only if the requester holds an entitlement for that poll.

### Vote → counter, atomically
```sql
create or replace function cast_vote(p_poll uuid, p_option uuid, p_device text, p_user uuid)
returns void language plpgsql security definer as $$
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
```

### Typeahead dedupe (the "narendra" problem)
```sql
select id, label, vote_count, rank
from options
where poll_id = $1 and hidden = false and merged_into is null
  and similarity(label_norm, $2) > 0.3
order by similarity(label_norm, $2) desc, vote_count desc
limit 5;
```
Debounce 250ms client-side. **Show each suggestion's rank and vote count** — that's what actually stops the duplicate, because "#2, 82 votes" makes voting for the existing one the obvious move. Soft-warn above 0.8 similarity. Ship an owner **merge** action before launch; retro-merging polls with thousands of votes is far messier.

Devanagari won't trigram-match Latin ("मोदी" vs "Modi"). Don't solve it now — just make sure merge exists.

### OG images (needed for WhatsApp)
You cut client-side share cards, but WhatsApp previews still need a real 1200×630 PNG.
- Use **`next/og`'s `ImageResponse`** — a route like `app/og/[slug]/route.tsx` that queries the current leader/vote count and renders it as an image. Native to Next.js on Vercel; no separate render pipeline or storage step needed.
- Cache the response at the edge (`Cache-Control: s-maxage=60`) so it isn't recomputed on every WhatsApp crawl.
- **Version the URL when the leader changes** (`/og/poll-123?v=7`) — WhatsApp caches previews hard, and a stale preview makes a live poll look dead. Bump `v` from the same board-update logic in rule 2 above.
- Put the current leader and vote count in `og:title` / `og:description`.

### Growing-number animation ✅
Pure client-side `requestAnimationFrame` count-up from the previously rendered value to the new one, 600ms, ease-out. Applies to every counter: totals on cards, per-option counts after voting, member counts, landing stats. Monospaced digits, so nothing jitters. Respect `prefers-reduced-motion`. See Business PRD §8 on what those numbers should contain.

---

## Free-tier capacity ⚠️ (rough)
| Resource | Free ceiling | Est. headroom |
|---|---|---|
| DB 500 MB | ~2–3M votes at ~120 B/row + indexes | Comfortable to ~500k votes |
| Supabase egress 5 GB | Board JSON ~2 KB | ~2.5M board fetches/mo |
| MAU 50k | Sign-ins only | Not your bottleneck |
| Vercel bandwidth 100 GB | — | Rarely the bottleneck for JSON-heavy traffic |
| Vercel function invocations 1M/mo | Only cache **misses** invoke a function | With `s-maxage=4`, ~900 possible invocations/hour/poll even at max concurrency — cache absorbs the rest |
| **Vercel Active CPU 4 hrs/mo** | Only actual execution time counts | **This bites first** — see below |

**Active CPU is the real ceiling**, not request count, because Hobby only meters time the CPU is actually busy. A fast cached-miss board query (~20–40ms) times ~1M possible invocations before 4 CPU-hours is exhausted — comfortable for a launch, but it's the first meter to watch as a poll goes properly viral. Mitigations: back client polling off to 10s when the tab is hidden, stop polling entirely on closed polls, and keep the board query to the indexed `ORDER BY vote_count DESC` — no joins, no `count(*)`.

## Upgrade path
1. Supabase Pro $25/mo (8 GB, 250 GB egress, backups) — at ~500k votes
2. **Vercel Pro $20/mo** — when Active CPU or the once-a-day cron limit actually becomes the constraint; also removes the Hobby non-commercial restriction
3. A real-time transport for chat (Supabase Realtime scoped to one channel, or Pusher free tier) — only if chat proves used

Total realistic cost at meaningful scale: **~$45/month.**
