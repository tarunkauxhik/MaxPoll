# 08 — Tooling & How to Actually Start

---

## 1. What to build with

**VS Code, not IntelliJ IDEA.**

IntelliJ is built for JVM ecosystems — Java, Kotlin, Spring. This project is TypeScript/Next.js/Tailwind end to end, and that's VS Code's home turf: the richest extension ecosystem for this exact stack (Tailwind CSS IntelliSense, ESLint, Prisma/SQL syntax, `.env` highlighting), a fast integrated terminal, and it's what nearly all Next.js tutorials and Claude Code documentation assume. There's a JetBrains plugin for Claude Code too, but you'd be fighting your tools for no benefit here.

**Install:**
1. `code.visualstudio.com` → download → install
2. Extensions to add: **Tailwind CSS IntelliSense**, **ESLint**, **Prettier**, **PostgreSQL** (for reading Supabase schema files)

---

## 2. Installing Claude Code

Two ways to use it — pick one, or use both together:

- **CLI in the terminal** (recommended starting point) — runs anywhere, including VS Code's built-in terminal
- **VS Code extension** — a graphical panel with inline diffs and file navigation; it bundles its own copy of the CLI for its chat panel

### Install the CLI (native installer — recommended, no Node.js needed for Claude Code itself)

**macOS / Linux / WSL:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell:**
```powershell
irm https://claude.ai/install.ps1 | iex
```

Verify it worked:
```bash
claude --version
```

> **Important distinction:** Claude Code's native installer does *not* require Node.js — it ships as a self-contained binary. But the **project you're building (Next.js) does need Node.js** — that's a separate requirement, covered below. Don't confuse "what runs Claude Code" with "what runs your app."

### Install the VS Code extension (optional, adds a GUI on top of the same CLI)
Open VS Code → Extensions (`Cmd/Ctrl+Shift+X`) → search **"Claude Code"** → install the one published by **Anthropic** (there are unofficial lookalikes — check the publisher name).

### Log in
```bash
claude
```
First run opens your browser for OAuth sign-in. You need a **Claude Pro, Max, Team, or Enterprise subscription**, or a Console (API) account with credits — the free claude.ai plan does not include Claude Code access.

### Install Node.js (for the project itself, not for Claude Code)
Next.js needs **Node 20 LTS or later**.
- Download from `nodejs.org` (LTS version), or use `nvm` if you might juggle Node versions later
- Verify: `node --version`

### Git
Almost certainly already on your machine. Verify with `git --version`; if missing, `git-scm.com`.

---

## 3. The actual workflow, day to day

1. Open the project folder in VS Code
2. Open the integrated terminal (`` Ctrl+` ``)
3. Run `claude` — you're now in an interactive session with full access to the project folder
4. Give it one phase at a time from doc 07 (see the exact prompts below)
5. Claude proposes changes as diffs — review, then approve. `Shift+Tab` cycles permission modes if you want it to auto-accept edits within a session
6. When a phase's gate passes, `/clear` to reset context before starting the next phase — long sessions drift from the spec, which is exactly how you end up with generic, un-spec'd UI

**Useful commands inside a session:**
| Command | Does |
|---|---|
| `/clear` | Wipe conversation history, start fresh (do this between phases) |
| `/help` | List available commands |
| `claude -c` | Resume the most recent conversation in this folder |
| `claude -r` | Pick from previous conversations to resume |

---

## 4. Baby steps — the exact sequence to follow

Don't paste all seven docs and say "build the whole thing." That produces exactly the kind of drifted, generic output you're trying to avoid. Go phase by phase.

### Step 0 — Before opening Claude Code at all
Do Phase 0 of doc 07 yourself, by hand: GitHub repo, Supabase project, Google OAuth (Testing mode), Razorpay test keys. These are account-creation and browser-click steps — Claude Code can't do the "click Google's OAuth consent screen" part for you. Budget 30–45 minutes.

### Step 1 — Open the project folder, start Claude Code, paste this first

```
I'm building MaxPoll — a poll/leaderboard web app. Here's the full context:

- /docs/01-about-maxpoll.md          — what it is, positioning
- /docs/02-business-prd.md           — pricing, metrics, growth model
- /docs/03-tech-prd-architecture.md  — stack, schema, verified free-tier limits
- /docs/04-ux-flows.md               — every screen and state
- /docs/05-ui-spec.md                — exact design tokens, components, copy
- /docs/06-payment-pipeline.md       — Razorpay integration, test/coming-soon mode
- /docs/07-build-guide.md            — the phase-by-phase build order with test gates
- maxpoll-prototype.html and maxpoll-landing-activity.html — these two HTML files
  are the VISUAL SOURCE OF TRUTH. Match them exactly — colours, spacing, type,
  component structure. Do not invent UI.

Read all of these now. Then just summarize back to me in a few bullets:
what MaxPoll is, the core loop, and the tech stack. Don't write any code yet —
I want to confirm you've actually understood the docs before we start.
```

**Why this first, before any code:** it costs nothing and catches misunderstandings before they become fifty files of wrong code. If the summary is off, correct it right there before Step 2.

### Step 2 — Phase 1 (scaffold)
```
Good. Now build PHASE 1 only, from doc 07 — the Next.js scaffold, design
tokens in globals.css exactly per doc 05 §1, fonts, and the empty shell
(top bar, bottom nav / left rail per doc 04 §3). Stop at Gate 1 and tell
me exactly how to verify it myself.
```
Run the gate check yourself. Don't move on until it passes.

### Step 3 onward — repeat the pattern
```
Gate 1 passed. /clear and start PHASE 2 from doc 07 — the database schema.
Stop at Gate 2 and tell me how to verify it.
```

Repeat through Phase 8. **One phase, one message, `/clear` in between, verify the gate yourself before continuing.** This is slower than asking for everything at once — that's the point. Each gate is a checkpoint where a wrong assumption gets caught at the cost of one phase, not eight.

### If something looks wrong
Don't say "fix it." Say what's wrong specifically and point at the doc:
```
The option row doesn't match doc 05 §4.1 — the fill bar should be
behind the text (z-index), and rank 1 needs the gold gradient variant.
Fix just that component.
```
Specific, doc-referenced corrections keep it anchored to the spec instead of drifting further with each fix.

---

## 5. Things to have open in browser tabs while building
- Supabase dashboard (Table Editor + SQL Editor + Logs)
- Vercel dashboard (Deployments + the Usage tab — watch Active CPU early)
- Razorpay dashboard, Test Mode
- `code.claude.com/docs` if you want to look up a Claude Code feature mid-build

## 6. Sanity checks specific to this project, worth running early
- After Phase 2: try reading `votes` with the anon key for a poll you haven't paid for. Should return nothing. (Gate 2 in doc 07 — don't skip it.)
- After Phase 5: open the Vercel dashboard's Usage tab and confirm Active CPU is barely moving while you refresh a poll repeatedly — that's the cache working.
- After Phase 7: check `vercel.json` has exactly one cron entry before you ever run `vercel --prod`. A second, sub-daily entry fails the deploy.

## 7. Cost reality check
Claude Code itself needs a paid Claude plan (Pro/Max) or API credits — that's separate from every other cost in this project. Everything else (Vercel Hobby, Supabase Free, Razorpay test mode, Google OAuth) is ₹0 until you have real users and flip payments on.
