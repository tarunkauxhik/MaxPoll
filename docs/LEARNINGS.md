# Learnings

Things that cost time, and the verified numbers the architecture depends on. Add here
rather than rediscovering.

---

## A gate that hides the wrong thing deadlocks the loop it was meant to drive

03 §C's state table says: **"Space < 20 members | Board hidden, `12/20 members to
unlock results`"**. The poll page implemented that literally and replaced the whole
`<Board>` with the progress meter.

But "Board" in that cell means the **results**. Two other lines in the same document
say so:

- §B, the critical path: *"Poll page → **tap an option** → logged in, not in Space →
  JOIN SPACE SHEET → vote lands"*
- §I: *"Join: one tap, or **implicit on first vote**"*

A Space is joined **by voting**. So hiding the ballot until 20 members means
`member_count` can never reach 20 — nobody can vote, so nobody can join. The one
link that travels is a poll link, and it landed on a wall.

It survived every automated check. The gates test the database, and the database was
behaving correctly; `pnpm check` compiles a page that renders. Nothing was broken
except the product. **The first real stranger to open a poll found it in a minute.**

Two things fell out of the fix:

- **₹9 for nothing.** The under-list still offered "See the exact names of voters"
  once you had voted, and `/p/[slug]/unlock` had no gate check at all. Under the
  gate an entitlement reveals nothing, so the purchase could not deliver. Both now
  route through `resultsLocked()`.
- **The constant existed four times.** `const UNLOCK = 20` was copy-pasted into
  `/p/[slug]`, `/spaces`, `/s/[slug]` and nowhere near the paywall that needed it.
  Now `lib/space.ts`, with tests — it is a money boundary, so it does not live in
  the `server-only` module it would otherwise belong in.

**The lesson is about reading a spec, not about React.** When one line of a document
says "hide X" and another describes a flow that requires X, the flow wins — a state
table describes a screen, a flow describes the product. Check what the gated thing
*feeds* before gating it.

---

## Phase 1 — scaffold

### `create-next-app` rejects capitalised directory names
The repo lives at `…\projects\MaxPoll`, and create-next-app derives the package name
from the directory:

```
Could not create a project called "MaxPoll" because of npm naming restrictions:
  * name can no longer contain capital letters
```

Scaffolded into a temp dir as `maxpoll` and copied the output in. No behavioural
difference. Next's demo assets (`public/*.svg`, `page.module.css`, `README.md`) were
deliberately not carried over.

### pnpm 11 blocks postinstall scripts and aborts the install
`sharp` and `unrs-resolver` need build scripts; pnpm 11 refuses to run them by default
and then **aborts the whole install** rather than warning. The switch lives in
`pnpm-workspace.yaml`, not `package.json`:

```yaml
allowBuilds:
  sharp: true
  unrs-resolver: true
```

### `create-next-app` shipped 16.2.12, not latest
Even with `@latest` the template pinned an older Next. Explicitly bumped:
`pnpm update next@16.3.0 eslint-config-next@16.3.0`. Worth checking the resolved
version after any scaffold.

### Turbopack no longer needs a flag
In Next 16 it's the default bundler, so `package.json` scripts are plain `next dev` /
`next build` — the `--turbopack` flag from older guides is gone.

### Don't run `pnpm build` while `pnpm dev` is running
On Windows both write to `.next/`, and the file locks collide — the dev server dies
with a bare `[ELIFECYCLE] Command failed with exit code 1` and no explanation. Stop
the dev server first, or run the build in a separate checkout.

### The bottom nav pointed at three routes that didn't exist
`/spaces`, `/create` and `/profile` 404'd, which meant Gate 1 couldn't actually be
verified: the nav's `aria-current` active state has nothing to activate, and the
1440px left-rail check lands on a 404 page that doesn't render `AppShell` at all.
Fixed with three placeholder pages. **A shell whose navigation 404s isn't a shell.**

### `next dev` rewrites CLAUDE.md
It appends an agent-rules block on every run and re-creates it if removed. Committed
rather than fought. `agentRules: false` in `next.config.ts` disables it, but the block
is genuinely useful — Next 16 has breaking changes against most training data.

---

## Provider facts the architecture depends on

Verified **2026-08-04**. Providers move these. **Re-check before launch.**

### Vercel Hobby
- Functions run in a **single region**; default `iad1` (Virginia). Mumbai is `bom1`
- Active CPU **4 CPU-hrs/mo** · Invocations **1M** · Fast Data Transfer **100GB** ·
  Provisioned Memory 360 GB-hrs
- **Fast Origin Transfer only ~10GB/mo** — tighter than bandwidth, and the meter that
  cache *misses* actually consume
- Cron: **once per day maximum** (any sub-daily schedule fails at deploy time),
  **10s timeout**, UTC only, fires anywhere within the scheduled hour
- **CDN will not cache a response carrying `Set-Cookie`**, or a request carrying
  `Authorization`
- **CDN cache is segmented per region** — "one invocation per 4s" is per edge region
- `Cache-Control` without `CDN-Cache-Control`: Vercel strips `s-maxage` and
  `stale-while-revalidate` before the response reaches the browser
- `stale-if-error` and `proxy-revalidate` are **not** supported
- Max cacheable response 10MB (20MB streaming)
- 100 deployments/day, 100 builds/hour, 45min build limit
- **No automatic overage** — a maxed resource pauses that feature until the next cycle
- Non-commercial use only; **cannot connect to org-owned Git repos**

### Supabase Free
- 500MB DB · 5GB egress + 5GB cached egress · 50k MAU · 1GB storage · 500k edge
  function invocations · 200 concurrent realtime connections · 2M realtime messages
- **2 active projects.** Paused projects **don't** count toward that
- **Pauses after ~7 days without database activity.** Visiting the dashboard counts as
  activity, so it won't bite during active development — only after launch quiet
- Restores within **1 year**, data and configuration intact
- **No backups.** `pnpm supabase db dump` is the only undo

### Supabase API keys — changed
`anon` / `service_role` JWT keys are replaced by `sb_publishable_…` / `sb_secret_…`
and **deprecated at the end of 2026**. Found at **Settings → API Keys → Publishable
and secret API keys**.

- `@supabase/ssr`'s `createServerClient` takes a publishable key directly — drop-in
- ⚠️ **New keys must be sent on the `apikey` header, never `Authorization: Bearer`.**
  `supabase-js` does this; a hand-rolled `fetch` against the REST API would break
- ⚠️ Edge Functions don't verify the `apikey` header for new keys — set
  `verify_jwt = false` and authorise in code if we ever use them

### Google Cloud OAuth — renamed
"OAuth consent screen" is now **Google Auth Platform**, split into **Branding /
Audience / Clients / Data Access**. Direct link:
`console.cloud.google.com/auth/clients`.

- The `openid` scope must be **typed into "Manually add scopes"** — it isn't in the
  picker
- A `*.vercel.app` subdomain **cannot be verified** as an authorised domain, so
  publishing to Production isn't possible until there's a real domain. Testing mode
  works fully; only listed test users (up to 100) can sign in

### Supabase enables email+password signup by default — we had to turn it off
A fresh project has the **Email** provider on with `disable_signup: false`. Building
no password UI does **not** close it: `POST /auth/v1/signup` is live, and the
publishable key needed to call it ships in the browser bundle by design.

Verified on the real project, not assumed — a signup with an arbitrary email created
a genuine `auth.users` row (test user deleted immediately afterwards, project back
to zero users).

That directly contradicts the "no password surface" design decision. It's a spam
vector, and it produces accounts that can never complete onboarding. **Turn Email
off in the dashboard**; Google must be the only provider.

Note: Supabase rejects `@example.com` as `email_address_invalid`, so a test that uses
it will pass for the wrong reason and look like the hole is closed.

### UPI
Zero MDR on P2M for small merchants, so ₹9 nets ₹9. The 2026 parliamentary push to
reintroduce MDR is scoped to merchants above ~₹1 crore turnover.

The NPCI linking spec has a **`tr` field** for the merchant's own transaction
reference. Use it. `tn` is a free-text note the payer can edit, so anything read back
as identification must ride `tr`, and the ref must be short and alphanumeric — a UUID
does not fit.

The `am` (amount) in an intent URI is a **hint**: several UPI apps let the payer edit
it, and a static QR carries no amount at all. Manual pipelines cannot enforce price in
software.

### Razorpay (unused — deferred, DECISIONS D1)
**Account & Settings → API Keys** (under *Website and app settings*) → Generate Key.
Test mode needs no KYC. **The key secret is displayed once and is never retrievable** —
regenerating invalidates the old pair.

### Next.js
16.3.0 current as of 2026-08-03.

**`middleware.ts` is now `proxy.ts`.** Renamed in Next 16; the functionality is
identical. Source: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

This one is genuinely dangerous, because **Supabase's own SSR quickstart still tells
you to create `middleware.ts`** — and Next 16 does not invoke that file. No error, no
warning. Sessions silently never refresh and it presents as a random auth bug.

It also lands on top of DECISIONS A2, the most dangerous item in the project: the
matcher that keeps `Set-Cookie` off the edge-cached board route now lives in a
differently-named file. Two silent failures stacked on one file.

**`params` and `searchParams` are Promises.** `params: Promise<{ slug: string }>`,
then `const { slug } = await params`. Every dynamic route and `generateMetadata`.

---

## Phase 2 — database

### Connection strings: percent-encode the password
The DB password contained `/` and `&`. Both are structural in a URI, so the
unencoded string silently truncates and you get `password authentication failed` —
an error that points at the wrong thing entirely. `5L/pzY&F` → `5L%2FpzY%26F`.

### The pooler host is `aws-0-` or `aws-1-` and you cannot guess
Both resolve in DNS, so a lookup doesn't disambiguate. The errors do:
- wrong host → `ENOTFOUND tenant/user <ref> not found`
- **right host, wrong password** → `password authentication failed`

Which means the two failures are diagnostic. Getting "tenant not found" on one host
and "password failed" on the other tells you the second host is correct.

Session pooler on **5432**, not the transaction pooler on 6543 — transaction mode
can't run all the DDL.

### `supabase db push` needs Docker only for a cache it doesn't need
Applying migrations against a remote URL prints a wall of
`failed to connect to the docker API` and then succeeds anyway. That's the local
migrations-catalog cache, not the migration. Look for
`{"message":"Finished supabase db push."}` and verify against the live database —
don't read the Docker noise as failure.

### RLS picks rows. Column grants pick columns.
A policy scoped to `status = 'pending'` still lets the client rewrite *any column* of
that row — including price and product kind. `revoke insert, update` then re-grant
the specific columns. Generated columns are stronger still: `amount_paise` is
computed from `kind` and simply cannot be written.

This applies to **every client-writable table with a status or price column**, not
just orders.

### Unique indexes treat NULLs as distinct
`unique (user_id, poll_id, kind)` does not stop a user opening fifty orders when
`poll_id` is null — every null is its own row. Postgres 15+ has `nulls not distinct`.

### PostgREST returns 401 for permission-denied, not 403
A revoked function `execute` surfaces as `401` with `42501 permission denied for
function …`. Asserting on 403 fails a test that is actually passing, and 401 looks
like a bad API key when it isn't.

### An empty table passes a security test for the wrong reason
`select * from votes` returning `[]` proves nothing when the table is empty — and a
broken key returns `[]` too. Gate 2 seeds a real vote and asserts the **differential**:
`votes` empty *and* `options` readable on the same request path.

---

## The one most likely to be quietly re-broken

> **DECISIONS A2** — putting the board route behind the Supabase auth proxy
> silently disables edge caching, because the proxy sets a cookie. There is no
> error and nothing looks wrong. The only symptom is the Vercel usage graph climbing
> with viewer count instead of staying flat.
>
> Check `x-vercel-cache: HIT`. The `proxy.ts` matcher is written in Phase 3 and the
> damage is only observable in Phase 5, which is exactly what makes it dangerous.

---

## Design values that were wrong

Measured against WCAG during the Phase 1 refresh:

| Token | Was | Ratio | Now |
|---|---|---|---|
| `--muted` on `--paper` | `#8A8A94` | **3.27:1 ✗** | `#6B6B75` — 5.04:1 |
| violet as text on `--violet-soft` | `#6B4EFF` | **4.33:1 ✗** | `--violet-text: #5B3EE8` — 5.45:1 |

Both came straight from the design drafts and had been carried forward unquestioned.
**Contrast gets checked in DevTools, never by eye.**

The prototypes also used clickable `<div>`s for option rows — the primary action of
the whole product, unreachable by keyboard.

### Where the prototypes went
`RefDocs/` (8 markdown drafts + 2 HTML prototypes) was absorbed into `docs/` and
deleted — see DECISIONS B8. Recover with `git show 85297c2 -- RefDocs/`.

Before deleting, every hex value in the HTML was diffed against `globals.css` +
`04-design.md`. Eight were unmatched and all eight were confirmed non-app chrome
(WhatsApp's own bubble colours in the preview mockup, and the mockup page's own
scaffolding). One real gap surfaced and was captured: the OG image gradient
`linear-gradient(135deg,#111114,#2A2145 60%,#6B4EFF)`.

---

## Phases 3-7 — app build

### `app/@[handle]` is a parallel route slot, not a URL
The design puts profiles at `maxpoll.vercel.app/@handle`. In the App Router a
folder beginning with `@` is the **named-slot convention**, so `app/@[handle]`
becomes a parallel route and never serves a URL at all. No error — the page just
doesn't exist.

Fix: the page lives at `app/u/[handle]`, with a rewrite in `next.config.ts`
mapping `/@:handle` → `/u/:handle`. Public URL unchanged.

### React 19's purity rules catch real bugs, not style
Two rules fire hard in Next 16 and both found genuine problems:

- **`Date.now()` during render.** Reading the clock in a component meant the feed,
  a Space page and a profile could each decide "is this poll closed" differently.
  Fixed by `isExpired()` in the data layer, which also removed the same
  enrichment logic duplicated across three pages (`buildFeedPolls`).
- **`setState` in an effect body.** The Timer used a `mounted` flag to dodge a
  hydration mismatch. `useSyncExternalStore` is what React provides for an
  external mutable source like the wall clock, and removes the flag entirely.

### A `"use server"` file may only export async functions
`export const ADJECTIVES = [...]` in an actions file is a **build error**, not a
lint warning: *"A 'use server' file can only export async functions, found
object."* Constants go in their own module.

### Node's ESM resolver needs explicit `.ts` extensions
The bundler resolves `./format`; Node (which runs `node --test`) does not. Any
lib file reachable from a test must import with the extension — `./format.ts`.
`allowImportingTsExtensions` in tsconfig keeps `tsc` happy.

### Testing RLS *as a signed-in user* without a browser
Anonymous probes cannot test the policies that matter, and the first version of
`scripts/gates.mjs` silently ran every "as a user" check as anon — where two of
them **passed for the wrong reason**.

Password grant is unavailable (the Email provider is off, deliberately). The way
through: the admin API mints a magic link and verifying it returns a real session:

```
POST /auth/v1/admin/generate_link  {type:"magiclink", email}   → hashed_token
GET  /auth/v1/verify?type=magiclink&token=…                    → 303, session in the URL fragment
```

Admin-only and secret-key-only, so it's a test affordance, not a hole.

**The tell that the first run was fake:** denials returned `401`. With real
sessions the same denials return `403`. 401 means "not authenticated"; 403 means
"authenticated and refused" — which is the thing being tested. If an RLS probe
returns 401, the probe is broken, not the policy.

The script now aborts if it cannot mint sessions rather than degrading to anon.

### Seed data cannot be a migration
`db push` applies every migration, so a seed migration would ship demo content to
production. The CLI has no "run this SQL file" command either, so
`scripts/sql.mjs` (dev-only `pg`) runs `supabase/seed.sql` and `--wipe` removes it.

Seeding votes through `cast_vote()` rather than raw inserts is deliberate: a seed
that writes `vote_count` by hand would hide exactly the bug Gate 4 hunts. The
seeded database independently confirmed 54 vote rows === 54 summed counters.

### `Invalid supabaseUrl` in production — the error that names nothing
2026-08-05. Every route on `maxpoll.vercel.app` returned 500 with
`Error running the exported Web Handler: Invalid supabaseUrl: Must be a valid HTTP
or HTTPS URL.` No file, no variable name, no value.

Reading `validateSupabaseUrl` in `@supabase/supabase-js` settled it in one step —
there are **two** different messages, and which one you get is the diagnosis:

| Value | Message |
|---|---|
| missing / empty | `supabaseUrl is required.` |
| set, but no `http(s)://` | `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.` |

We got the second, so `NEXT_PUBLIC_SUPABASE_URL` **was** set in Vercel — with a
broken value. Verified against the real library, all three of these produce it:

```
biwcdpefkzrkkdajfyaj.supabase.co                 (scheme missing)
"https://biwcdpefkzrkkdajfyaj.supabase.co"       (quotes pasted in)
NEXT_PUBLIC_SUPABASE_URL=https://…               (whole .env line pasted in)
```

Two fixes, because either alone leaves the trap open:

- `lib/supabase/env.ts` is now the only reader of these variables. It strips a
  `NAME=` prefix, surrounding quotes and whitespace, and otherwise throws a message
  that names the variable **and** prints the value. All five clients — server,
  browser, anon, admin, `proxy.ts` — go through it.
- The value is only safe to print because it is a `NEXT_PUBLIC_` one that ships to
  every browser anyway. `requireEnv` never echoes, so the secret key stays quiet.

**The compounding trap: `NEXT_PUBLIC_*` is substituted into the bundle at build
time.** Fixing the value in the Vercel dashboard changes nothing until a redeploy —
so a correct-looking dashboard and a broken site coexist happily, which is exactly
how this eats an evening.

Same paste, one more casualty: a whole `.env.local` copied into Vercel carries
`NEXT_PUBLIC_SITE_URL=http://localhost:3000`, which sends every production Google
sign-in to the developer's laptop. `signInWithGoogle` now ignores a localhost value
when `process.env.VERCEL` is set and uses the request host instead. It also used
`??`, which does not fall back on `""` — an empty value made `new URL()` throw.

### The vote spoof: a definer function that asked the caller who they were
2026-08-05, found while revoking direct `INSERT` on `messages` and `options`.

`cast_vote(p_poll, p_option, p_device, p_user)` wrote `user_id = p_user`. It is
`security definer`, so RLS never ran and `votes_insert` — the policy that reads
`auth.uid() = user_id` — was decoration. `profiles` is public-read, so the uuids
were free.

Proven against the live database before touching anything, with two real users:

```
cast_vote { p_poll, p_option, p_device:"attacker-device", p_user: <victim> }
  -> 204
votes  -> [{"user_id":"<victim>","device_id":"attacker-device"}]
option -> vote_count 1
```

The counters incremented, so the fabricated vote was indistinguishable from a real
one on the board. One signed-in account could set any leaderboard to any result.

Fix: `v_user := coalesce(auth.uid(), p_user)`. A session always wins; the parameter
survives only for `seed.sql` and the admin scripts, which connect as the owner and
have no session. The same probe now stores the *caller's* id.

**The generalisation, which is the part worth keeping:** a `security definer`
function is the security boundary itself. Every argument crossing it is
attacker-controlled — so identity must come from `auth.uid()`, never from a
parameter. Grep for definer functions taking a user id before adding another.

### Three tables were writable straight past the Server Actions
`chat/actions.ts` capped bodies at 300 chars, `option-actions.ts` refused locked and
closed polls. Both real; neither was the only door. The policies behind them asked
only *are you you?*, and the publishable key is in every browser by design:

```
POST /rest/v1/messages   { body: "<10MB>" }        # any rate, any length
POST /rest/v1/options    { poll_id: <locked poll> } # "locked at 10 votes" wasn't
POST /rest/v1/votes      { ... }                    # counters never move
```

Now `send_message()` / `add_option()` / `cast_vote()` hold the rules, `INSERT` is
revoked on all three tables, and the actions do input trimming and error copy.
`addOption`'s check-then-insert was also a race — two submits could both read
`option_count = 59`; the function takes a row lock.

**`information_schema.role_table_grants` is not schema-scoped by default.** Checking
the revokes, it showed `messages` still holding `INSERT` — that was
`realtime.messages`, a different table Supabase ships. Filter on
`table_schema = 'public'`, or read `pg_class.relacl` and look for the `a` privilege.
Nearly sent me fixing a bug that did not exist.

### A PostgREST 403 on an insert can mean the READ-BACK was denied
2026-08-05. The most useful thing learned this session, and it nearly cost a real
vulnerability.

Probing whether a user could write into someone else's activity feed:

```
POST /rest/v1/activity  { user_id: <victim>, ... }
  Prefer: return=representation   -> 403 "new row violates row-level security policy"
  (no Prefer header)              -> 201, and the row is in the victim's feed
```

`activity_insert` was `WITH CHECK (true)`, so the write was always allowed. With
`return=representation` PostgREST reads the row back, that read is governed by
`activity_read USING (auth.uid() = user_id)`, and the denial surfaces as a **403 on
the insert**. The write had already landed.

The first probe reported 403 and looked like proof of safety. It was proof of nothing.

**So a security probe must never conclude "refused" from a status code.** Every
refusal check in `scripts/gates.mjs` now reads the value back with the secret key and
asserts it did not change:

```js
const r    = await patch(`/rest/v1/polls?id=eq.${id}`, { vote_count: 99999 }, token);
const back = await api(`/rest/v1/polls?id=eq.${id}&select=vote_count`, SEC);
ok(r.status === 403 && back.body?.[0]?.vote_count === 0, "…");
```

Note the two 403s are distinguishable if you read the body: an RLS refusal says
`new row violates row-level security policy`, a missing grant says
`permission denied for table activity` and helpfully suggests the GRANT. The second is
the one that means the write never happened.

### Denormalised counters are only as honest as the column grants
`polls.vote_count` and `options.vote_count` exist so no screen ever runs `count(*)`.
That makes them the board — and they were writable by the poll's creator, because
`polls_update` was scoped by row and said nothing about columns. `PATCH {vote_count:
99999}` returned 204 and persisted.

Gate 4 has always asserted `sum(options.vote_count) = actual rows`, which would have
caught drift from a *bug*. It cannot catch a creator who sets both consistently. The
guard has to be the grant.

### A trigger that writes past a revoke must be `security definer`
Moving the `new_follower` insert into a trigger on `follows` only works because the
trigger function is `security definer`. A trigger function otherwise runs as the
invoking role, so a plain one would have started failing the moment
`revoke insert on activity` landed — and silently, since the follow itself succeeds
either way.

The same property is what made the column revokes safe: `cast_vote`, `create_poll`,
`create_space`, `merge_options`, `snapshot_ranks` and both `bump_*` count triggers are
all definer functions, so revoking the client's UPDATE on `polls`/`options`/`spaces`
left every internal writer working. That was checked before the first revoke was
written, not after.

### Measure server time, not your own broadband
The poll page looked 2× over its <200ms TTFB budget: `curl` reported 262–469ms from
here. That number was mostly the trip to Vercel, not Vercel.

```
curl -w "%{time_pretransfer} %{time_starttransfer}"
   pretransfer 0.075–0.203   (DNS + TCP + TLS from India)
   ttfb        0.211–0.338
   difference  ~130–172ms    <- the only part the code controls
```

So the server was inside budget the whole time and the "violation" was a measurement
artefact. **`time_starttransfer` minus `time_pretransfer` is the number to hold the
budget against** — and even that carries one network leg, so treat it as a ceiling.

The memoisation below was still worth doing, but for query count rather than the
budget: it halves Supabase round trips per poll view, which is Fast Origin Transfer
and function CPU on a free tier.

### `auth.getUser()` is a network call, and every page made two or three
`@supabase/ssr` validates the JWT against the Auth server rather than trusting the
cookie — correctly, since a cookie can be forged. But that makes it a round trip, and
it was being made by the page *and* by `ActivityBell` in the shell on every screen;
`app/page.tsx` made three, because `getProfile()` called it again internally.

`getPollBySlug` and `getBoard` were doubled for a different reason: `generateMetadata`
needs the leader for the share preview and the page needs the board, so both ran twice
per poll view — and `getBoard` carries the `snapshot_ranks` call, so that fired twice
as well.

React `cache()` fixes all of it without threading values through props. The one thing
worth checking before wrapping `getUser` in anything called "cache": it is scoped to a
single request, so `requireAdmin()` cannot inherit another user's identity. Confirmed
in `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`, where
the example is `getUser` itself.

Measured on production: TTFB median ~336ms → ~267ms.

### Google OAuth: non-sensitive scopes never needed verification
2026-08-05. [07-setup.md](07-setup.md) told us to stay in Testing because "publishing
requires a verified authorised domain and `*.vercel.app` cannot be verified". That
invented a launch blocker and it stood for weeks.

MaxPoll requests `openid`, `email`, `profile` — all **non-sensitive**. Google's rules:

- An app using only non-sensitive scopes is **not required to complete verification**.
  Nothing enters a review queue.
- Apps requesting only basic profile information show **no unverified-app warning**
  and get **no 7-day refresh-token expiry** — *even in Testing*.
- Testing mode's actual limitation is a **100-test-user cap**, added by hand.

So publishing removes the cap and changes nothing else, and it never depended on a
domain. Verification, brand review and domain ownership only enter the picture for
sensitive or restricted scopes, or to put a custom logo on the consent screen.

The domain still earns its place — Branding wants a home page, a privacy policy and
terms that resolve — but as a requirement of *that step*, not of publishing.

**The general lesson:** we wrote a platform constraint into the docs from a plausible
inference rather than from the platform's documentation, then treated it as settled
fact. Every other platform claim in this project got verified against a primary source
(DECISIONS A1–A6). This one didn't, and it was the one that cost the most.

### `URLSearchParams` writes `+` for a space, and UPI apps read it literally
`upiIntentUrl()` built its query with `URLSearchParams`, which encodes a space as `+`
— correct for form bodies, wrong inside a `upi://` URI. An app parsing per RFC 3986
renders the note as `MaxPoll+MP4F2A1B`.

`.replace(/\+/g, "%20")` on the serialised query fixes it; `%20` is read as a space by
both kinds of parser. Only `tn` (the note the payer reads) carried a space, so nothing
was functionally broken — but the payment screen is the one place a stray character
costs trust.

### A correct read path hid a wrong database for weeks
2026-08-05. `isExpired(poll, now)` computes closure from `status` *or* `expires_at`,
so every screen showed expired polls correctly. `polls.status` meanwhile never left
`'live'` — nothing ever wrote the transition. All six production polls were `'live'`
with one two hours past its timer.

Three consequences, none visible on the screen that was right:

- the landing page counted `status='live'` for its headline number, so it counted
  dead polls, on the one page whose claim is *real aggregates only*
- `getFeed()` spent its 40-row budget on polls that had ended
- `poll_closed` could never fire, because no moment existed at which a poll ended

**Computing a state at read time is not the same as recording it.** Read-time
derivation is right for display — it can never drift — but anything that needs the
*event* (a notification, an aggregate, a filter in someone else's query) needs the
write. When you reach for a derived getter, ask what else in the system wants to know.

The fix uses the one daily cron already allowed on Hobby, because closure is not
time-critical: the read path was always correct, so the cron only has to catch up the
data. `realStats()` and `getFeed()` additionally filter on `expires_at` so they are
right immediately rather than up to 24 hours later.

### A probe that fails because the code is right
The first version of the Gate X probe created a poll already past its expiry, voted on
it, and asserted the voters got notified. Nothing was written, and it looked like the
notification was broken.

It wasn't: `cast_vote()` refuses an expired poll — a guard added in the same session —
so there were no votes to notify. The probe had to vote while the poll was live and
then backdate `expires_at`, which is also the only sequence that happens in reality.

**A failing probe is a claim about the code, and it is worth one minute of doubt
before it becomes a bug report.**
