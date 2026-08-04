# Setup

## Machine — audited 2026-08-04

| Tool | Version | Notes |
|---|---|---|
| Node | 24.18.1 | Next 16 needs ≥20.9 ✓ |
| pnpm | 11.18.0 | Already present. Store at `%LOCALAPPDATA%\pnpm\store\v11` — packages are hardlinked, not copied, so project-local deps are near-free on disk |
| git | 2.55.0 | `credential.helper` was unset; now `manager` (GCM was already installed) |
| Docker | 29.4.0 | Present but unused — see 01-DECISIONS D5 |
| Supabase CLI | — | Install as devDependency when Phase 2 starts: `pnpm add -D supabase` |
| Vercel CLI | — | Not installed by design. `pnpm dlx vercel` for one-offs |
| Python | — | Not installed by design |

Net installs on this machine: none. One git config line, one devDependency later.

`core.autocrlf=true` is set globally. `.gitattributes` pins this repo to LF so
that doesn't cause CRLF churn, without touching your global config.

---

## Phase 0 — accounts (do these yourself; blocks Phase 2+)

### 1. Supabase

1. supabase.com → **New project**
2. Region: **Mumbai (ap-south-1)** — this is not optional. Function region is
   pinned to `bom1` to sit next to it (01-DECISIONS A1)
3. Save the DB password somewhere permanent — it is not recoverable
4. Settings → API → copy **Project URL**, **anon key**, **service_role key**
5. Authentication → Providers → **Google** → enable (leave the client ID/secret
   blank for now; step 2 fills them)

### 2. Google OAuth

1. console.cloud.google.com → **New project** "MaxPoll"
2. APIs & Services → **OAuth consent screen** → External → app name, support
   email → save
3. **Leave it in Testing mode.** Add yourself and a few friends as test users
   (100 allowed). A `*.vercel.app` subdomain can't be verified as an authorised
   domain, so publishing to production isn't available until there's a real
   domain. Testing mode works fine — sign-in just shows an "unverified app"
   click-through, which is expected
4. Credentials → Create credentials → **OAuth client ID** → Web application
5. Authorised redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`
6. Paste the client ID + secret back into Supabase's Google provider

### 3. Razorpay

1. razorpay.com → sign up → toggle **Test Mode** (top right)
2. Settings → API Keys → Generate Test Key → save `rzp_test_…` + secret
3. Webhook secret waits for **Phase 7**, when a preview URL exists to point at
4. Live keys need KYC (PAN, bank account, business proof) — much later, and only
   after leaving Vercel Hobby, which forbids commercial use

### 4. Local env

```bash
cp .env.example .env.local
```
Fill in what exists so far. `.env*.local` is gitignored — verify with
`git status` before every commit.

---

## Env vars

| Var | Where | Phase | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | local + Vercel | 2 | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local + Vercel | 2 | Safe in the browser; RLS is what protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | local + Vercel | 2 | **Server only.** Never prefix `NEXT_PUBLIC_`. Grep the built bundle for it before shipping |
| `NEXT_PUBLIC_PAYMENTS_MODE` | local + Vercel | 7 | `test` on Preview, **`coming_soon` on Production**. Fails closed if unset |
| `RAZORPAY_KEY_ID` / `_SECRET` | local + Vercel | 7 | |
| `RAZORPAY_WEBHOOK_SECRET` | local + Vercel | 7 | Different value from the key secret |
| `NEXT_PUBLIC_SITE_URL` | local + Vercel | 3 | |
| `CRON_SECRET` | Vercel | 5 | Vercel sends it as `Authorization: Bearer …` |

---

## Deploy (Phase 8)

Import the repo at vercel.com — Hobby, personal account. Do **not** move the
repo to a GitHub organisation: Hobby cannot connect to org-owned repos.

After the first deploy, add the assigned `https://maxpoll*.vercel.app/auth/callback`
to **both** Google OAuth's authorised redirect URIs and Supabase's redirect
allow-list.
