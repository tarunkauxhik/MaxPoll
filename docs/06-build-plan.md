# Build plan

Build in this order. **Each phase has a gate — do not start the next phase until the
gate passes.** Bugs found three phases later cost ten times more.

**One phase per session.** Long sessions drift from the spec — that's how you end up
with generic UI. `/clear` between phases.

Current position: [STATE.md](STATE.md).

---

## Phase 0 — Accounts (manual, yours)

Supabase · Google OAuth · Vercel import · **PhonePe for Business** (needed by Phase 7).
Click-by-click: [07-setup.md](07-setup.md).

> ✅ **Gate 0:** `.env.local` holds a Supabase URL, publishable key and secret key.
> The Vercel project exists and the first deploy is green.

## Phase 1 — Scaffold ✅ done

Next.js 16 App Router · design tokens · fonts · app shell (top bar, bottom nav →
left rail at 768px, 480px column) · `vercel.json` pinned to `bom1`.

> ✅ **Gate 1:** empty shell renders at 360px and 1440px · fonts self-hosted, no
> request to `fonts.gstatic.com` · CLS 0 · Lighthouse performance ≥95 · every text
> pair ≥4.5:1 · focus rings visible · nav doesn't cover content.

## Phase 2 — Database ✅ done

**2.1** Schema from [02-architecture.md](02-architecture.md), including
`create extension pg_trgm`.
**2.2** `cast_vote()` and `verify_order()` — `security definer` **with `set
search_path`**, execute revoked from `public`. Plus the typeahead function.
**2.3** **RLS on all 13 tables**, then policies:
- `profiles` — public read, self write
- `polls`/`options` — public read (non-hidden), creator write
- `votes` — **insert only; select restricted to entitlement holders**
- `entitlements` — self read, service-role write only
- `orders` — insert/read own, UTR update while pending; **no admin policy at all**
- `messages` — public read (non-hidden), authenticated insert

**2.4** Column-level grants on `orders` — RLS picks rows, not columns (DECISIONS D2b).
**2.5** `lib/payments.ts` + `lib/payments.test.mts`.
**2.6** Migrations live in the repo. `link` needs a browser PAT, so push straight at
the **session pooler** (5432 — the transaction pooler on 6543 can't run all this DDL):
```bash
pnpm supabase db push --db-url "$SUPABASE_DB_URL"
```

> ✅ **Gate 2 — the security check that matters most:** with the **publishable**
> key, `select * from votes` for a poll you haven't paid for → **must return zero
> rows.** If it returns names, stop and fix RLS before anything else.
>
> **Seed a real vote first.** An empty table returns `[]` too, and so does a broken
> key — so assert the differential: `votes` empty **and** `options` on the same
> request path returning its row. Passed 2026-08-04.

## Phase 3 — Auth ✅ done

**3.1** `@supabase/ssr` client + server helpers, `proxy.ts` for session refresh.
**Next 16 renamed `middleware.ts` to `proxy.ts`** — Supabase's quickstart still says
middleware, and that filename is silently ignored. See LEARNINGS.
**3.2** `/auth/callback` route handler (`exchangeCodeForSession`).
**3.3** `/onboarding` — handle (unique), display name, **DOB with 18+ gate**, bio,
socials.
**3.4** Under-18 → hard stop screen. No soft gate.
**3.5** Sign out clears the session + `localStorage`.

> ⚠️ **The `proxy.ts` matcher must exclude `/api/poll/*/board`,
> `/api/poll/*/messages` and `/og/*`.** If it doesn't, those responses carry
> `Set-Cookie` and Vercel silently refuses to cache them — see
> [DECISIONS](DECISIONS.md) A2. This is set up in Phase 3 and only *observed* in
> Phase 5, which is what makes it dangerous.

> ⚠️ **No password flows exist.** Sign up and Log in are the same button → same
> Google handler. Do not build forgot/reset password.
>
> Building no password UI is **not** what closes that surface — the **Email provider
> must be off in the Supabase dashboard**, or `POST /auth/v1/signup` stays live and
> anyone can create accounts with the publishable key. Gate 3 checks this.

> ✅ **Gate 3:** sign in → onboarding → home. Sign out → landing. Refresh mid-session
> keeps you signed in. A DOB of 2010 is rejected. And:
> ```bash
> curl -s -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $PUBLISHABLE_KEY" \
>   -H "Content-Type: application/json" \
>   -d '{"email":"probe@gmail.com","password":"whatever123"}'
> # must return an error, NOT a user object
> ```
> Use a real-looking domain — Supabase rejects `@example.com` outright, so a probe
> using it passes for the wrong reason.

## Phase 4 — Poll core ✅ done

Build in this exact order:

**4.1** `/p/[slug]` server-rendered, counts hidden pre-vote
**4.2** `<OptionRow>` — a `<button>` (DECISIONS C2), all five variants
**4.3** Vote action → `cast_vote()` RPC
**4.4** **Vote-intent preservation** — store the intent in `localStorage` *before*
the Google redirect, replay on return
**4.5** Join-Space sheet with the disclosure line (Radix Dialog — focus trap, Esc,
scroll lock)
**4.6** Result state: counts unlock, `<Counter>` animates, `<GapLine>` appears
**4.7** `<Timer>` with the ring and the sub-1-hour red state
**4.8** Under-list with the blurred/locked variant — **placeholder strings only**

> ✅ **Gate 4 — the most important gate in the build:**
> - Vote from a logged-out browser → sign in → **the vote lands on the option you
>   originally tapped**
> - Vote twice from the same account → `ALREADY_VOTED`
> - Two different accounts in the same browser → **both votes land** (the shared-
>   laptop case; `device_id` is not a constraint)
> - `options.vote_count` and `polls.vote_count` match the actual row count in `votes`
> - Board endpoint returns in **<150ms**

## Phase 5 — Live board ✅ done

**5.1** `GET /api/poll/[id]/board` → options `ORDER BY vote_count DESC` from the
**denormalised counter**. Never `count(*)`. Rank via `row_number()` at read time.
**5.2** Cache headers:
```
Cache-Control:     public, max-age=0
CDN-Cache-Control: public, s-maxage=4, stale-while-revalidate=10
```
**5.3** Client polls every 4s; **10s when `document.hidden`; stops entirely on closed
polls**
**5.4** FLIP animation on rank change (340ms) + ▲▼ badges
**5.5** Movement computed live in the same handler — **no cron.** Diff the fresh order
against `rank_snapshot`, and rewrite the snapshot only when `snapshot_at` is older
than 60s. Because the route is cached at `s-maxage=4`, this runs at most once every
4s per poll no matter how many people are watching.
**5.6** The daily keep-alive cron, added now alongside the route it points at:

```json
// vercel.json — exactly ONE cron on Hobby
{ "crons": [ { "path": "/api/cron/ping", "schedule": "0 6 * * *" } ] }
```

Supabase free projects pause after 7 days of inactivity. Don't skip it. Hobby cron
fires anywhere within the scheduled hour and **times out at 10s**, so the handler
does one trivial query and nothing else. Any sub-daily schedule **fails at deploy
time**.

> ✅ **Gate 5:** open the same poll in 3 browsers, vote in one → the other two update
> within ~5s. **`curl -sI …/board | grep x-vercel-cache` → `MISS` then `HIT`.** In
> Supabase logs, origin hits should be roughly **one per 4s regardless of viewer
> count**. If hits scale with viewers, caching is broken — check the `proxy.ts`
> matcher first.

## Phase 6 — Options, typeahead, moderation ✅ done

**6.1** Add-option with trigram typeahead (250ms debounce), suggestions showing
**rank + vote count**
**6.2** >0.8 similarity warning
**6.3** Owner **merge** — build it now, not later; retro-merging polls with thousands
of votes is far messier
**6.4** Lock options at ≥10 votes
**6.5** Report → auto-hide at 3 reports
**6.6** Preset positive adjectives for person-polls

> ✅ **Gate 6:** type "narendr" → "Narendra Modi #2 · 82 votes" appears. Merge two
> options → counts sum, no votes lost, ranks recompute.

## Phase 7 — Everything else ✅ done

**7.1** Create poll (3/week limit enforced **server-side**)
**7.2** Spaces: browse, create, join, 20-member results gate
**7.3** Profile + follows + share
**7.4** Activity feed (`same_as_you` first)
**7.5** Chat: `GET /api/poll/[id]/messages?since=` polled at 3s, cached 2s, anon toggle
**7.6** Settings incl. **delete account** (DPDP — null the `user_id` on votes, don't
delete them, so counts don't retroactively change)
**7.7** Payments — **manual UPI**, per [05-payments.md](05-payments.md). Schema and
`lib/payments.ts` already shipped in Phase 2; this phase is the surface:
- `/pay/[ref]` — QR (server-rendered SVG, zero client JS) + `upi://` intent link +
  UTR form + the four status screens
- `/admin` — the pending queue, Verify/Reject server actions, `ADMIN_USER_IDS`
  allowlist, **404 for non-admins**
- `qrcode` is the one dependency this adds, and it is server-only
- Run **all 11 of Gate P**
**7.8** OG images: `next/og` `ImageResponse`, edge-cached, **URL versioned on leader
change** (WhatsApp caches previews hard)
**7.9** Landing page, with **real** aggregate numbers only

> ✅ **Gate 7:** paste a poll link into a real WhatsApp chat → the preview shows the
> current leader and vote count.

## Phase 8 — Ship 🟡 seed + cron done

**8.1** Confirm the production deploy is green
**8.2** Set `NEXT_PUBLIC_PAYMENTS_MODE=manual_upi` plus `NEXT_PUBLIC_UPI_VPA` and
`ADMIN_USER_IDS` on **Production** — DECISIONS D1 records the Hobby-ToS call behind
this. Preview gets the same, so previews are testable end to end
**8.3** Add `https://maxpoll.vercel.app/auth/callback` to Google OAuth's redirect
URIs **and** Supabase's redirect allow-list
**8.4** Vercel Web Analytics on
**8.5** Seed: 1 Space + 30 polls, **8–10 real friend-votes on each before posting
publicly**
**8.6** `vercel.json` has **exactly one** cron entry

> ✅ **Gate 8:** full flow on a real phone on mobile data against the live URL.
> Google auth works (the Testing-mode click-through is expected). The UPI intent
> link opens a real UPI app with ₹9 and the reference prefilled.

## Phase 9 — Razorpay (only when the manual queue stops being viable)

Not scheduled. The trigger is operational, not a date: when verifying UTRs stops
fitting into one sitting a day. Spec in [05-payments.md](05-payments.md) §5.

Order route · client-verify HMAC · webhook HMAC over the **raw body** with the
*webhook* secret · both writing `entitlements` with `source='razorpay'`.

**The schema for this is already applied.** Phase 9 adds routes and a dependency,
and changes nothing about RLS, `entitlements`, or how names are gated — that is
the whole point of the ledger/grant split (DECISIONS D2).

---

## Testing discipline

```bash
pnpm check   # build + lint + typecheck + contrast + tests — before every commit
```

**Unit** (`node:test`, no framework — DECISIONS D5): payment mode fail-closed and the
admin allowlist ✅ · rank computation · gap calculation · trigram normalisation ·
entitlement expiry.

**E2E:** the critical path (link → vote → sign in → **vote lands**) · double-vote
blocked · two accounts one browser both land · UTR reuse rejected · add-option dedupe.

**Security — verify each manually:**
- [ ] The Supabase **secret** key never reaches the client (grep the built bundle)
- [ ] Voter names never in an API response without entitlement (Network tab, not UI)
- [ ] Payment amounts generated in the DB, never client-authored
- [ ] Column grants on `orders` — a payer cannot rewrite `kind` (DECISIONS D2b)
- [ ] `verify_order` execute revoked from `anon` and `authenticated`
- [ ] RLS on every table ✅ (Gate 2, 2026-08-04)
- [x] Rate limits ✅ — votes: one per poll (`votes_poll_user_uniq`) · polls: 3/week in
      `create_poll()` · options: 10/hour and 60 per poll in `add_option()` · messages:
      10/minute in `send_message()`. All inside the transaction, none in app code
- [x] **Client-writable tables** ✅ — `INSERT` revoked on `votes`, `messages`,
      `options`; their RPCs are the only door (DECISIONS D2d)
- [x] **`cast_vote` takes identity from `auth.uid()`**, not a parameter ✅ — it used
      to accept `p_user`, which let any signed-in user vote as anyone (DECISIONS D2c)
- [x] **Column grants on every client-writable table** ✅ — `polls`, `options`,
      `spaces`, `profiles` and `activity`, not just `orders`. A creator could set
      their own poll's `vote_count`; anyone could award themselves the verified
      tick (DECISIONS D2e)
- [x] **Activity is written by the database** ✅ — `cast_vote()`, `snapshot_ranks()`
      and a trigger on `follows`; client INSERT revoked, `read` re-granted (D2f)
- [ ] `.env.local` never committed

**Performance budget:**

| Metric | Target |
|---|---|
| Poll page TTFB | <200ms |
| LCP | <1.5s |
| Board API | <150ms |
| Lighthouse perf | ≥95 |

## Things that will bite

| Problem | Prevention |
|---|---|
| **Vote lost on sign-in redirect** | Phase 4.4. Test repeatedly — highest-damage bug in the product |
| **Middleware kills the edge cache** | Exclude cached routes from the matcher in Phase 3, verify in Phase 5 |
| `count(*)` on votes | Denormalised counters only. Grep for `count(` before shipping |
| Rank recompute per vote | Computed at read time in the cached handler — never per vote, never via cron |
| Sub-daily cron in `vercel.json` | **Fails at deploy time.** Only the daily ping is allowed |
| Supabase project paused | Daily ping cron |
| WhatsApp shows a stale preview | Version the OG image URL |
| Names leak via API | Server-side entitlement check, not CSS blur |
| Numbers jitter when animating | `font-variant-numeric: tabular-nums` |
| Free tier exhausted by polling | 4s active / 10s hidden / stop when closed |
