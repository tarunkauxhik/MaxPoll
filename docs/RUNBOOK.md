# Runbook

Run it, ship it, and set up the external services. Replaces `07-setup.md` and
`08-runbook.md`; the click-by-click provider walkthroughs are in git history if a
service ever needs re-creating from scratch.

---

## Commands

```bash
pnpm dev        # http://localhost:3000
pnpm verify     # typecheck + tests — ~5s, while working
pnpm check      # build + lint + typecheck + contrast + tests — before pushing
pnpm gates      # live database probes — only after touching SQL, RLS, an RPC or payments
pnpm test       # just the unit tests

# migrations. `supabase link` was never run (it wants a browser PAT), so pass the
# session-pooler URL directly. Port 5432 — the transaction pooler on 6543 cannot
# run all our DDL.
pnpm supabase db push --db-url "$SUPABASE_DB_URL"
pnpm sql supabase/seed.sql      # seed data is a script, never a migration
pnpm sql --wipe                 # remove it again

git push origin main            # production deploy
```

## Environment

`.env.local` locally, and the same set pasted into Vercel's env box (it accepts a
whole `.env` file):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ships to every browser — assume it is public |
| `SUPABASE_SECRET_KEY` | server only; bypasses RLS entirely |
| `SUPABASE_DB_URL` | migrations only, session pooler on 5432 |
| `NEXT_PUBLIC_PAYMENTS_MODE` | fails closed to `coming_soon` |
| `NEXT_PUBLIC_UPI_VPA`, `NEXT_PUBLIC_UPI_PAYEE_NAME` | empty VPA forces `coming_soon` |
| `ADMIN_USER_IDS` | comma-separated profile UUIDs; empty means nobody |
| `NEXT_PUBLIC_SITE_URL` | pinned, not inferred — `lib/site.ts` |

One Supabase project serves dev and production. There is no staging database, so
a migration lands everywhere at once — read it twice before `db push`.

## Services

- **Supabase** — database + auth. Email sign-in is **off**; Google is the only
  provider. Redirect URLs must list both `localhost:3000` and the live origin.
- **Google OAuth** — the app must be **published**, not left in Testing, or only
  allow-listed accounts can sign in. Scopes: email + profile, nothing else.
- **Vercel** — Hobby. Functions pinned to `bom1` (Mumbai). Connected to `main`;
  every push to `main` deploys.
- **PhonePe for Business** — manual UPI collection. A *business* VPA, not a
  personal one, once real volume exists.

## After a deploy

Only three things a local run cannot prove:

```bash
# 1. the edge cache still caches — a Set-Cookie here silently disables it
curl -sI https://<url>/api/poll/<id>/board | grep -iE "x-vercel-cache|set-cookie"
#    run twice: MISS then HIT, and no Set-Cookie at all

# 2. OG previews unfurl
curl -s https://<url>/p/<slug> | grep -o '<meta property="og:[^>]*>'

# 3. the region is right
#    Vercel dashboard → Functions → region should read bom1
```

Rolling back: Vercel dashboard → Deployments → the previous one → Promote. A
migration does not roll back with it.

## Meters worth watching

Supabase free: 500MB database, 5GB egress, 50k monthly active users. Vercel
Hobby: 100GB bandwidth, 1M function invocations. The board route's 4s poll is the
one thing that scales with attention rather than with users — it is cached at
`s-maxage=4` for exactly that reason.

## Rotating a leaked key

1. Supabase → Settings → API Keys → roll the affected key.
2. Update `.env.local` and Vercel, then redeploy.
3. `SUPABASE_DB_URL` also contains the database password — rotate that in
   Settings → Database.
