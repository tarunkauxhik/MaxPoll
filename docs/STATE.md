# State

_Last updated: 2026-08-04 · Phase 1 code complete. Blocked on Phase 0 accounts._

## Where we are

| Phase | Status |
|---|---|
| 0 — Accounts (Supabase, Google, Vercel, Razorpay) | ⬜ **Not started — yours to do.** [07-setup.md](07-setup.md) |
| 1 — Scaffold + shell | ✅ Built and verified. Gate 1 pending your browser check |
| 2 — Database schema + RLS | ⛔ **Blocked on Phase 0** (Supabase) |
| 3 — Auth | ⛔ Blocked on Phase 0 (Supabase + Google) |
| 4 — Poll core | ⬜ |
| 5 — Live board | ⬜ |
| 6 — Options, typeahead, moderation | ⬜ |
| 7 — Everything else + payments | ⬜ |
| 8 — Ship | ⬜ |

## What you need to do next

**Follow [07-setup.md](07-setup.md).** ~45–60 minutes, all free, no card. It ends with
copy-paste blocks — send those values back and Phase 2 starts immediately.

Sections 1–3 (Supabase, Google, Vercel) unblock everything. Section 4 (Razorpay) isn't
needed until Phase 7 and can wait.

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

`pnpm check` passes: build, lint, typecheck, contrast.

## Gate 1 — verify in a browser before Phase 2

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
- The most dangerous single item is **A2**: the middleware matcher must exclude cached
  routes. It's written in Phase 3 and only observable in Phase 5.
- Push at gates, not at commits. Every push builds.
