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

### A5 · *(removed)*
Ruled out bundling Apple Color Emoji, then reversed by D13, then made moot when the
UI was rebuilt — see D15. Nothing here is still true; the ID is kept so A6's
references from the migrations don't shift.

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

The face changed in D15 — `.num` is Inter now, not Space Mono — but the rule and the
reason are untouched. Inter ships real tabular figures, so the guarantee is the same
with one font file fewer.

### B7 · `TopBar` takes a `right` slot
The design puts an activity bell in the top bar on every signed-in screen. There is
no auth and no activity yet, so shipping the button now means shipping dead UI. A slot
costs one prop and Phase 7 fills it.

### B8 · The reference drafts were absorbed and deleted
`RefDocs/` held eight markdown drafts and two HTML prototypes. All of it now lives in
`docs/`, and the directory is gone.

Two sources of truth is how specs rot — the drafts already contradicted the
corrections in §A, and a future session reading the wrong file would undo work. Git
history keeps the originals recoverable (`git show 85297c2 -- RefDocs/`).

The prototypes' CSS was ported verbatim into `app/globals.css` and stayed there,
through three retints, until D15 rebuilt it. **`app/globals.css` is the visual source
of truth**; [04-design.md](04-design.md) explains it and does not outrank it.

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

### C1 · Contrast is measured, not reasoned about
The specific token values that lived here are gone — they were violet, then teal,
then dark-navy, and are now none of those. **The rule that produced them survives and
is the only part that ever mattered:**

Hand-arithmetic during the original audit caught two of five failing tokens. The other
three surfaced only when the numbers were actually computed. So `pnpm check:contrast`
parses the shipped `globals.css`, checks every pair the design actually uses, and
exits non-zero on failure. It is part of `pnpm check`, so a failing pair cannot reach
a commit.

Its corollary, which has caught a bug in every retint since: **a brand colour is a
surface colour.** The same hue used as text usually fails. Every accent therefore
ships as a family — a fill, a `-text` sibling for when it carries type, a `-soft` for
pill backgrounds, and (since D15, which put light content on dark chrome) an
`-on-dark` for when it sits on the chrome. Never substitute one for another.

Current values and their measured ratios live in D15 and
[04-design.md](04-design.md), not here.

### C1b · `--line` stays low-contrast; form controls get `--line-strong`
`--line` is a decorative separator and does not meet WCAG 1.4.11's 3:1 for UI
component boundaries. Kept anyway: cards are identified by their surface and shadow
rather than their border, and pushing every hairline to 3:1 turns an airy design heavy
for no accessibility gain.

Form controls are the exception — an input's border genuinely *is* what identifies it
as an input, and `.field` sits on `--card` against `--paper`, which is nearly
invisible without one. Those use `--line-strong`, and the gate checks it at 3:1
against both surfaces.

### C2 · OptionRow is a `<button>`, not a clickable div
The prototypes used `<div class="opt">` with `cursor:pointer`. That is unreachable by
keyboard and announces as nothing to a screen reader — for the primary action of the
entire product. It's a real `<button>`.

Same correction for anything else the prototypes drew as a clickable div.

### C3 · Loading, empty and error states exist now
The prototypes are fixed-height frames and have none. All three are required before
any screen ships. Copy comes from [03-ux-flows.md](03-ux-flows.md) — instructions,
never apologies.

### C4 · What a static mockup never has to survive
The originals were drawn at 390px as fixed frames. Four things only surface in a real
scrolling app on a real phone, and all four are still true of the rebuilt UI:

- **Scroll depth** — content sliding under a sticky top bar needs a shadow cue
- **Pressed states** — `transform: scale()` alone is unreliable on Android. Pair it
  with a background change, which is what actually reads as "pressed" on touch
- **360px density** — a long name plus a badge plus a percentage crowds. Every such
  row needs `min-width: 0` and a truncation rule, verified at width, not assumed
- **Focus rings need a variant per surface** — a ring tuned for the page is nearly
  invisible on the dark chrome. D15's two-surface design makes this permanent

### C5 · *(removed)*
Ruled out dark mode, then D12 revised it, then D14 reversed it, then D15 settled on
one light-based theme with dark chrome and no toggle. The ID is kept only so C4's and
C1b's numbering doesn't shift.

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

### D16 · Profiles live at `/u/[handle]`, rewritten from `/@handle`
<!-- Was a second D6. Renumbered in D15's doc pass: the VPA entry below keeps D6
     because .env.example, STATE.md and app/pay/[ref]/page.tsx all cite it. -->

The design specifies `maxpoll.vercel.app/@handle`. In the App Router a folder
starting with `@` is the **parallel-route slot** convention, so `app/@[handle]`
would be a named slot and would never serve a URL — silently.

The page is at `app/u/[handle]`; `next.config.ts` rewrites `/@:handle` → `/u/:handle`.
The public URL is exactly what the design asked for.

### D17 · One `buildFeedPolls()`, and the clock lives in the data layer
<!-- Was a second D7. Renumbered in D15's doc pass. -->

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
### D11–D14 · *(removed)*
Four entries recording the colour churn: violet → teal (D11), chrome-only dark (D12),
bundled Apple-style emoji reversing A5 (D13), whole-site dark navy reversing D12
(D14). All four described a design that no longer exists, and D12/D14 contradicted
each other on the page anyway. Superseded wholesale by D15. `git log docs/DECISIONS.md`
has the text if the reasoning is ever wanted.

The bundled emoji subset from D13 **stays shipped** — `public/emoji/*.png` and
`components/ui/Emoji.tsx` are untouched by the rebuild. Only the entry is gone.

### D15 · The UI was rebuilt: light page, dark chrome, three faces (2026-08-08)

The previous four entries retinted a design without ever redesigning it. Each pass
renamed tokens inside a layout and type system ported verbatim from two HTML
prototypes deleted in Phase 1, so the file accumulated dead rules, light-theme
leftovers stranded inside a dark theme, and a 480px column cap that left a laptop
showing a ribbon in a sea of empty page. The owner asked for the whole thing rebuilt,
mobile-first, working on a laptop, and professional.

**One theme, light-based, with dark chrome.** Not a toggle, not `prefers-color-scheme`
— those double the QA surface, which is what C5 got right even though its conclusion
didn't survive. The page and cards are light; the top bar, the nav, primary buttons,
the timer panel and the hero are near-black navy. The mix is the design: light where
you read, dark where you navigate.

| | |
|---|---|
| page / card / hairline | `#F4F6FA` · `#FFFFFF` · `#E2E7F0` |
| text: primary / body / secondary | `#101828` 16.4:1 · `#3D485C` 8.5:1 · `#59637A` 5.6:1 |
| chrome / raised stop | `#121A2E` · `#1E2942`, 16.0:1 against the page |
| **indigo** — movement, focus, wordmark | `#3B4FD8` fill · `#2E3DAE` text 8.1:1 · `#E9ECFC` soft · `#A9B6FF` on dark 8.9:1 |
| **gold** — rank 1 only | `#C08A0E` fill · `#7E5C07` text 6.1:1 · `#FBF1DA` soft · `#F0BE4A` on dark 10.0:1 |
| **red** — time pressure only | `#D93B20` fill · `#B23018` text 6.3:1 · `#FCE9E4` soft · `#FF9B80` on dark 8.5:1 |
| **green** — rank gain only | `#157F4A` fill · `#0F6B3D` text 6.6:1 · `#E2F5EA` soft |

All 33 pairs pass, computed before a line of CSS was written rather than after. The
tightest is 3.05:1 on a 3:1 floor — `--gold` as the rank-1 card border, which is a UI
boundary, not text. `--muted` sits at 5.6:1, where the previous two themes both had it
as the tightest token in the file.

The accent moved to indigo specifically because it is the *same family* as the chrome.
Teal against navy read as two unrelated colours sharing a page; indigo against navy
reads as one system. Colour jobs are otherwise unchanged from C1: gold is rank 1 only,
red is time only, green is gain only, and nothing gets a colour to decorate.

**Three typefaces, and the constraint is enforced.**

| Face | Token | Weights | Where |
|---|---|---|---|
| Instrument Serif | `--font-display` | **400 only** | `.t-hero`, `.t-title` |
| Lora | `--font-serif` | **400 / 500** | `.t-card`, sheet and card titles |
| Inter | `--font-ui` | 400–800 | everything else, including `.num` |

Instrument Serif ships `400` and `400i` and nothing else — it *cannot* go bold, which
is why it takes the largest type, where a faux-bold serif would have been most
obvious. Lora is variable 400–700 and therefore *can*, so the owner's "don't make Lora
bold" is a check in `scripts/check-contrast.mjs`, not a note in a doc: the script
fails the build if any rule setting `--font-serif` also sets a weight of 600 or more.
Every constraint that has survived in this codebase survived by being executable.

Space Mono is gone. `.num` keeps `font-variant-numeric: tabular-nums` and moves to
Inter, which has real tabular figures — B6's guarantee intact, one font file fewer,
and numbers that look part of the UI instead of bolted onto it. `.wordmark` stays
pinned to Inter 800; a synthetically-bolded serif logotype is worse than a logotype
that doesn't follow the headline face.

**Four breakpoints, not one.** 768px still swaps the bottom nav for a rail (B2 and B3
both still stand — one DOM tree, one media query, no JS). New: at 1024px the rail
becomes a labelled sidebar and card lists go two-column; at 1440px the content caps
and the gutters open. The board, the activity list, the chat and the admin queue stay
single-column at every width — they are ranked or chronological lists, and rank only
reads down one column.

**What this cost, and the lesson that keeps repeating.** Two hardcoded colours had
already survived one retint each by not being `var()` — `.opt.g1`'s gradient ending in
`#fff` and `.lsticky`'s starting from the old paper white — and would have survived
this one too. `app/manifest.ts` had been declaring `#FAFAF7` since the dark theme
shipped, contradicting the viewport's `#0A0E1C` directly under a comment insisting the
two must match. A token rename is never exhaustive: grep raw hex as well, and check
the files that can't read CSS at all (`app/og/**`, `public/icon.svg`,
`app/global-error.tsx`, `app/manifest.ts`).

`docs/04-design.md` was deleted and rewritten at a third the length. Its component
section — per-component pixel specs — is what rotted last time, because it duplicated
the CSS and the CSS moved. The new one records tokens, scale, breakpoints and the
quality floor, and stops there. **`app/globals.css` is the visual source of truth.**
