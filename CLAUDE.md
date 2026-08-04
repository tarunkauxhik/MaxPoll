# MaxPoll — read this first

Live poll/leaderboard web app. India, Gen Z, 18+. Ships to `maxpoll.vercel.app`
on Vercel Hobby + Supabase Free. Budget is ₹0; latency is a feature.

**Start every session by reading [docs/00-STATE.md](docs/00-STATE.md)** — current phase,
what's done, what's next, what's blocked.

| Doc | What's in it |
|---|---|
| [docs/00-STATE.md](docs/00-STATE.md) | Live status. Update at every gate. |
| [docs/01-DECISIONS.md](docs/01-DECISIONS.md) | Why things are the way they are. Supersedes RefDocs where they conflict. |
| [docs/02-SETUP.md](docs/02-SETUP.md) | Accounts, env vars, tooling. |
| [docs/03-LEARNINGS.md](docs/03-LEARNINGS.md) | Gotchas found the hard way. |
| `RefDocs/` | Original spec drafts. Not final — 01-DECISIONS overrides them. |

## Non-negotiables

- **Visual source of truth** is `RefDocs/maxpoll-prototype.html` +
  `maxpoll-landing-activity.html`. Do not invent UI, colours, or layouts.
  Unspecified anywhere → ask, don't improvise.
- **Every number** wrapped in `.num` (Space Mono, tabular figures). Live counts
  jitter otherwise, and that is the fastest way a leaderboard looks cheap.
- **Colour has one job each.** Gold = rank 1 only. Violet = movement only.
  Red = time pressure only. Reaching for a colour to decorate → use `--line`
  or `--muted`.
- **Never `count(*)` for vote counts.** Denormalised counters, incremented in
  the same transaction as the insert.
- **Ranks computed live inside the cached board route.** No cron for this, ever.
- **One cron in `vercel.json` at most**, once daily. Any sub-daily schedule
  fails the deploy on Hobby.
- **Voter names gated server-side by entitlement.** Never sent to the client
  and blurred in CSS — anyone can open DevTools.
- **No password flows.** Google OAuth only. No forgot/reset password.
- **Payments read `NEXT_PUBLIC_PAYMENTS_MODE`, fail closed to `coming_soon`.**

## Working rules

- **One phase per session**, per `RefDocs/07-build-guide.md`. Stop at the gate,
  hand over the verification steps, `/clear`, then continue.
- **pnpm**, not npm. No global installs — check what's on the machine first.
- Commit per logical unit, push at each gate. Conventional commit subjects.
- Ponytail is installed and applies: skip → reuse → stdlib → platform →
  existing dep → one line → minimum. No dependency added before the phase that
  actually needs it.

## Commands

```bash
pnpm dev      # localhost:3000
pnpm build    # must pass before any commit that touches app code
pnpm lint
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
