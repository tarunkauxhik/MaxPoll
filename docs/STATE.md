# State

_Last updated: 2026-08-04 · Phase 2 applied, **Gate 2 passed**. Payments switched to
manual UPI. Next: Phase 3 (auth)._

## Where we are

| Phase | Status |
|---|---|
| 0 — Accounts (Supabase, Google, Vercel) | ✅ Done and verified live |
| 1 — Scaffold + shell | ✅ Built. Gate 1 pending your browser check |
| 2 — Database schema + RLS | ✅ **Applied to the live project. Gate 2 passed** |
| 3 — Auth | ⬜ **Next** |
| 4 — Poll core | ⬜ |
| 5 — Live board | ⬜ |
| 6 — Options, typeahead, moderation | ⬜ |
| 7 — Everything else + payments UI + `/admin` | ⬜ |
| 8 — Ship | ⬜ |
| 9 — Razorpay | ⬜ Not scheduled. Trigger is operational — DECISIONS D1 |

## What you need to do next

Nothing blocking. Two things you can do whenever:

1. **[07-setup.md](07-setup.md) §4 — PhonePe for Business.** Not needed until Phase 7,
   but it's the only step with a **human approval delay**, so starting early is free.
   Send back the VPA and the display name.
2. **Rotate the database password** ([08-runbook.md](08-runbook.md)) — it was pasted
   into a chat transcript. Only migrations use it, so this is cheap right now.

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
