# Learnings

Things that cost time, and the verified numbers the architecture depends on. Add here
rather than rediscovering.

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
