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
carrying `Authorization`. `@supabase/ssr` session-refresh proxy sets auth cookies
on every response it touches. Route the board through it and `s-maxage=4` becomes
decorative: every viewer invokes a function, and the whole "viewer count is irrelevant
to your bill" thesis collapses — silently, with no error anywhere.

Three-part fix, binding on Phases 3 and 5:

1. `proxy.ts` matcher **explicitly excludes** `/api/poll/:id/board`,
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

_The drafts gave the header but not the proxy constraint that makes it work._

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

### D6 · Profiles live at `/u/[handle]`, rewritten from `/@handle`
The design specifies `maxpoll.vercel.app/@handle`. In the App Router a folder
starting with `@` is the **parallel-route slot** convention, so `app/@[handle]`
would be a named slot and would never serve a URL — silently.

The page is at `app/u/[handle]`; `next.config.ts` rewrites `/@:handle` → `/u/:handle`.
The public URL is exactly what the design asked for.

### D7 · One `buildFeedPolls()`, and the clock lives in the data layer
The home feed, a Space page and a profile each turned poll rows into cards, each
with its own copy of the enrichment and its own `Date.now()`. React 19's purity
rule flagged the clock reads, and following it properly meant extracting the
shared function rather than silencing the rule.

The payoff is bigger than the lint: those three surfaces could previously have
disagreed about whether a poll was closed. Now `isExpired()` decides once.

Same reasoning made `Timer` use `useSyncExternalStore` instead of
`useState` + `useEffect` + a `mounted` flag — the clock is an external mutable
source, which is precisely what that hook is for, and it removes the hydration
mismatch rather than working around it.

### D8 · Gate probes run against the real database, with real sessions
`pnpm gates` is not a unit test. It creates users, votes, merges and pays against
the live project, then deletes everything.

Anonymous probes cannot test the policies that matter. The first version had no
session tokens and every "as a signed-in user" check quietly ran as anon — two
of them **passed for the wrong reason**. Sessions are minted through the admin
API's magic-link flow (secret-key only), and the script now aborts rather than
degrading to anon.

**Rule of thumb worth keeping:** in an RLS probe, `401` means the probe is
broken; `403` is the policy actually refusing an authenticated caller.

### D9 · Seed data is a script, never a migration
`db push` applies every migration, so a seed migration would ship demo content to
production — and we run one project for both (B10). `supabase/seed.sql` is applied
on demand by `scripts/sql.mjs` and removed with `pnpm sql --wipe`.

It votes through `cast_vote()` rather than inserting counts, so the seed exercises
the same path production does. A seed that wrote `vote_count` by hand would mask
exactly the bug Gate 4 exists to catch.

`pg` is a devDependency for this and nothing else; no application code imports it.

### D2c · A `security definer` function must not take the caller's identity as an argument

`cast_vote(p_poll, p_option, p_device, p_user)` inserted `user_id = p_user`, straight
from a parameter. The function is `security definer`, so RLS never ran — the
`votes_insert` policy (`auth.uid() = user_id`) looked like the guard and was dead
code. `profiles` is public-read by design, so any signed-in account could harvest
uuids and post:

```
rpc/cast_vote { p_poll, p_option, p_device, p_user: <anyone's uuid> }
```

The vote landed under that person's id **with the counters incremented**. One account
could drive any leaderboard to any result, bounded only by the number of registered
users — the unique index stops a second vote per victim, not the first. On a public
voting product that is the whole product.

Verified against the live database before the fix, and again after: the same request
now stores the *caller's* id. The function reads `coalesce(auth.uid(), p_user)`, so a
session always wins and the parameter survives only for the paths that legitimately
have none — `seed.sql` and the admin scripts, which connect as the owner.

**The rule:** a definer function is the security boundary. Anything it accepts as an
argument is attacker-controlled. Identity comes from `auth.uid()`, always.

### D2d · If the rule matters, it lives in the database

`chat/actions.ts` trimmed bodies to 300 chars; `option-actions.ts` refused closed and
locked polls. Both real, both bypassable — the policies behind them only asked
*are you you?*, and the publishable key ships to every browser by design. So
`POST /rest/v1/messages` with a 10MB body, at any rate, was one curl away, as was
adding options to a poll the UI had locked.

`send_message()` and `add_option()` now hold those rules, `INSERT` is revoked on
`messages`, `options` and `votes`, and the Server Actions are what they should always
have been: input trimming and error copy. The check-then-insert in `addOption` was
also a race — two submits could both read `option_count = 59`. The function takes a
row lock instead.

This is D2b generalised. That entry said *every client-writable table with a status
column* has the shape; the truth is broader — **every client-writable table does**.
A Server Action is one door, never the only one.

### D2e · Column grants on every client-writable table, not just `orders`

D2b applied column grants to `orders` and called *"every client-writable table with a
status column"* a class of bug. The class was wider. `polls_update` and
`options_update` were scoped by row (`auth.uid() = created_by`) and said nothing about
columns, so a poll's own creator could:

```
PATCH /rest/v1/polls?id=eq.<own>    {vote_count: 99999}         -> 204, persisted
PATCH /rest/v1/options?id=eq.<own>  {vote_count: 4242}          -> 204, persisted
PATCH /rest/v1/options?id=eq.<own>  {hidden: false}             -> un-hides a
                                       row three reporters had auto-hidden
POST  /rest/v1/spaces               {is_verified: true}         -> 201, tick granted
POST  /rest/v1/polls                {...}                       -> 201, past
                                       create_poll and its 3-per-week limit
```

The board reads exactly those denormalised counters, so the first two mean a creator
could fabricate the entire result of their own poll — on a product whose whole promise
is that the leaderboard is real. All five were verified live before being fixed.

**No application code writes any of those columns.** There is no poll-edit screen and
no profile-edit screen; `create_poll`, `create_space`, `cast_vote`, `merge_options`
and `snapshot_ranks` are `security definer`, as are both `bump_*` triggers. So the fix
is a revoke rather than a narrower grant, and the tables become insert-once from the
client's side.

**When a dead policy stays and when it goes.** Keep it where a legitimate client path
exists but is routed through an RPC — `messages_insert`, `options_insert`,
`votes_insert` — because it documents intent and a careless future `grant` still fails
closed. Drop it where the operation should never come from a client at all. Leaving
`polls_update` in place would have said creators may edit polls, and the next person
to add a grant would have believed it.

### D2f · The activity feed is written by the database, so it can be trusted

`activity_insert` was `WITH CHECK (true)` — any signed-in user could write any
notification into anyone's feed, with arbitrary `payload` jsonb that the feed renders.
Verified live with `{poll_title: "Tap to claim ₹500"}` landing in a victim's feed.

It was permissive because the feature needs it: a `new_follower` row belongs to the
person being *followed*, so a client writing its own activity can never be restricted
to `auth.uid() = user_id`. The answer is not a cleverer policy but a different writer.
`same_as_you` now comes from `cast_vote()`, `option_climbed` from `snapshot_ranks()`,
`new_follower` from a trigger on `follows` — and INSERT is revoked. The only column a
client may still write is `read`, on its own rows.

**`same_as_you` stores no count.** Storing one means writing to every co-voter's row on
every vote — N writes on the hottest path in the product. `same_as_you_names()`
computes the count and the two visible names together at read time, in the query
`/activity` already runs, so the number is also never stale.

### D6 · Phase 1 collects on a personal VPA, knowingly

`NEXT_PUBLIC_UPI_VPA=tarunkaushikraya@oksbi` is a **personal** handle, not the PhonePe
for Business VPA [07-setup.md](07-setup.md) §4 specifies. It ships anyway, as a
deliberate trade: payments work today at zero cost, and the swap to a business VPA is
one environment variable with no code change.

What it costs, stated plainly so nobody rediscovers it as a surprise:

- **Every payer sees the operator's legal name.** We send `pn=MaxPoll` in the `upi://`
  intent, but UPI apps display the name resolved from the VPA at the bank, so `pn` does
  not override it. §4.1's "your personal name is hidden" is not true on this path.
- Sustained business collection on a personal handle is P2P misuse under NPCI norms,
  and personal handles carry P2P limits.

Mitigation is one sentence on `/pay/[ref]`, in the existing `.discl` line, saying the
payment lands in an individual's account. An unexplained personal name on a payment
screen is the most likely reason a ₹9 purchase gets abandoned — naming it up front
costs nothing and removes the "is this a scam?" beat.

**Reversing this is one env var and deleting that sentence.** Do it the day PhonePe
Business is approved.

### D7 · The domain is `viratkohli.tech`, against advice

Recorded because it was a decision and not an accident, and because the reasoning
matters more than the outcome if it has to be revisited.

The risks were put before the call and accepted: `viratkohli.tech` is the name of a
living public figure with registered Indian trademarks. Indian courts have repeatedly
granted personality-rights injunctions to celebrities (Amitabh Bachchan, Anil Kapoor,
Jackie Shroff); `.tech` is UDRP-bound and a domain that is exactly a famous person's
name, used commercially, is close to the textbook bad-faith case; and Google's OAuth
policies prohibit apps that misrepresent affiliation, which "MaxPoll served from
viratkohli.tech" invites.

**The cost if it has to move** is not just a DNS change: Vercel domains, the Supabase
Site URL and redirect allowlist, Google's authorised domains and JavaScript origins,
the Search Console verification, `NEXT_PUBLIC_SITE_URL` and `metadataBase` all point
at it — and every WhatsApp share already in the wild keeps pointing at the old host.
Nothing in the code hardcodes it, which is the one thing that makes a move survivable.

### D10 · Person polls take free-text questions (2026-08-07, reverses 03-ux-flows §D)

The preset-only adjective list was the single *preventive* control against a person
poll becoming a bullying tool; `01-product` rates that risk High. The owner chose
free text with the trade-off stated. The remaining controls are **reactive**: the
report button, the 3-report auto-hide, and the `/admin` moderation queue.

If abuse appears, the cheapest re-hardening is a server-side blocklist in
`create_poll()` — not putting the dropdown back.

**The ₹99 pass now also lifts the 3-per-week poll cap.** `entitlements.kind =
'sub_monthly'` grants two things, both checked in the database: unlocked voter
names on every poll (`hasEntitlement()`) and no weekly poll limit (`create_poll()`).
Not a new grant — `/p/[slug]/unlock` already advertised "unlimited creating" as
part of the pass; `create_poll()` just didn't enforce it yet.

### D11 · Violet → teal (2026-08-08)

The brand accent moved from violet (`#6B4EFF`) to a deep teal (`#0B6169`), the
owner's choice over cobalt and copper — "purple reads as AI slop." Same job as
before — movement, plus the small set of soft-pill badge reuses it already
had. All violet selectors in `app/globals.css` (tokens, focus rings, buttons,
badges, the gap line, the `NEW` badge, Space/profile accents, chat's anon
handle colour), 2 raw-rgba spots (`--grad-glow`, `.act.same`), the OG colour
map (`app/og/shared.tsx`, `app/og/s/[slug]/route.tsx`), and the 4
`scripts/check-contrast.mjs` pairs were renamed together, not left
half-migrated. The new hue has more headroom than violet did (6.86:1 vs
violet's 4.33:1 that D1/C1 already had to work around on `--paper`), which is
what let D12's paper retint happen safely.

`docs/04-design.md` still describes violet throughout — that document already
lagged behind several other Phase 16/17 changes (old font names, a removed
anon toggle, removed follower counts) before this one. `app/globals.css`
remains the enforced source of truth per CLAUDE.md; the design doc was not
part of this rename's scope.

### D12 · Structural chrome goes dark; "no dark mode" revised, not reversed (2026-08-08)

Still true: no toggle, no black cards/forms/board. What changed: the top bar
and bottom nav — present on every signed-in screen via `AppShell` — now
render on `--dark`/`--grad-ink` instead of a light translucent blur, and
`--paper`/`--line`/`--line-strong` got a modest warm retint (`#FAFAF7` →
`#F5F2EA`). Cards, forms, the board, sheets, and legal text are untouched —
confirmed by reading each, not assumed.

Everything that lived inside the now-dark bars needed an explicit override,
because "the top bar is dark" doesn't just mean the background — it means
every child that assumed a light one: `.top .wordmark i` (teal-as-text was
2.6:1 on `--dark`, fails — forced to `--on-dark` specifically on this
surface, the logged-out `.lnav` wordmark on `--paper` is untouched),
`.top .bell` and `.bell .dot`'s ring colour (`ActivityBell`, found by reading
what `TopBar`'s `right` slot actually renders — `Feed.tsx`), `.top h1`/`h2`
(unused today, but latent), and `.nav a`/`.nav a[aria-current]`. `.nav
.create .ic` — already dark from Phase 16 — gained a 1px light border so it
still reads as a raised tile now that the bar around it is dark too.

Real contrast run: `--muted` on the new `--paper` is 4.71:1 — the tightest
margin of any unchanged token, and the ceiling on retinting `--paper` any
further without a matching `--muted` change.

### D13 · Bundled Apple-style emoji, reversing A5 (2026-08-08)

A5 ruled out bundling Apple Color Emoji as a webfont — proprietary, and the
full set is large. The owner's explicit choice reverses that, knowingly:
"only iOS emoji, regardless of Android or iOS" was worth the same legal grey
area A5 flagged, because a Gen Z audience notices when emoji look wrong on
Android more than they'd ever notice licensing.

What actually shipped is narrower than a webfont. `emoji-datasource-apple`
(npm, MIT-licensed data/glue code — confirmed current on the registry before
using it, not assumed from training data) ships every Apple emoji PNG,
102MB unpacked. A fresh grep for `\p{Extended_Pictographic}` across `app/`
and `components/` found 28 distinct characters actually used in the UI. Only
those 28 PNGs (64px, ~188KB total) were extracted into `public/emoji/` —
the npm package itself was never added as a project dependency, just used
once as a source to copy from. `lib/emoji.ts` maps each character to its
filename; `<Emoji char="🔥" />` renders the PNG, falling back to the system
glyph if a character is ever used without a matching entry.

The system emoji stack (`"Apple Color Emoji", "Segoe UI Emoji", "Noto Color
Emoji"`) stays as a fallback for emoji inside *user content* — poll titles,
chat messages — which `<Emoji>` doesn't touch and isn't meant to: rendering
someone's typed text through a curated 28-glyph map would silently drop any
emoji outside that set. `app/og/**` also stays on the system stack — Satori
can't render `<Emoji>`'s `<img>` the same way OG images already avoid custom
fonts by design (see `app/og/shared.tsx`).
