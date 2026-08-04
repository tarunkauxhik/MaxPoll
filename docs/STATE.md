# State

_Last updated: 2026-08-04 · Phase 1 complete, awaiting Gate 1 sign-off._

## Where we are

| Phase | Status |
|---|---|
| 0 — Accounts (Supabase, Google OAuth, Razorpay) | ⬜ **Not started — yours to do.** See [02-SETUP.md](02-SETUP.md) |
| 1 — Scaffold + shell | ✅ Built, **Gate 1 not yet verified** |
| 2 — Database schema + RLS | ⬜ Blocked on Phase 0 (Supabase) |
| 3 — Auth | ⬜ Blocked on Phase 0 (Supabase + Google) |
| 4 — Poll core | ⬜ |
| 5 — Live board | ⬜ |
| 6 — Options, typeahead, moderation | ⬜ |
| 7 — Everything else + payments | ⬜ |
| 8 — Ship | ⬜ |

## Done in Phase 1

- Git repo initialised, remote `github.com/tarunkauxhik/MaxPoll`, LF pinned via
  `.gitattributes` (global `core.autocrlf=true` would otherwise churn the repo).
- Next.js **16.3.0**, App Router, TypeScript, ESLint, Turbopack. pnpm.
  No Tailwind, no shadcn — see [01-DECISIONS.md](01-DECISIONS.md) D1.
- `app/globals.css`: doc 05 §1 tokens verbatim + component classes ported from
  the prototypes + the accessibility floor the prototypes lack.
- Fonts via `next/font/google`, self-hosted. Archivo + Space Grotesk variable,
  Space Mono 400/700 static.
- Shell: `AppShell` / `TopBar` / `BottomNav`. Bottom bar → left rail at 768px
  via media query only.
- `vercel.json` pinning functions to `bom1` (Mumbai). No cron key yet.
- `pnpm build` and `pnpm lint` both clean.

## Gate 1 — verify before Phase 2

```bash
pnpm dev     # localhost:3000
pnpm build
pnpm lint
```

1. 360px shows the bottom nav; 1440px shows the left rail, content still a
   480px centred column. No horizontal scrollbar at either width.
2. Network tab: fonts load from `/_next/static/media/…`, zero requests to
   `fonts.googleapis.com` / `fonts.gstatic.com`.
3. Lighthouse (mobile, incognito): **CLS 0**, **Performance ≥95**.
4. Console: `getComputedStyle(document.documentElement).getPropertyValue('--gold')`
   → ` #F5B324`. Spot-check `--violet`, `--heat`, `--paper`.
5. The two `.num` rows on the page (`1111111111` / `8888888888`) are exactly
   the same width.
6. DevTools → Rendering → emulate `prefers-reduced-motion`: the live dot stops
   pulsing.
7. Tab through the nav — visible focus ring on each item, every target ≥48px.
8. Scroll to the bottom: the disclosure line is fully visible above the nav.
9. `git status` shows no `.env.local`.

## Next up

Phase 2 (database) the moment the Supabase project exists. It carries
decisions **A3** (no `rank` column; `rank_snapshot`/`snapshot_at` instead),
**A4** (`device_id` indexed, not unique) and **A6** (`search_path` on
`cast_vote`) from [01-DECISIONS.md](01-DECISIONS.md).

## Open questions

- Emoji strategy final call (system stack vs inline Twemoji SVG) — deferred to
  Phase 4, when the real set of meaningful emoji is known. See D6.
- Whether `/api/poll/[id]/messages` needs its own cache window separate from
  the board's 4s — decide in Phase 7 with real chat volume.
