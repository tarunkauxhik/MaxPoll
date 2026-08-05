# State

_Last updated: 2026-08-05 · **Phases 3–8 built.** All 30 automated gate checks pass
against the live database. Remaining: your browser checks, and the VPA._

## Where we are

| Phase | Status |
|---|---|
| 0 — Accounts (Supabase, Google, Vercel) | ✅ Verified live |
| 1 — Scaffold + shell | ✅ Built. Gate 1 pending your browser check |
| 2 — Database schema + RLS | ✅ Applied. **Gate 2 passed** |
| 3 — Auth | ✅ Built. Sign-in round trip needs a browser |
| 4 — Poll core | ✅ Built. **Gate 4 passed** (automated part) |
| 5 — Live board | ✅ **Gate 5 passed live** — `MISS → HIT`, no `Set-Cookie` |
| 6 — Options, typeahead, moderation | ✅ Built. **Gate 6 passed** |
| 7 — Screens + payments UI + `/admin` | ✅ Built. **Gate P passed** |
| 8 — Ship | 🟡 Seed applied, cron wired. Awaiting your checks |
| 9 — Razorpay | ⬜ Not scheduled. Trigger is operational — DECISIONS D1 |

```bash
pnpm dev      # http://localhost:3000
pnpm check    # build + lint + typecheck + contrast + 45 unit tests
pnpm gates    # 30 probes against the REAL database, then tears its data down
pnpm sql supabase/seed.sql   #  seed  ·  pnpm sql --wipe  to remove
```

## Production is live — 2026-08-05

The 500-on-every-route outage was a malformed `NEXT_PUBLIC_SUPABASE_URL` in the
Vercel dashboard, fixed there. The app no longer dies inside supabase-js over it:
quotes and a pasted `NAME=` prefix are stripped, anything else names the variable
in the log — [LEARNINGS](LEARNINGS.md).

**Verified against `maxpoll.vercel.app`:**

| Route | |
|---|---|
| `/` · `/spaces` · `/create` · `/p/[slug]` · `/p/[slug]/chat` · `/u/[handle]` | 200 |
| `/activity` · `/settings` | 307 → sign in |
| `/admin` | **404** for a non-admin, as designed |
| `/api/cron/ping` | 200 |

### Gate 5 — passed on the deployment (the only place it exists)

```
X-Vercel-Cache: MISS  → HIT (Age 1) → HIT (Age 2)
Cache-Control: public, max-age=0
Cdn-Cache-Control: public, s-maxage=4, stale-while-revalidate=10
Set-Cookie: none
```

**DECISIONS A2 is now proven end to end**, not just reasoned about: the board is
served from the edge, so viewer count really is irrelevant to the bill. If this
ever reads `MISS` every time, the `proxy.ts` matcher is the first thing to check.

**Still to confirm in the dashboard:** `NEXT_PUBLIC_SITE_URL` must be
`https://maxpoll.vercel.app`. A localhost value there sends every production
Google sign-in to your laptop. The code now ignores a localhost value when
running on Vercel, but the variable should still be right.

## What you need to do next

**Nothing is blocking the code.** Three things, in order of value:

1. **Browser checks** — the list below. These are the things no script can see.
2. **PhonePe for Business** ([07-setup.md](07-setup.md) §4) — the only step with a
   human approval delay. Send back the VPA and display name; setting
   `NEXT_PUBLIC_UPI_VPA` is the single switch that turns payments on.
3. **Rotate the database password** ([08-runbook.md](08-runbook.md)) — it was pasted
   into a chat transcript.

⚠️ **Google OAuth is in Testing mode**, so only accounts added as test users can
sign in. That is fine for your own testing and **will block every real user** at
launch. A `*.vercel.app` domain cannot be verified for Production, so publishing
needs a real domain (LEARNINGS).

## 🛠 Write guards — 2026-08-05

Closing the "rate limits" box on the build plan turned up a **vote-spoofing hole**
on the core path. `cast_vote` is `security definer`, so RLS never ran, and it took
the voter's id as a **parameter** — so any signed-in account could post
`p_user: <anyone's uuid>` and have the vote land under that person with the counters
incremented. `profiles` is public-read, so the uuids were free. One account could
set any leaderboard to any result.

Proven against the live database, fixed, and proven again with the same probe —
[DECISIONS D2c](DECISIONS.md), [LEARNINGS](LEARNINGS.md).

Same class, two more tables: `messages` and `options` were directly insertable, so
the 300-char cap and "options locked at 10 votes" were promises only the UI kept.

| Now enforced in the database | Where |
|---|---|
| Identity comes from `auth.uid()`, never a parameter | `cast_vote()` |
| Option must belong to the poll; poll must be live | `cast_vote()` |
| 300 chars · 10 messages/minute · anon handle derived server-side | `send_message()` |
| 2–80 chars · 10 adds/hour · 60 per poll · locked and closed refused | `add_option()` |
| `INSERT` revoked on `votes`, `messages`, `options` | the RPCs are the only door |

**Nothing about the UI changed.** The Server Actions now do input trimming and error
copy, which is all they should ever have done.

## 🛠 Column guards + the activity engine — 2026-08-05 (Phase 10)

Auditing every policy and grant after the vote spoof found the same defect one level
down: policies picked **rows**, and said nothing about **columns**. All verified live
before being fixed, as the poll's own creator with a real session:

| Request | Was | Now |
|---|---|---|
| `PATCH polls {vote_count: 99999}` | 204, persisted | **403**, unchanged |
| `PATCH options {vote_count: 4242}` | 204, persisted | **403**, unchanged |
| `PATCH options {hidden: false}` on a 3-report auto-hide | 204 | **403** |
| `POST spaces {is_verified: true}` | 201, tick granted | **403** |
| `POST polls {…}` — past `create_poll`'s 3/week | 201 | **403** |
| `POST activity {user_id: <someone else>}` | 201, feed poisoned | **403** |

The board reads exactly those denormalised counters, so the first two meant a creator
could fabricate their own poll's result — [DECISIONS D2e](DECISIONS.md).

**And the activity feed now has writers.** It had a spec, CSS and a finished
component, and nothing but `new_follower` ever wrote to it — so the retention surface
picked over email was empty, and its empty state promised something that could not
happen. `same_as_you` comes from `cast_vote()`, `option_climbed` from
`snapshot_ranks()`, `new_follower` from a trigger. That is what let the client's
INSERT be revoked at all — D2f.

The `same_as_you` row used to render hardcoded `Aarav S.` / `Priya M.` chips — seed
names shown to real users as real voters, in front of a paywall. It now shows **two
real names** from `same_as_you_names()` and neutral placeholders behind the blur, per
03 §H. The function caps at two inside SQL with no limit or offset parameter, and
returns nothing at all to a caller who never voted in that poll.

## Performance — measured, and the budget was never actually broken

The poll page read as 262–469ms TTFB against a <200ms budget. Splitting the
measurement showed most of that was the connection from here, not the server:

| | |
|---|---|
| `pretransfer` (DNS + TCP + TLS, India → Vercel) | 75–203ms |
| **server think time** | **~130–172ms** — inside budget |

Memoisation shipped anyway, for query count rather than latency: `generateMetadata`
and the page each ran `getPollBySlug` + `getBoard` (and `getBoard` carries
`snapshot_ranks`, so that fired twice too), and `auth.getUser()` — a real round trip
to the Auth server, not a cookie read — ran twice on every screen and three times on
`/`. React `cache()` collapses each to one per request.

Production TTFB median **336ms → 267ms**. See LEARNINGS for why the original
number was misleading.

## Gate probes — all 56 passing (2026-08-05)

`pnpm gates` creates two real users with real sessions, exercises the policies as
those users, and deletes everything afterwards.

| Area | What it proves |
|---|---|
| Write guards | `cast_vote` ignores `p_user` · direct INSERT into `votes`/`messages`/`options` → **403** · an option from another poll refused · 5000 chars stored at 300 · chat flood refused · locked and closed polls refuse options |
| Column guards | creator cannot fabricate `vote_count` or un-hide a moderated option · nobody awards themselves the verified tick · the 3-poll/week limit cannot be walked around · no writing into someone else's feed, but you can still mark your own read |
| Activity | both voters get a `same_as_you` row · `same_as_you_names` caps at 2 · **a user who never voted learns no names** |

> ⚠️ **A refusal is proven by reading the value back, never by the status code.**
> PostgREST answers 403 to an insert sent with `Prefer: return=representation` when
> only the *read-back* was denied — and the row still lands. That is how the activity
> hole nearly got signed off as safe (LEARNINGS).
| Auth | Public password signup refused · counter triggers fire |
| Voting | Second vote → `ALREADY_VOTED` · **different account, same device → vote lands** (A4) · `polls.vote_count` and `sum(options.vote_count)` both equal the real row count |
| Names | Anon reads `votes` → `[]` **while still reading `options`** · unentitled user sees only their own vote · entitled user sees all |
| Options | Typeahead returns rank + count · owner merge sums counts and loses no votes · non-owner refused |
| Payments | Amount generated by the DB · client `amount_paise` rejected · payer cannot rewrite `kind` or self-approve · `verify_order` unreachable by a user · double-verify → `NOT_PENDING` · **a UTR cannot be reused** |

> ⚠️ **A denial that returns 401 means the probe is broken, not the policy.**
> The first version of this script had no session tokens, so every "as a user"
> check silently ran as anonymous and two of them passed for the wrong reason.
> With real sessions the same denials return **403**. The script now aborts if it
> can't mint sessions.

## Gate 1 + browser checks — yours to run

Seed data is already applied, so every screen has content.

**Shell (Gate 1)** — 360px and 1440px, no horizontal scroll · fonts from
`/_next/static/media/…`, zero requests to `fonts.gstatic.com` · CLS 0 ·
Lighthouse ≥95 · focus rings visible on dark surfaces too · reduced-motion stops
the live dot and shimmer.

**The one that matters most (Gate 4.4):** open a poll **logged out**, tap an
option, sign in with Google → **the vote must land on the option you originally
tapped**. This is the highest-damage bug in the product.

**Board (Gate 5):** open one poll in three browsers, vote in one → the others
update within ~5s · ranks slide (FLIP, 340ms) rather than jumping.

✅ The edge-cache half of Gate 5 is **already done** — see above. Only the
three-browser FLIP check is left, and it needs human eyes.

**Payments:** the paywall shows *"Unlocking soon"* until `NEXT_PUBLIC_UPI_VPA` is
set. That is the fail-closed path working, not a bug.

**Admin:** add your profile UUID to `ADMIN_USER_IDS`, then `/admin` → grant
yourself an unlock and confirm names appear. A non-admin must get **404**.

## Done in Phase 2

- All **13 tables** applied to `biwcdpefkzrkkdajfyaj`, `pg_trgm` installed, RLS on
  every one of them
- `cast_vote()`, `search_options()`, `verify_order()` — all `security definer` with a
  pinned `search_path`, execute revoked from `public`
- **Payments switched to manual UPI** ([DECISIONS](DECISIONS.md) D1–D5). Because the
  migration had never been run, `orders` and the generalised `entitlements` cost zero
  extra migrations
- `lib/payments.ts` — the four-value mode flag, fails closed. First unit tests in the
  project, via `node:test`, **zero dependencies added**

### Gate 2 — passed 2026-08-04

Seeded a real vote, then with the **publishable** key:

| Check | Result |
|---|---|
| `votes` → zero rows | ✅ `[]` |
| `options` on the same path → readable | ✅ 1 row — proves the `[]` is RLS, not a dead key |
| `orders` / `entitlements` → zero rows | ✅ |
| `verify_order` RPC | ✅ `42501 permission denied` |
| `amount_paise` supplied by a client | ✅ rejected — it's a generated column |
| Teardown | ✅ user + poll deleted, database empty again |

The differential matters: an empty table returns `[]` and so does a broken key. Only
the pair proves anything.

> ⚠️ **PostgREST returns 401, not 403, for `42501 permission denied`.** Don't assert
> on 403 — it looks like an auth failure and isn't.

## Done in Phase 1

**Scaffold**
- Next.js **16.3.0**, App Router, TypeScript, ESLint, Turbopack, pnpm
- No Tailwind, no shadcn — [DECISIONS](DECISIONS.md) B1
- Git repo → `github.com/tarunkauxhik/MaxPoll`, LF pinned via `.gitattributes`
- `vercel.json` pinning functions to `bom1` (Mumbai). No cron key yet — that ships in
  Phase 5 alongside the route it points at

**Design system**
- `app/globals.css`: full token set + every component class from the design
- Fonts via `next/font/google`, self-hosted. Archivo + Space Grotesk variable,
  Space Mono 400/700 static
- **Five colour tokens failed WCAG AA and were fixed** — [DECISIONS](DECISIONS.md) C1
- `pnpm check:contrast` now enforces all 17 pairs, so it can't regress
- Spacing (`--s-*`) and elevation (`--shadow-1/2`) are scales, not one-offs

**Components**
- Shell: `AppShell` / `TopBar` / `BottomNav`. Bottom bar → left rail at 768px, CSS only
- `OptionRow` — a real `<button>`, all five variants
- `BoardSkeleton` / `EmptyState` / `ErrorState`
- Scroll depth cue via scroll-driven CSS animation — zero JS

**Docs**
- `RefDocs/` absorbed into this tree and deleted — [DECISIONS](DECISIONS.md) B8
- New: [07-setup.md](07-setup.md) (verified click-by-click) and
  [08-runbook.md](08-runbook.md) (run · test · deploy · tear down)

`pnpm check` passes: build, lint, typecheck, contrast, tests.

## Gate 1 — still worth doing in a browser

```bash
pnpm dev     # http://localhost:3000
pnpm check   # build + lint + typecheck + contrast
```

1. **360px** shows the bottom nav; **1440px** shows the left rail, content still a
   480px centred column. No horizontal scrollbar at either width
2. At 360px the long name (*"Dr. Priyadarshini Venkataraman (Chemistry)"*) truncates
   with an ellipsis — the rank, `NEW` badge and percentage do **not** shrink or wrap
3. Network tab: fonts load from `/_next/static/media/…`, **zero** requests to
   `fonts.googleapis.com` / `fonts.gstatic.com`
4. Lighthouse (mobile, incognito): **CLS 0**, **Performance ≥95**
5. The two `.num` rows (`1111111111` / `8888888888`) are exactly the same width
6. **Tab** reaches every option row; the Accessibility pane shows `button`, not
   `generic`; Enter activates it
6b. Tap each nav item — all four load (they're placeholders until Phase 7) and the
   active one goes dark. No 404s
7. Focus rings are visible on **both** light and dark surfaces (try the Primary button)
8. DevTools → Rendering → emulate `prefers-reduced-motion`: the live dot stops pulsing
   **and** the skeleton shimmer stops
9. Scroll down — a soft shadow appears under the top bar
10. Scroll to the bottom: the disclosure line is fully visible above the nav
11. `git status` shows no `.env.local`

## Open questions

- **Emoji strategy** — system stack now; inline Twemoji SVG if Android/iOS divergence
  proves to matter. Deferred to Phase 4, when the real glyph set is known
  ([DECISIONS](DECISIONS.md) A5)
- **Chat cache window** — whether `/api/poll/[id]/messages` needs its own window
  separate from the board's 4s. Decide in Phase 7 with real volume

## Reminders for whoever picks this up

- **Read [DECISIONS.md](DECISIONS.md) before changing anything visual or
  architectural.** It records five platform claims and five colour values that were
  wrong in the original drafts.
- The most dangerous single item is **A2**: the `proxy.ts` matcher must exclude cached
  routes. It's written in Phase 3 and only observable in Phase 5.
- Push at gates, not at commits. Every push builds.
