# MaxPoll — read this first

Live poll/leaderboard web app. India, Gen Z, 18+. Ships to `maxpoll.vercel.app` on
Vercel Hobby + Supabase Free. Budget is ₹0; latency is a feature.

**Start every session by reading [docs/STATE.md](docs/STATE.md)** — current phase,
what's done, what's next, what's blocked. Then [docs/README.md](docs/README.md) tells
you which file answers which question.

| Doc | What's in it |
|---|---|
| [docs/STATE.md](docs/STATE.md) | Live status. Update at every gate |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Why things are as they are. **Overrides every other doc** |
| [docs/LEARNINGS.md](docs/LEARNINGS.md) | Gotchas, and the verified free-tier numbers |
| [docs/06-build-plan.md](docs/06-build-plan.md) | What to build next, and the gate that says it's done |
| [docs/07-setup.md](docs/07-setup.md) | External service setup, click-by-click |
| [docs/08-runbook.md](docs/08-runbook.md) | Run · test · deploy · tear down |

## Non-negotiables

- **Visual source of truth** is `app/globals.css`, explained by
  [docs/04-design.md](docs/04-design.md). Do not invent UI, colours, or layouts.
  Unspecified anywhere → ask, don't improvise.
- **Every number** wrapped in `.num` (Space Mono, tabular figures). Live counts
  jitter otherwise, and that is the fastest way a leaderboard looks cheap.
- **Colour has one job each.** Gold = rank 1 only. Violet = movement only.
  Red = time pressure only. Reaching for a colour to decorate → use `--line` or
  `--muted`.
- **Contrast is measured, not eyeballed.** Every text pair ≥4.5:1. Two tokens already
  failed this once — see DECISIONS C1.
- **Interactive elements are real `<button>` / `<a>`.** Never a clickable div.
- **Never `count(*)` for vote counts.** Denormalised counters, incremented in the same
  transaction as the insert.
- **Ranks computed live inside the cached board route.** No cron for this, ever.
- **The middleware matcher must exclude cached routes.** A `Set-Cookie` on the board
  response silently disables edge caching with no error — DECISIONS A2.
- **One cron in `vercel.json` at most**, once daily. Any sub-daily schedule fails the
  deploy on Hobby.
- **Voter names gated server-side by entitlement.** Never sent to the client and
  blurred in CSS — anyone can open DevTools.
- **No password flows.** Google OAuth only. No forgot/reset password.
- **Payments read `NEXT_PUBLIC_PAYMENTS_MODE`, fail closed to `coming_soon`.**

## Working rules

- **One phase per session.** Stop at the gate, hand over the verification steps,
  `/clear`, then continue.
- **pnpm**, not npm. No global installs — check what's on the machine first.
- Commit per logical unit; **push at gates, not at commits** (every push builds).
- Update `STATE.md` at every gate, and `LEARNINGS.md` whenever something costs time.
- Ponytail applies: skip → reuse → stdlib → platform → existing dep → one line →
  minimum. No dependency added before the phase that needs it.

## Commands

```bash
pnpm dev        # localhost:3000
pnpm check      # build + lint + typecheck + contrast — before every commit
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
