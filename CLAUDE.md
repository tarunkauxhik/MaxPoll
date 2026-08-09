# MaxPoll

Live poll/leaderboard web app. India, Gen Z, 18+. Next.js 16 App Router, plain
CSS, Supabase, Vercel Hobby. Budget is ₹0; latency is a feature.

**Read [docs/RULES.md](docs/RULES.md).** It is short and it is the only doc you
have to read before changing something. [docs/DESIGN.md](docs/DESIGN.md) for
anything visual, [docs/RUNBOOK.md](docs/RUNBOOK.md) to run or deploy it.

## The short version

**Security.** A Server Action is a public HTTP endpoint and the publishable key
is in every browser, so a guard in TypeScript is an error message, not a control.
Writes go through RPCs; `security definer` functions read `auth.uid()` and never
take identity as an argument; RLS picks rows, so columns need their own grants.
Voter names are gated server-side, never blurred in CSS.

**Money.** `orders` is the ledger, `entitlements` is the grant, `verify_order()`
is the only bridge. Payments fail closed to `coming_soon`.

**Cost.** A `Set-Cookie` on a cached route silently kills edge caching with no
error — keep the `proxy.ts` matcher excluding them. Never `count(*)` for votes.
One daily cron at most.

**Visual.** `app/globals.css` is the source of truth. One theme: light page, dark
chrome. Lora (400/500, never 600+) for headings, Inter for everything else
including every number. One page gutter, `--gut`. A component never carries its
own margin — its container spaces it. Real `<button>`/`<a>`, never a clickable
div. Mobile first, verified at 360/768/1024/1440.

## Commands

```bash
pnpm dev        # localhost:3000
pnpm verify     # typecheck + tests — ~5s, use this while working
pnpm check      # full build + lint + contrast + tests — before pushing
pnpm gates      # live DB probes — only after touching SQL, RLS, an RPC or payments
```

## How to work here

Proportionate to the change. A copy fix is not a phase.

- `pnpm verify` while working, `pnpm check` before pushing.
- Commit when a thing works. Push when it is worth deploying.
- pnpm, not npm. No global installs.
- Skip → reuse → stdlib → platform → existing dep → one line → minimum.
- Explain *why* in a comment next to the code, not in a new document.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
