# Learnings

Things that cost time, and the verified numbers the architecture depends on. Add here
rather than rediscovering.

---

## Phase 1 — scaffold

### `create-next-app` rejects capitalised directory names
The repo lives at `…\projects\MaxPoll`, and create-next-app derives the package name
from the directory:

```
Could not create a project called "MaxPoll" because of npm naming restrictions:
  * name can no longer contain capital letters
```

Scaffolded into a temp dir as `maxpoll` and copied the output in. No behavioural
difference. Next's demo assets (`public/*.svg`, `page.module.css`, `README.md`) were
deliberately not carried over.

### pnpm 11 blocks postinstall scripts and aborts the install
`sharp` and `unrs-resolver` need build scripts; pnpm 11 refuses to run them by default
and then **aborts the whole install** rather than warning. The switch lives in
`pnpm-workspace.yaml`, not `package.json`:

```yaml
allowBuilds:
  sharp: true
  unrs-resolver: true
```

### `create-next-app` shipped 16.2.12, not latest
Even with `@latest` the template pinned an older Next. Explicitly bumped:
`pnpm update next@16.3.0 eslint-config-next@16.3.0`. Worth checking the resolved
version after any scaffold.

### Turbopack no longer needs a flag
In Next 16 it's the default bundler, so `package.json` scripts are plain `next dev` /
`next build` — the `--turbopack` flag from older guides is gone.

### Don't run `pnpm build` while `pnpm dev` is running
On Windows both write to `.next/`, and the file locks collide — the dev server dies
with a bare `[ELIFECYCLE] Command failed with exit code 1` and no explanation. Stop
the dev server first, or run the build in a separate checkout.

### The bottom nav pointed at three routes that didn't exist
`/spaces`, `/create` and `/profile` 404'd, which meant Gate 1 couldn't actually be
verified: the nav's `aria-current` active state has nothing to activate, and the
1440px left-rail check lands on a 404 page that doesn't render `AppShell` at all.
Fixed with three placeholder pages. **A shell whose navigation 404s isn't a shell.**

### `next dev` rewrites CLAUDE.md
It appends an agent-rules block on every run and re-creates it if removed. Committed
rather than fought. `agentRules: false` in `next.config.ts` disables it, but the block
is genuinely useful — Next 16 has breaking changes against most training data.

---

## Provider facts the architecture depends on

Verified **2026-08-04**. Providers move these. **Re-check before launch.**

### Vercel Hobby
- Functions run in a **single region**; default `iad1` (Virginia). Mumbai is `bom1`
- Active CPU **4 CPU-hrs/mo** · Invocations **1M** · Fast Data Transfer **100GB** ·
  Provisioned Memory 360 GB-hrs
- **Fast Origin Transfer only ~10GB/mo** — tighter than bandwidth, and the meter that
  cache *misses* actually consume
- Cron: **once per day maximum** (any sub-daily schedule fails at deploy time),
  **10s timeout**, UTC only, fires anywhere within the scheduled hour
- **CDN will not cache a response carrying `Set-Cookie`**, or a request carrying
  `Authorization`
- **CDN cache is segmented per region** — "one invocation per 4s" is per edge region
- `Cache-Control` without `CDN-Cache-Control`: Vercel strips `s-maxage` and
  `stale-while-revalidate` before the response reaches the browser
- `stale-if-error` and `proxy-revalidate` are **not** supported
- Max cacheable response 10MB (20MB streaming)
- 100 deployments/day, 100 builds/hour, 45min build limit
- **No automatic overage** — a maxed resource pauses that feature until the next cycle
- Non-commercial use only; **cannot connect to org-owned Git repos**

### Supabase Free
- 500MB DB · 5GB egress + 5GB cached egress · 50k MAU · 1GB storage · 500k edge
  function invocations · 200 concurrent realtime connections · 2M realtime messages
- **2 active projects.** Paused projects **don't** count toward that
- **Pauses after ~7 days without database activity.** Visiting the dashboard counts as
  activity, so it won't bite during active development — only after launch quiet
- Restores within **1 year**, data and configuration intact
- **No backups.** `pnpm supabase db dump` is the only undo

### Supabase API keys — changed
`anon` / `service_role` JWT keys are replaced by `sb_publishable_…` / `sb_secret_…`
and **deprecated at the end of 2026**. Found at **Settings → API Keys → Publishable
and secret API keys**.

- `@supabase/ssr`'s `createServerClient` takes a publishable key directly — drop-in
- ⚠️ **New keys must be sent on the `apikey` header, never `Authorization: Bearer`.**
  `supabase-js` does this; a hand-rolled `fetch` against the REST API would break
- ⚠️ Edge Functions don't verify the `apikey` header for new keys — set
  `verify_jwt = false` and authorise in code if we ever use them

### Google Cloud OAuth — renamed
"OAuth consent screen" is now **Google Auth Platform**, split into **Branding /
Audience / Clients / Data Access**. Direct link:
`console.cloud.google.com/auth/clients`.

- The `openid` scope must be **typed into "Manually add scopes"** — it isn't in the
  picker
- A `*.vercel.app` subdomain **cannot be verified** as an authorised domain, so
  publishing to Production isn't possible until there's a real domain. Testing mode
  works fully; only listed test users (up to 100) can sign in

### Razorpay
**Account & Settings → API Keys** (under *Website and app settings*) → Generate Key.
Test mode needs no KYC. **The key secret is displayed once and is never retrievable** —
regenerating invalidates the old pair.

### Next.js
16.3.0 current as of 2026-08-03.

---

## The one most likely to be quietly re-broken

> **DECISIONS A2** — putting the board route behind the Supabase auth middleware
> silently disables edge caching, because the middleware sets a cookie. There is no
> error and nothing looks wrong. The only symptom is the Vercel usage graph climbing
> with viewer count instead of staying flat.
>
> Check `x-vercel-cache: HIT`. The middleware matcher is written in Phase 3 and the
> damage is only observable in Phase 5, which is exactly what makes it dangerous.

---

## Design values that were wrong

Measured against WCAG during the Phase 1 refresh:

| Token | Was | Ratio | Now |
|---|---|---|---|
| `--muted` on `--paper` | `#8A8A94` | **3.27:1 ✗** | `#6B6B75` — 5.04:1 |
| violet as text on `--violet-soft` | `#6B4EFF` | **4.33:1 ✗** | `--violet-text: #5B3EE8` — 5.45:1 |

Both came straight from the design drafts and had been carried forward unquestioned.
**Contrast gets checked in DevTools, never by eye.**

The prototypes also used clickable `<div>`s for option rows — the primary action of
the whole product, unreachable by keyboard.

### Where the prototypes went
`RefDocs/` (8 markdown drafts + 2 HTML prototypes) was absorbed into `docs/` and
deleted — see DECISIONS B8. Recover with `git show 85297c2 -- RefDocs/`.

Before deleting, every hex value in the HTML was diffed against `globals.css` +
`04-design.md`. Eight were unmatched and all eight were confirmed non-app chrome
(WhatsApp's own bubble colours in the preview mockup, and the mockup page's own
scaffolding). One real gap surfaced and was captured: the OG image gradient
`linear-gradient(135deg,#111114,#2A2145 60%,#6B4EFF)`.
