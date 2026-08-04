# Decisions

Why things are the way they are. **Where this file conflicts with any other doc, this
file wins.**

Format: what was decided · why · what it supersedes.

---

## A — Platform corrections (verified 2026-08-04)

The original spec drafts made several claims that didn't survive checking against the
providers' own documentation. These are the corrections.

### A1 · Functions run in Mumbai (`bom1`)
`vercel.json` pins `"regions": ["bom1"]`.

Vercel Hobby runs **all functions in one region, defaulting to `iad1`** (Virginia).
Supabase is in Mumbai. Left alone, every uncached query crosses the Atlantic twice —
roughly +250ms against a <200ms TTFB budget. Hobby permits exactly one region, so
this costs nothing.

_Absent from the original drafts. Largest single latency win available._

### A2 · `Set-Cookie` disables the edge cache — the biggest landmine
Vercel's CDN **refuses to cache any response carrying `Set-Cookie`**, and any request
carrying `Authorization`. `@supabase/ssr` session-refresh middleware sets auth cookies
on every response it touches. Route the board through it and `s-maxage=4` becomes
decorative: every viewer invokes a function, and the whole "viewer count is irrelevant
to your bill" thesis collapses — silently, with no error anywhere.

Three-part fix, binding on Phases 3 and 5:

1. `middleware.ts` matcher **explicitly excludes** `/api/poll/:id/board`,
   `/api/poll/:id/messages`, `/og/*`.
2. Those handlers build an anon Supabase client from `NEXT_PUBLIC_*` keys only. They
   never read or write cookies.
3. Targeted cache-control, so the CDN caches but the browser doesn't — every client
   poll must actually reach the edge:
   ```
   Cache-Control:     public, max-age=0
   CDN-Cache-Control: public, s-maxage=4, stale-while-revalidate=10
   ```

Gate 5 asserts `x-vercel-cache: HIT`. Not "it felt fast".

Related: Vercel's CDN is **segmented per region**, so "one invocation per 4s" holds
*per edge region*. Fine for India-first.

_The drafts gave the header but not the middleware constraint that makes it work._

### A3 · Rank computed at read time; movement uses a snapshot window
- **No `rank` column.** Computed per request with
  `row_number() over (order by vote_count desc, created_at)`. Always correct, never
  drifts, no write amplification.
- `options` carries `rank_snapshot` + `snapshot_at`. The board handler rewrites the
  snapshot only when `now() - snapshot_at > 60s`. Badge = `rank_snapshot - current_rank`.

The drafts diffed against `prev_rank` and wrote it back on every board hit. That
handler runs every ~4s, so a ▲2 badge would appear and vanish inside one cache window
— but the design calls for persistent badges.

### A4 · `device_id` is indexed, not unique
Every vote is authenticated — the vote flow forces Google sign-in before the vote
lands — so `unique(poll_id, user_id)` is already the real guard. A unique device
index adds nothing and breaks the shared-laptop case, common on an Indian campus:
user A votes, signs out, user B signs in → `ALREADY_VOTED`.

`device_id` stays as a fraud **signal** for velocity flagging, which is what
"flag, don't block" actually needs.

### A5 · Apple Color Emoji is not shippable
The drafts called for bundling it as an `@font-face` fallback. It is proprietary,
licensed only for use on Apple hardware; redistributing it as a webfont is a licence
violation. It is also ~50MB, which would end the LCP budget on its own.

v1 uses the system emoji stack. If cross-platform divergence proves to matter, the
~25 meaningful glyphs become inline **Twemoji SVG** (CC-BY 4.0) — a few KB, identical
everywhere, and `aria-label` keeps working. Decided at Phase 4.

### A6 · Assorted, recorded so they aren't rediscovered
- `cast_vote()` had no `search_path` on a `security definer` function — a
  privilege-escalation hole. Now `set search_path = public, pg_temp`, `execute`
  revoked from `public`, granted to `authenticated`.
- Hobby cron jobs have a **10s timeout**. `/api/cron/ping` does one trivial query.
- Hobby **Fast Origin Transfer is ~10GB/mo** — tighter than the 100GB bandwidth
  figure the drafts leaned on. Only cache misses count, so board JSON stays lean: no
  joins, no voter names.
- Vercel Hobby forbids commercial use and cannot connect to org-owned Git repos.
  `tarunkauxhik/MaxPoll` is personal → fine. Production stays
  `PAYMENTS_MODE=coming_soon`, which is required for that reason as well as the
  product one.
- Rate limiting: no free Redis. Done in Postgres inside the same `security definer`
  RPC as the write it guards. One extra row, no new service.

---

## B — Build decisions

### B1 · No Tailwind, no shadcn/ui
The drafts specified both. Declined.

The design is ~400 lines of bespoke CSS. Re-expressing that as utility classes is
exactly where visual drift creeps in, and shadcn would pull in Radix primitives for
components already defined by hand. Plain CSS ships less JS and gives the best LCP on
Indian 4G.

Radix is added for **one** thing when needed: an accessible bottom sheet (focus trap,
Esc, scroll lock) in Phase 4. Hand-rolling a correct focus trap is not the lazy option.

### B2 · Bottom nav → left rail via media query only
One component, one DOM tree, one media query. No JS breakpoint, no resize listener,
no duplicated markup to drift apart. Breakpoint 768px per the design spec.

### B3 · Nav icons are inline SVG, not text glyphs
The prototypes used `◆ ◇ + ○` as nav icons — font-dependent, unstyleable as a system,
and rendering differently on every Android. Four hand-written 24×24 SVGs (~40 lines)
rather than a `lucide-react` dependency for four glyphs.

Emoji **inside content** (`🗳️ 340 votes`, `⏳ 4h left`) stays exactly as specified —
that's a label, not a control.

### B4 · No dependency before the phase that needs it
Phase 1 shipped with only Next and React. Supabase arrives in Phase 2, Radix in
Phase 4, Razorpay in Phase 7, a test runner when there's a pure function worth testing.

### B5 · Supabase CLI is a devDependency; Vercel CLI isn't installed
- **Supabase CLI** → `pnpm add -D supabase`, run as `pnpm supabase`. Pins the version
  in the repo so migrations are reproducible. pnpm's content-addressable store dedupes
  it across projects, so project-local costs nothing on disk.
- **Vercel CLI** → not installed. Deploys happen on `git push`; one-offs run via
  `pnpm dlx vercel`, leaving nothing behind.
- **Local Supabase stack** (`supabase start`) → deliberately unused despite Docker
  being present. It pulls ~4GB of images. The hosted free project plus
  `supabase link` / `db push` saves that and tests against the real thing.
- **Python** → not installed. The ui-ux-pro-max skill ships a Python search script,
  but its data is plain CSV and is read directly.

### B6 · `.num` on every number, always
Not a style preference. Proportional digits change width as counts tick, so rows
jitter during the count-up animation. `font-variant-numeric: tabular-nums` is the fix,
and it's the single most common tell of a cheap live leaderboard.

### B7 · `TopBar` takes a `right` slot
The design puts an activity bell in the top bar on every signed-in screen. There is
no auth and no activity yet, so shipping the button now means shipping dead UI. A slot
costs one prop and Phase 7 fills it.

### B8 · The reference drafts were absorbed and deleted
`RefDocs/` held eight markdown drafts and two HTML prototypes. All of it now lives in
`docs/`, and the directory is gone.

Two sources of truth is how specs rot — the drafts already contradicted the
corrections in §A, and a future session reading the wrong file would undo work. The
prototypes' CSS was already ported verbatim into `app/globals.css`, so
**`globals.css` + [04-design.md](04-design.md) are the visual source of truth.**
Every numeric value the HTML held is recorded in `04-design.md`, and git history keeps
the originals recoverable (`git show 85297c2 -- RefDocs/`).

### B9 · New Supabase API keys, not the legacy ones
Supabase replaced `anon` / `service_role` JWT keys with `sb_publishable_…` /
`sb_secret_…`, and **the legacy keys are deprecated at the end of 2026**. Starting a
project in August 2026 on keys that expire in four months is pure rework.

`@supabase/ssr`'s `createServerClient` accepts a publishable key directly — a drop-in
string swap. One caveat that would silently break a hand-rolled call: new keys must be
sent on the **`apikey` header**, never `Authorization: Bearer`. `supabase-js` handles
this; raw `fetch` against the REST API would not.

Env var names follow the new convention: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
`SUPABASE_SECRET_KEY`.

### B10 · One Supabase project for dev and production
Free allows two active projects. We use one.

Half the allowance, one migration path, nothing to keep in sync — correct for a solo
pre-launch project. A second would double the pausing risk and require every migration
applied twice. Before real users arrive, `pnpm supabase db dump` is the snapshot that
makes a bad migration recoverable, since the free plan has no backups.

Revisit when there are real votes worth protecting from a dev mistake.

### B11 · Vercel connected at Phase 1, not Phase 8
The drafts deferred deployment to the end. Connected immediately instead.

A2 — the cache landmine — **cannot be verified locally**; `x-vercel-cache` has no
local equivalent, and neither does the function region pin or cron. Deferring means
discovering a deploy-time problem on ship day. Eight gate pushes is nothing against
Hobby's 100 deployments/day.

---

## C — Design corrections

### C1 · Five colour tokens failed WCAG AA and were changed

| Where | Was | Ratio | Now | Ratio |
|---|---|---|---|---|
| `--muted` on `--paper` | `#8A8A94` | **3.27:1 ✗** | `#6B6B75` | 5.04:1 ✓ |
| violet as text on `--violet-soft` | `#6B4EFF` | **4.33:1 ✗** | `--violet-text: #5B3EE8` | 5.46:1 ✓ |
| `--up` as text (▲ badge) | `#0E8A4F` | **3.94:1 ✗** | `--up-text: #0A7442` | 5.23:1 ✓ |
| `--heat` as text (▼ badge, time chip) | `#E8452C` | **3.45:1 ✗** | `--heat-text: #C2321C` | 4.87:1 ✓ |
| `--gold-text` on `--gold-soft` | `#9A6E05` | **4.44:1 ✗** | `#8F6605` | 5.03:1 ✓ |

All five came from the design drafts and had been carried forward unquestioned.
`--muted` alone carries nearly all secondary text — sublines, nav labels, timestamps
— so a failure there is a failure almost everywhere.

**The brand colours are unchanged.** `#6B4EFF`, `#F5B324`, `#E8452C` and `#0E8A4F`
are still the fills, live dot, timer ring and bars, because those are *surfaces*.
Each now has a `-text` sibling for when the same colour carries type. Never
substitute one for the other. No colour's *job* changed: gold is still rank 1 only,
violet movement only, red time only.

**This is now enforced, not remembered.** `pnpm check:contrast` parses the shipped
`globals.css` and checks all 17 pairs, exiting non-zero on failure. It's part of
`pnpm check`. Hand-arithmetic during the audit caught only two of the five — the
other three surfaced when the numbers were actually computed. Measure, don't reason.

### C1b · `--line` stays low-contrast; form controls get `--line-strong`
`--line` (#E6E5E0) is 1.21:1 on paper, which fails WCAG 1.4.11's 3:1 for UI component
boundaries. Kept anyway: it's a decorative separator, and cards are identified by
their surface and shadow rather than their border.

Form controls are the exception — an input's border genuinely *is* what identifies it
as an input, and `.field` sits on `--card` against `--paper` (1.02:1, invisible
without a border). Those use `--line-strong` (#8F8E87, 3.14:1).

Pushing every hairline to 3:1 would turn a deliberately light, airy design heavy for
no accessibility gain.

### C2 · OptionRow is a `<button>`, not a clickable div
The prototypes used `<div class="opt">` with `cursor:pointer`. That is unreachable by
keyboard and announces as nothing to a screen reader — for the primary action of the
entire product. It's a real `<button>`.

Same correction for anything else the prototypes drew as a clickable div.

### C3 · Loading, empty and error states exist now
The prototypes are fixed-height frames and have none. All three are required before
any screen ships. Copy comes from [03-ux-flows.md](03-ux-flows.md) — instructions,
never apologies.

### C4 · Refresh pass — what static mockups never had to survive
Drawn at 390px as fixed frames. These only surface in a real scrolling app on a real
phone:

- **Scroll depth cue** — content slid under the blurred top bar with no shadow
- **Pressed states** — `transform: scale()` alone is unreliable on Android; now paired
  with a background change, which is what actually reads as "pressed" on touch
- **360px density** — a long name + badge + percentage crowds. Truncation rule now
  documented and verified
- **Elevation scale** — one `--shadow` token plus a bespoke sheet shadow became
  `--shadow-1` / `--shadow-2`
- **Spacing scale** — `--s-1`…`--s-6` (4/8/12/16/24) for layout rhythm and all new
  components. **Component-internal padding stays as drawn** — those are deliberate
  optical choices and retrofitting them is exactly the drift being avoided
- **Focus ring on dark surfaces** — a violet ring on `--ink` is nearly invisible; dark
  surfaces get a light variant

### C5 · No dark mode in v1
The original reasoning holds: it's a scoreboard, paper reads better than dark for
ranked data, and light is cheaper to render on budget Android. Adding it roughly
doubles token and QA work, and every gate after would test two themes.

Revisit post-launch with real usage data, not assumptions.

---

## D — Payments (decided 2026-08-04, supersedes the Razorpay-first drafts)

### D1 · Manual UPI ships first; Razorpay is the later rail
Phase 1 collects money over a PhonePe-for-Business VPA: the payer sends ₹9 from
their own UPI app, submits the 12-digit UTR, and an admin matches it against the
merchant app before access unlocks.

**Zero MDR** — ₹9 nets ₹9 against ₹8.79 through Razorpay — and, more to the point,
no gateway integration, no webhook signature surface, and no KYC waiting period
between "idea" and "someone can pay me". The cost is a human in the loop, which is
the right trade at launch volume. Razorpay's mode values are reserved in the enum
and its test keys sit unused; the switch is [05-payments.md](05-payments.md) §5 and
changes nothing about access control.

**Flagged and overridden:** Vercel Hobby forbids commercial use, and manual UPI is
commercial use exactly as much as Razorpay was — the rail switch does not change
that. Production ships live anyway, deliberately. If enforced, the penalty is
project suspension, not a warning. Code still defaults to `coming_soon`, so going
live is an env var set on purpose rather than something a bad deploy can flip.

### D2 · `orders` is the ledger, `entitlements` is the grant
Two tables, and `verify_order()` is the only bridge between them.

The tempting shortcut is to let the payment row *be* the access row. Declining it is
what let the entire payment rail change without touching `votes_read_entitled` —
the policy that actually protects voter names — and it is why Razorpay will later
write only entitlements and need no second access path. It also keeps a *rejected*
order distinguishable from one that never existed, which the payer-facing screen
needs.

`entitlements.razorpay_payment_id` accordingly became `source` + `payment_ref`, with
the unique index on the pair. `source='comp'` hand-grants access without inventing a
fake payment.

### D2b · RLS chooses rows; column grants choose columns
`orders` has an update policy scoped to `status = 'pending'`, which looks sufficient
and is not. A policy says *which rows* you may touch, nothing about *which columns* —
so a payer could flip their own pending ₹99 order to `kind='poll_unlock'` and pay ₹9
for it, or write `amount_paise = 1` and have the admin queue cheerfully print
"₹1 expected".

Two fixes, both in the database:
- `amount_paise` is a **generated column** off `kind`. Not passed in, not writable.
- `revoke insert/update on orders`, then re-grant only the columns a payer may
  author: `(user_id, poll_id, kind, contact)` on insert, `(utr, contact, status,
  submitted_at)` on update.

Caught by reading the policy back before applying, not by a test. Worth remembering
as a class of bug: *every* client-writable table with a status column has this shape.

### D3 · Admin is an env allowlist, not an `is_admin` column
`ADMIN_USER_IDS=<uuid>,<uuid>`. A column is a row, and rows can eventually be
written; an env var can only be changed by a deploy. Adding an admin means editing
an env var and redeploying, which for a solo project is the right trade.

An empty allowlist means **nobody**, never everybody — tested. A non-admin hitting
`/admin` gets 404, not 403; don't confirm the route exists.

The panel reads orders through the **secret key**, so there is deliberately no admin
`select` policy on `orders`. Other people's orders aren't protected by a policy that
has to be written correctly — they're unreachable because no policy exposes them.

### D4 · ₹99 is a 30-day pass, not a subscription
Manual UPI has no mandate, so auto-renew is impossible, and re-verifying a UTR by
hand every month per subscriber does not scale past about ten people.
`verify_order()` writes `expires_at = now() + 30 days` onto the existing
`sub_monthly` entitlement kind, so the existing RLS expires it correctly with **no
policy change**. The payer re-pays when it lapses.

Real recurring billing is a reason to switch to Razorpay, not a reason to fake it.

### D5 · A test runner arrived, and it is stdlib
B4 said "a test runner when there's a pure function worth testing". Fail-closed
payment mode selection and the admin allowlist are that function. Node 24 runs
TypeScript directly and ships `node:test`, so this cost **zero dependencies** —
`lib/payments.test.mts`, wired into `pnpm check`.

`.mts` rather than `.ts` so Node treats it as ESM without `"type": "module"` in
`package.json`, which would change how Next resolves everything else.
