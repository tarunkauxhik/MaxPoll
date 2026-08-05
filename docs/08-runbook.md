# Runbook

How to run it, how to test without burning free tiers, how to deploy, how to tear
everything down.

---

## 1 · Run the project

### First time on a machine

```bash
git clone https://github.com/tarunkauxhik/MaxPoll.git
cd MaxPoll
pnpm install
```

Then copy `.env.example` to `.env.local` and fill it in — values come from
[07-setup.md](07-setup.md). Without it the app still boots; anything touching the
database won't.

### Every time

```bash
cd C:\Users\tarun\projects\MaxPoll
pnpm dev
```

**Ready looks like:**
```
▲ Next.js 16.3.0 (Turbopack)
- Local:   http://localhost:3000
✓ Ready in 723ms
```

Open **http://localhost:3000**. Edits hot-reload; you rarely need to restart.

**Stop it:** `Ctrl+C` in that terminal.

### After pulling changes

```bash
git pull
pnpm install     # only if package.json or the lockfile changed
pnpm dev
```

If something behaves strangely after a pull, clear the build cache:
```bash
rm -rf .next && pnpm dev
```

### Before every commit

```bash
pnpm check          # build + lint + typecheck + contrast
```

Four checks: build, lint, typecheck, and contrast. `build` is the one that catches
real breakage — `lint` and `tsc` won't notice a broken server component.
`check:contrast` parses the shipped `globals.css` and fails if any text pair drops
below WCAG AA; it exists because five tokens shipped failing it once.

Run one at a time if you prefer: `pnpm build` · `pnpm lint` · `pnpm typecheck` ·
`pnpm check:contrast`.

### Common local problems

| Symptom | Fix |
|---|---|
| `EADDRINUSE :3000` | Another dev server is running. Close it, or `pnpm dev -- -p 3001` |
| Dev server dies with a bare `[ELIFECYCLE] ... exit code 1` | A `pnpm build` ran while it was live — both write `.next/` and the locks collide on Windows. Stop the dev server before building |
| Fonts look wrong on first load | Normal on a cold start — Next fetches and self-hosts them once, then caches |
| Changes not appearing | `rm -rf .next && pnpm dev` |
| `pnpm: command not found` | It's bundled with Node here — reopen the terminal |
| Type errors only in the editor | VS Code is on a different TS version. Command Palette → *TypeScript: Select TypeScript Version* → *Use Workspace Version* |

---

## 2 · Testing without leaving the free tier

Everything is free at our scale — but the limits that bind are **deployment count**
and **Active CPU**, not storage. These rules keep both flat.

| Rule | Why |
|---|---|
| **Local first, always** | `pnpm dev` costs nothing. Only edge caching, OAuth redirects and cron genuinely need a deploy |
| **Push at gates, not at commits** | Every push builds. Hobby allows 100 deployments/day and 100 builds/hour. Eight gates is nothing — a push-per-commit habit inside a broken-build loop is what burns it. Commit freely, push deliberately |
| **One Supabase project for dev and prod** | Half the allowance, one migration path, nothing to keep in sync. Correct for a solo pre-launch project |
| **Snapshot before risky migrations** | `pnpm supabase db dump -f backup.sql`. The free plan has **no backups**. This is your only undo |
| **Seed data lives in a migration** | Reproducible, and wiped in one command instead of accumulating against the 500MB cap |
| **Never leave a poll page open overnight** | It polls the board every 4s. ~21,600 requests you didn't need. Close the tab |
| **Don't create a second Supabase project** | Two active = the whole allowance and double the pause risk |
| **Check usage monthly** | Vercel → Usage (**Active CPU** moves first) · Supabase → Usage (DB size, egress) |

### Vercel environment variables

Set every one of these for **Production** (Preview too, if you use previews).
`SUPABASE_DB_URL` is the exception — it is for migrations and scripts, never the
app, so it must not go into Vercel at all.

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| `NEXT_PUBLIC_SITE_URL` | `https://maxpoll.vercel.app` — **not** localhost |
| `NEXT_PUBLIC_PAYMENTS_MODE` | `manual_upi` |
| `NEXT_PUBLIC_UPI_VPA` | empty until PhonePe is approved |
| `NEXT_PUBLIC_UPI_PAYEE_NAME` | `MaxPoll` |
| `ADMIN_USER_IDS` | your profile UUID |
| `CRON_SECRET` | any long random string |

Two rules, both learned the hard way:

1. **Paste the value only** — not `NAME=value`, and no surrounding quotes.
   `@supabase/supabase-js` rejects the result with `Invalid supabaseUrl`, and it
   names neither the variable nor what was in it.
2. **Redeploy after any change.** `NEXT_PUBLIC_*` is substituted into the bundle
   at build time. Editing the dashboard changes nothing until the next build.

If a deploy 500s on every route, open the Vercel log and read the message: the app
now names the offending variable itself. LEARNINGS has the full story.

### What only a deploy can prove

Four things genuinely don't exist locally. Everything else, test locally.

1. **Edge caching** — `x-vercel-cache` has no local equivalent
2. **Function region** — local always runs on your machine
3. **Cron** — Vercel Cron only fires against a deployment
4. **OAuth against the real URL** — localhost works, but the production redirect
   is a separate registration and fails separately

### Seed and reset

```bash
pnpm supabase db dump --db-url "$SUPABASE_DB_URL" -f backup.sql   # before anything destructive
pnpm supabase db push --db-url "$SUPABASE_DB_URL"                 # apply pending migrations
```

`--db-url` is not optional: we never ran `supabase link` (it wants a browser PAT), so
without it the CLI answers `Cannot find project ref`. It also prints a wall of Docker
errors and then succeeds — that is the local migrations-catalog cache, not your
migration. Read the last line.

Seed data is deliberately **not** a migration — `db push` would ship demo content to
production. Apply and remove it on demand instead:

```bash
pnpm sql supabase/seed.sql   # seed
pnpm sql --wipe              # remove every seeded row
```

### Watching the meters

**Vercel → Usage** — the order things bind:

| Meter | Free | Watch when |
|---|---|---|
| **Active CPU** | 4 CPU-hrs | First to move. A poll going viral |
| **Fast Origin Transfer** | ~10GB | Second. Only cache **misses** count |
| Invocations | 1M | Only misses invoke |
| Fast Data Transfer | 100GB | Rarely the bottleneck for JSON |

Hobby has **no automatic overage** — a maxed resource pauses that feature until the
next cycle. It never bills you by surprise.

**Supabase → Usage** — DB size (500MB) and egress (5GB). At ~120 bytes per vote you
are comfortable to roughly half a million votes.

---

## 3 · Deploy

Deployment is automatic: **push to `main` → production build**. Any other branch →
preview deployment.

```bash
git push origin main
```

Watch it at vercel.com → the project → Deployments.

### Verify after a deploy

```bash
# 1. It's up
curl -sI https://<your-url> | head -1          # HTTP/2 200

# 2. Fonts are self-hosted — no third-party font requests
curl -s https://<your-url> | grep -c "fonts.gstatic.com"    # 0

# 3. Region pin (Vercel dashboard → Deployment → Functions)
#    must read Mumbai (bom1), not Washington D.C. (iad1)
```

### Verify the cache — Phase 5 onward

The load-bearing assumption of the whole architecture is that the board endpoint is
served from the CDN, so viewer count doesn't cost anything. **Prove it, don't assume it:**

```bash
curl -sI https://<your-url>/api/poll/<id>/board | grep -i x-vercel-cache
# first call:            x-vercel-cache: MISS
# again within 4s:       x-vercel-cache: HIT
```

If it's `MISS` every time, the response is carrying `Set-Cookie` and Vercel is
refusing to cache it. **Check the `proxy.ts` matcher first** — see
[DECISIONS](DECISIONS.md) A2. There is no error message for this; the only other
symptom is the usage graph climbing with viewer count.

### Rolling back

Vercel → Deployments → pick the last good one → **⋯ → Promote to Production**.
Instant, no rebuild. Then fix forward in git.

---

## 4 · Teardown

Delete cloud resources the moment they stop earning their place.

### Taking a break — pause, don't delete

**Supabase:** it pauses itself after 7 idle days, or Settings → General → **Pause
project**. Free, data intact, restorable for a year, and **paused projects don't
count toward the 2-project limit**. This is the right move for a break of any length.

**Vercel:** costs nothing while idle. Leave it.

### Abandoning the project — full teardown

Irreversible. In this order:

1. **Supabase** — Settings → General → **Delete project**. Type the project name to
   confirm. Take `pnpm supabase db dump -f final.sql` first if the data matters at all
2. **Vercel** — Project Settings → scroll to the bottom → **Delete Project**. Removes
   deployments, domains and env vars. **Your GitHub repo is untouched**
3. **Google Cloud** — either delete just the OAuth client (Clients → ⋮ → Delete), or
   shut down the whole project (IAM & Admin → Settings → **Shut down**). Project
   shutdown has a **30-day recovery window**
4. **PhonePe for Business** — holds no billable resources. **Settle any balance to
   your bank first**, then leave the account dormant or close it from the app.
   Razorpay, if it was ever set up, is test-mode only and has nothing to delete
5. **GitHub** — the repo is yours. Keep it; it costs nothing and holds the history

### Rotating a leaked key

If a secret key is ever committed or pasted publicly:

1. **Supabase** → Settings → API Keys → revoke the leaked secret key, create a new one
2. Update `.env.local` **and** the Vercel env var
3. Redeploy
4. Rotating the **publishable** key is unnecessary — it's designed to be public and
   RLS is what protects the data

**The database password is a separate secret** and rotating it is separate work:
Settings → Database → **Reset database password**, then update `SUPABASE_DB_URL` in
`.env.local` (percent-encode any `/ & @ : ?` in the new password, or the URI parses
wrong and you get a confusing `password authentication failed`).

> ⚠️ **Outstanding:** the current DB password was pasted into a chat transcript on
> 2026-08-04. Nothing but migrations uses it, so rotating now is cheap. Do it before
> real users exist.

---

## 5 · Quick reference

```bash
# run
pnpm dev                                  # http://localhost:3000

# check — before every commit
pnpm check                                # build + lint + typecheck + contrast + tests
pnpm test                                 # just the unit tests

# database. We never ran `supabase link` (it wants a browser PAT), so pass the
# session-pooler URL directly. Port 5432 — the transaction pooler on 6543 cannot
# run all our DDL.
pnpm supabase db push --db-url "$SUPABASE_DB_URL"
pnpm supabase db dump  --db-url "$SUPABASE_DB_URL" -f backup.sql   # no backups on free

# ship
git push origin main                      # production deploy

# prove the cache (Phase 5 onward)
curl -sI https://<url>/api/poll/<id>/board | grep -i x-vercel-cache
```
