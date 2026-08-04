# 07 — Build & Implementation Guide

> Build in the order below. **Each phase has a test gate — do not start the next phase until the gate passes.** Bugs found three phases later cost ten times more.

---

## PHASE 0 — Manual setup (you, not the AI)

**0.1 Hosting — no domain purchase yet**
No domain to buy at this stage. The app deploys straight to Vercel's free subdomain: **`maxpoll.vercel.app`** (or `maxpoll-<random>.vercel.app` if the exact name is taken — check at deploy time). A real domain, if you want one later, is a separate step added on its own whenever you decide to.

**0.2 GitHub**
```bash
mkdir maxpoll && cd maxpoll && git init
gh repo create maxpoll --private --source=. --remote=origin
```

**0.3 Supabase**
1. `supabase.com` → New project → region **Mumbai (ap-south-1)** ← latency matters, pick the closest region
2. Save the DB password somewhere permanent
3. Settings → API → copy `Project URL`, `anon key`, `service_role key`
4. Authentication → Providers → **Google** → enable

**0.4 Google OAuth**
1. `console.cloud.google.com` → New project "MaxPoll"
2. APIs & Services → OAuth consent screen → External → app name, support email
3. Credentials → Create → OAuth client ID → Web application
4. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
5. Paste Client ID + Secret into Supabase's Google provider
6. **Leave the consent screen in "Testing" mode** and add yourself + a few friends as test users (up to 100 allowed). A `*.vercel.app` subdomain can't be verified as an "Authorized domain" for publishing to production — that step only becomes relevant once there's a real domain. Testing mode works fine for a small launch; sign-in just shows an "unverified app" click-through screen, which is normal at this stage.

**0.5 Razorpay** — see doc 06 §4. Test mode only.

**0.6 Local env**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # server only — NEVER prefix NEXT_PUBLIC_
NEXT_PUBLIC_PAYMENTS_MODE=test
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
```bash
echo ".env*.local" >> .gitignore   # do this before your first commit
```

---

## PHASE 1 — Scaffold

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false
npm i @supabase/supabase-js @supabase/ssr razorpay
npm i -D @types/node vitest @testing-library/react playwright
npx shadcn@latest init
npx shadcn@latest add button input dialog sheet tabs avatar badge skeleton toast dropdown-menu
```

**1.1** Put the exact tokens from doc 05 §1 into `app/globals.css`.
**1.2** Add fonts to `app/layout.tsx` via `next/font/google`: Archivo (600/700/800/900), Space Grotesk (400/500/600/700), Space Mono (400/700).
**1.3** Build the shell: top bar, bottom nav (left rail ≥768px), 480px centred column.

> ✅ **Gate 1:** empty shell renders at 360px and 1440px, fonts load, no layout shift, Lighthouse performance ≥95.

---

## PHASE 2 — Database

**2.1** Run the schema from doc 03 in the Supabase SQL editor. Include `create extension pg_trgm`.
**2.2** Create `cast_vote()` and the typeahead function.
**2.3** **Enable RLS on every table.** Then write policies:
- `profiles` — public read, self write
- `polls`/`options` — public read (non-hidden), creator write
- `votes` — **insert only; select restricted to entitlement holders**
- `entitlements` — self read, service-role write only
- `messages` — public read (non-hidden), authenticated insert

**2.4 Keep migrations in the repo:**
```bash
npx supabase init
npx supabase link --project-ref <ref>
npx supabase db pull        # snapshots current schema into migrations/
```

> ✅ **Gate 2:** with the **anon** key, try to `select * from votes` for a poll you haven't paid for → must return zero rows. If it returns names, stop and fix RLS. This is the security check that matters most.

---

## PHASE 3 — Auth

**3.1** `@supabase/ssr` client + server helpers, middleware for session refresh.
**3.2** `/auth/callback` route handler.
**3.3** `/onboarding` — handle (unique), display name, **DOB with 18+ gate**, bio, socials.
**3.4** Under-18 → hard stop screen. No soft gate.
**3.5** Sign out clears session + `localStorage`.

> ⚠️ **No password flows exist.** Sign up and Log in are the same button → same Google handler. Do not build forgot/reset password.

> ✅ **Gate 3:** sign in → onboarding → home. Sign out → landing. Refresh mid-session keeps you signed in. DOB of 2010 is rejected.

---

## PHASE 4 — Poll core (the critical path)

Build in this exact order:

**4.1** `/p/[slug]` server-rendered, counts hidden pre-vote
**4.2** `<OptionRow>` per doc 05 §4.1 — all five variants
**4.3** Vote action → `cast_vote()` RPC
**4.4** **Vote-intent preservation** — store intent in `localStorage` *before* the Google redirect, replay on return
**4.5** Join-Space sheet with the disclosure line
**4.6** Result state: counts unlock, `<Counter>` animates, `<GapLine>` appears
**4.7** `<Timer>` with the ring, and the sub-1-hour red state
**4.8** Under-list with the blurred/locked variant

> ✅ **Gate 4 (most important gate in the build):**
> - Vote from a logged-out browser → sign in → **vote lands on the option you originally tapped**
> - Vote twice from the same browser → `ALREADY_VOTED`
> - Vote from incognito → counts as a separate device (expected)
> - `options.vote_count` and `polls.vote_count` match the actual row count in `votes`
> - Board endpoint returns in **<150ms**

---

## PHASE 5 — Live board (no websockets)

**5.1** `GET /api/poll/[id]/board` → returns options `ORDER BY vote_count DESC` from the **denormalised counter**. Never `count(*)`.
**5.2** `Cache-Control: public, s-maxage=4, stale-while-revalidate=10`
**5.3** Client polls every 4s; **10s when `document.hidden`; stop entirely on closed polls**
**5.4** FLIP animation on rank change (340ms) + ▲▼ badges
**5.5** Rank movement, computed live — **no cron.** Vercel Hobby cron jobs only run once per day (any sub-daily schedule fails at deploy time), so a 30s or 1-minute recompute cron simply isn't available. Instead: inside the same `/board` handler, diff the freshly-queried order against each option's `prev_rank` column to derive `▲/▼`, then write the new `prev_rank` back in the same request. Because the route is cached at `s-maxage=4`, this only actually runs at most once every 4 seconds per poll no matter how many people are viewing — same effect as a cron, no cron needed.

```json
// vercel.json — only ONE cron on Hobby: the daily Supabase keep-alive.
// Do not add a per-minute or hourly entry here — it will fail deployment on Hobby.
{ "crons": [
  { "path": "/api/cron/ping", "schedule": "0 6 * * *" }
]}
```
> This cron exists because **Supabase free projects pause after 7 days of inactivity.** Don't skip it. Note Hobby cron timing is only guaranteed within the hour, not to the minute — fine for a keep-alive ping.

> ✅ **Gate 5:** open the same poll in 3 browsers, vote in one → other two update within ~5s. Check Supabase logs: origin hits should be roughly **one per 4s regardless of viewer count**. If hits scale with viewers, your caching is broken.

---

## PHASE 6 — Options, typeahead, moderation

**6.1** Add-option with trigram typeahead (250ms debounce), suggestions showing **rank + vote count**
**6.2** >0.8 similarity warning
**6.3** Owner **merge** — build it now, not later; retro-merging polls with thousands of votes is far messier
**6.4** Lock options at ≥10 votes
**6.5** Report → auto-hide at 3 reports
**6.6** Preset positive adjectives for person-polls

> ✅ **Gate 6:** type "narendr" → "Narendra Modi #2 · 82 votes" appears. Merge two options → counts sum, no votes lost, ranks recompute.

---

## PHASE 7 — Everything else

**7.1** Create poll (3/week limit enforced server-side)
**7.2** Spaces: browse, create, join, 20-member results gate
**7.3** Profile + follows + share
**7.4** Activity feed (`same_as_you` first)
**7.5** Chat: `GET /api/poll/[id]/messages?since=` polled at 3s, cached 2s, anon toggle
**7.6** Settings incl. **delete account** (DPDP requirement — null the `user_id` on votes, don't delete them, so counts don't retroactively change)
**7.7** Payments per doc 06 — **all 12 tests**
**7.8** OG images: `next/og` `ImageResponse` route renders on-demand, edge-cached, **URL versioned on leader change** (WhatsApp caches previews hard)

> ✅ **Gate 7:** paste a poll link into a real WhatsApp chat → preview shows the current leader and vote count.

---

## PHASE 8 — Ship

**8.1** `vercel` → link repo → deploy. Vercel assigns `maxpoll.vercel.app` automatically (or `maxpoll-<id>.vercel.app` if taken) — no DNS step, nothing to buy.
**8.2** Add all env vars in the Vercel dashboard → set `NEXT_PUBLIC_PAYMENTS_MODE=coming_soon` on the **Production** environment specifically (keep `test` on Preview, so every PR preview still has working test-mode payments)
**8.3** Add `https://maxpoll.vercel.app/auth/callback` (the exact assigned URL) to Google OAuth's authorised redirect URIs **and** to Supabase's redirect allow-list
**8.4** Vercel Web Analytics (free on Hobby, no cookie banner)
**8.5** Seed: 1 Space + 30 polls, **8–10 real friend-votes on each before posting publicly**

> ✅ **Gate 8:** full flow on a real phone on mobile data, against the live `maxpoll.vercel.app` URL. Google auth works (Testing-mode click-through is expected and fine). Paywall shows coming-soon in production and works in Preview deployments.
>
> **Later, if/when a real domain gets added:** buy it, add it in Vercel's Domains tab, point DNS, then add the new URL to both Google OAuth and Supabase redirect lists *alongside* the vercel.app one — don't remove the old one immediately, so nothing breaks mid-switch.

---

## Testing discipline

Run continuously, not at the end:

```bash
npm run typecheck && npm run lint && npm test    # before every commit
npx playwright test                              # before every push
```

**Unit (vitest):** rank computation · gap calculation · trigram normalisation · signature verification · entitlement expiry

**E2E (playwright):** the critical path (link → vote → sign in → vote lands) · double-vote blocked · paywall coming-soon · add-option dedupe

**Security — verify each one manually:**
- [ ] `service_role` key never reaches the client (grep the built bundle for it)
- [ ] Voter names never in an API response without entitlement (check the Network tab, not the UI)
- [ ] Payment amounts server-side only
- [ ] Webhook signature on raw body
- [ ] RLS on every table
- [ ] Rate limit: votes, poll creation, option adds, messages
- [ ] `.env.local` never committed

**Performance budget:**
| Metric | Target |
|---|---|
| Poll page TTFB | <200ms |
| LCP | <1.5s |
| Board API | <150ms |
| Lighthouse perf | ≥95 |

---

## Things that will bite you

| Problem | Prevention |
|---|---|
| **Vote lost on sign-in redirect** | Phase 4.4. Test it repeatedly — this is the highest-damage bug in the product |
| `count(*)` on votes | Denormalised counters only. Grep for `count(` before shipping |
| Rank recompute per vote | Compute live inside the cached `/board` handler — never per vote, never via cron |
| Sub-daily cron in `vercel.json` | **Fails at deploy time on Hobby.** Only the once-daily ping cron is allowed |
| Supabase project paused | Daily ping cron |
| WhatsApp shows stale preview | Version the OG image URL |
| Names leak via API | Server-side entitlement check, not CSS blur |
| Webhook double-processing | Unique index on `razorpay_payment_id` |
| Numbers jitter when animating | `font-variant-numeric: tabular-nums` |
| Free tier exhausted by polling | 4s active / 10s hidden / stop when closed |

---

## Prompt to give Claude Code

```
Read all docs in /docs (01–07) plus maxpoll-prototype.html and
maxpoll-landing-activity.html. The HTML files are the VISUAL SOURCE OF TRUTH —
match them exactly. Do not invent UI, colours, or layouts.

Build PHASE <N> only, from doc 07. Stop at the gate and show me how to verify it.

Non-negotiable:
- Design tokens exactly as doc 05 §1
- Every number in .num with tabular-nums
- Gold = rank 1 only, violet = movement only, red = time only
- Never count(*) for vote counts — denormalised counters
- Ranks computed live inside the cached /board route — no cron for this, ever
- Only ONE cron job in vercel.json: the once-daily Supabase ping. Any sub-daily
  schedule fails deployment on Vercel Hobby — don't add one
- Voter names gated server-side by entitlement, never CSS blur
- No password flows — Google OAuth only
- Payments read NEXT_PUBLIC_PAYMENTS_MODE, fail closed to coming_soon
```

**Build one phase per session.** Long sessions drift from the spec — that's how you end up with generic UI.
