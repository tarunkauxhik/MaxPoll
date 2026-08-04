# Decisions

Why things are the way they are. **Where this file conflicts with `RefDocs/`,
this file wins** — the RefDocs are non-final drafts and several of their
platform claims were wrong when checked against the providers' own docs.

Format: what was decided · why · what it supersedes.

---

## A — Platform corrections (verified 2026-08-04)

### A1 · Functions run in Mumbai (`bom1`)
`vercel.json` pins `"regions": ["bom1"]`.

Vercel Hobby runs **all functions in one region, defaulting to `iad1`**
(Virginia). Supabase is in Mumbai. Left alone, every uncached query crosses the
Atlantic twice — roughly +250ms against a <200ms TTFB budget. Hobby permits
exactly one region, so this costs nothing.

_Not in the RefDocs at all. Largest single latency win available._

### A2 · `Set-Cookie` disables the edge cache — the biggest landmine
Vercel's CDN **refuses to cache any response carrying `Set-Cookie`**, and any
request carrying `Authorization`. `@supabase/ssr` session-refresh middleware
sets auth cookies on every response it touches. Route the board through it and
`s-maxage=4` becomes decorative: every viewer invokes a function, and doc 03's
whole "viewer count is irrelevant to your bill" thesis collapses — silently,
with no error anywhere.

Three-part fix, binding on Phases 3 and 5:

1. `middleware.ts` matcher **explicitly excludes** `/api/poll/:id/board`,
   `/api/poll/:id/messages`, `/og/*`.
2. Those handlers build an anon Supabase client from `NEXT_PUBLIC_*` keys only.
   They never read or write cookies.
3. Headers — targeted cache-control so the CDN caches but the browser doesn't,
   since each client poll must actually reach the edge:
   ```
   Cache-Control:     public, max-age=0
   CDN-Cache-Control: public, s-maxage=4, stale-while-revalidate=10
   ```

Gate 5 asserts `x-vercel-cache: HIT`. Not "it felt fast".

Related: Vercel's CDN is **segmented per region**, so "one invocation per 4s"
holds *per edge region*. Fine for India-first, but don't be surprised by the
usage graph.

_Supersedes doc 03 "Finding 2" and doc 07 §5.2, which give the header but not
the middleware constraint that makes it work._

### A3 · Rank computed at read time; movement uses a snapshot window
- **Drop the `rank` column.** Compute per request with
  `row_number() over (order by vote_count desc, created_at)`. Always correct,
  never drifts, no write amplification.
- Keep `rank_snapshot` + `snapshot_at` on `options`. The board handler rewrites
  the snapshot only when `now() - snapshot_at > 60s`. Badge =
  `rank_snapshot - current_rank`.

The RefDocs diff against `prev_rank` and write it back on every board hit. That
handler runs every ~4s, so a ▲2 badge would appear and vanish inside one cache
window — the prototype shows persistent badges.

_Supersedes doc 03 schema (`options.rank`, `options.prev_rank`) and doc 07 §5.5._

### A4 · `device_id` is indexed, not unique
Every vote is authenticated — doc 04 FLOW B forces Google sign-in before the
vote lands — so `unique(poll_id, user_id)` is already the real guard. The
device unique index adds nothing and breaks the shared-laptop case, which is
common on an Indian campus: user A votes, signs out, user B signs in →
`ALREADY_VOTED`.

`device_id` stays as a fraud **signal** for velocity flagging, which is what
doc 02 §9 ("flag, don't block") actually asks for.

_Supersedes `create unique index on votes (poll_id, device_id)` in doc 03._

### A5 · Apple Color Emoji is not shippable
Docs 01 and 05 call for bundling it as an `@font-face` fallback. It is
proprietary and licensed only for use on Apple hardware; redistributing it as a
webfont is a licence violation. It is also ~50MB, which would end the LCP
budget on its own.

v1 uses the system emoji stack. If cross-platform divergence proves to matter,
the ~25 meaningful glyphs become inline **Twemoji SVG** (CC-BY 4.0) — a few KB,
identical everywhere, and `aria-label` keeps working. Decided at Phase 4.

_Supersedes doc 01 "iOS emoji everywhere / SBIX fallback" and doc 05 §2._

### A6 · Assorted, recorded so they aren't rediscovered
- `cast_vote()` is `security definer` with no `search_path` in doc 03 — a
  privilege-escalation hole. Must be
  `security definer set search_path = public, pg_temp`, `execute` revoked from
  `public` and granted to `authenticated`.
- Hobby cron jobs have a **10s timeout** (not in the RefDocs).
  `/api/cron/ping` does one trivial query, nothing else.
- Hobby **Fast Origin Transfer is 10GB/mo** — tighter than the 100GB bandwidth
  figure doc 03 leans on. Only cache misses count, so board JSON stays lean: no
  joins, no voter names in that payload.
- Vercel Hobby forbids commercial use, and a Hobby account cannot connect to
  org-owned Git repos. `tarunkauxhik/MaxPoll` is personal → fine. Production
  stays `PAYMENTS_MODE=coming_soon`, which the docs already require anyway.
- Rate limiting: no free Redis. Do it in Postgres inside the same
  `security definer` RPC as the write it guards. One extra row, no new service.

---

## D — Build decisions

### D1 · No Tailwind, no shadcn/ui
Doc 07 §1 specifies both. Declined.

The two HTML prototypes are the declared visual source of truth and are ~400
lines of bespoke CSS. Re-expressing that as utility classes is exactly where
visual drift creeps in, and shadcn would pull in Radix primitives for
components the prototypes already define by hand. Plain CSS ports the
prototype character-for-character, ships less JS, and gives the best LCP on
Indian 4G.

Radix will still be added for **one** thing when it's needed: an accessible
bottom sheet (focus trap, Esc, scroll lock) in Phase 4. Hand-rolling a correct
focus trap is not the lazy option.

### D2 · Bottom nav → left rail via media query only
One component, one DOM tree, one media query in `globals.css`. No JS
breakpoint, no resize listener, no duplicated markup to drift apart.

Doc 05 §3 sets the breakpoint at 768px; the ui-ux-pro-max guidance suggests
1024px for sidebar adoption. Kept 768px — it's the spec, and at 480px content
width there's nothing to gain from the extra 256px.

### D3 · Nav icons are inline SVG, not text glyphs
The prototypes use `◆ ◇ + ○` as nav icons. Those are font-dependent, can't be
stroked or sized as a system, and render differently on every Android. Four
hand-written 24×24 SVGs, ~40 lines, rather than a `lucide-react` dependency for
four glyphs.

Emoji **inside content** (`🗳️ 340 votes`, `⏳ 4h left`) stays exactly as
specified — that's a label, not a control.

### D4 · No dependency before the phase that needs it
Phase 1 ships with only Next and React. Supabase arrives in Phase 2, Radix in
Phase 4, Razorpay in Phase 7, vitest when there's a pure function worth testing.

### D5 · Supabase CLI is a devDependency; Vercel CLI isn't installed
- **Supabase CLI** → `pnpm add -D supabase`, run as `pnpm supabase`. Pins the
  version in the repo so migrations are reproducible. pnpm's content-addressable
  store dedupes it across projects, so "project-local" costs nothing on disk.
- **Vercel CLI** → not installed. Deploys happen on `git push`; the rare one-off
  runs via `pnpm dlx vercel`, leaving nothing behind.
- **Local Supabase stack** (`supabase start`) → deliberately unused despite
  Docker being present. It pulls ~4GB of images. The hosted free project plus
  `supabase link` / `db push` saves that and tests against the real thing.
- **Python** → not installed. The ui-ux-pro-max skill ships a Python search
  script, but its data is plain CSV and is read directly.

### D6 · `.num` on every number, always
Not a style preference. Proportional digits change width as counts tick, so
rows jitter during the count-up animation. `font-variant-numeric: tabular-nums`
is the fix, and it's the single most common tell of a cheap live leaderboard.

### D7 · `TopBar` takes a `right` slot
Doc 05 §3 puts an activity bell in the top bar on every signed-in screen. There
is no auth and no activity yet, so shipping the button now means shipping dead
UI. A slot costs one prop and Phase 7 fills it.
