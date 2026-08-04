# Setup — external services

Everything MaxPoll depends on that isn't code. **All menu paths verified 2026-08-04**
against the providers' current dashboards — several changed names in the last year,
so older tutorials will send you to menus that no longer exist.

Total time: **45–60 minutes.** Everything here is free. No card required at any point.

**Do them in this order** — Google needs a value from Supabase, and Vercel needs
values from both.

At the end of each service there's a `=== SEND ME ===` block. Paste it into the chat
and I'll write `.env.local` (which is gitignored and never committed).

---

## Before you start

Already done on this machine — nothing to install:

| | |
|---|---|
| Node | v24.18.1 ✓ |
| pnpm | 11.18.0 ✓ |
| git | 2.55.0, credential helper configured ✓ |
| Repo | `github.com/tarunkauxhik/MaxPoll`, `main` pushed ✓ |

You need: a Google account, and about an hour.

---

## 1 · Supabase — database + auth

**What it's for:** Postgres for every poll, vote and profile, plus the auth layer
Google sign-in plugs into.

### 1.1 Create the project

1. Go to **[supabase.com](https://supabase.com)** → **Start your project** → sign in
   with GitHub (simplest — you already have the account)
2. If prompted to create an organisation: name it `maxpoll`, plan **Free**
3. **New project**, and fill in:

   | Field | Value |
   |---|---|
   | Name | `maxpoll` |
   | Database Password | Click **Generate a password** |
   | Region | **South Asia (Mumbai)** — `ap-south-1` |

4. ⚠️ **Save that database password now**, somewhere permanent. It is shown once and
   cannot be recovered — only reset, which breaks existing connections.
5. ⚠️ **The region is not cosmetic.** `vercel.json` pins our serverless functions to
   `bom1` (Mumbai) so they sit beside the database. Pick anywhere else and every
   query crosses an ocean — roughly +250ms on a page budgeted at under 200ms.
6. **Create new project**, then wait ~2 minutes while it provisions.

**You should see:** a project dashboard, and the URL bar reads
`supabase.com/dashboard/project/abcdefghijklmnop`. That last segment is your
**project ref** — you'll need it twice.

### 1.2 Get the API keys

> Supabase replaced the old `anon` / `service_role` JWT keys with
> `sb_publishable_…` / `sb_secret_…`. **The legacy keys are deprecated at the end of
> 2026**, so we start on the new ones — adopting keys that expire in four months
> would be pure rework. Any tutorial mentioning "anon key" predates this.

1. Left sidebar → **Settings** (gear, bottom) → **API Keys**
2. You'll see two tabs. Open **Publishable and secret API keys**
3. The **publishable key** (`sb_publishable_…`) already exists — copy it
4. Click **Create new secret key** → name it `server` → **Create**
5. ⚠️ Copy the secret key (`sb_secret_…`) **immediately** — full value shown once

**What each one does:**
- **Publishable** — safe in the browser. Row Level Security gates every query it makes
- **Secret** — bypasses RLS entirely. **Server only.** If this ever reaches the
  browser, anyone can read every vote and every name. It never gets a
  `NEXT_PUBLIC_` prefix, and Gate 2 greps the built bundle to prove it didn't

### 1.3 Turn on the Google provider (placeholder)

1. Left sidebar → **Authentication** → **Sign In / Providers**
2. Find **Google**, toggle it **on**
3. Leave Client ID and Secret empty — section 2 fills them
4. Copy the **Callback URL (for OAuth)** shown in that panel. It looks like
   `https://<your-ref>.supabase.co/auth/v1/callback`. Google needs this exact string
5. **Save**

```
=== SEND ME AFTER SECTION 1 ===
Project ref:      ....................  (the segment in the dashboard URL)
Project URL:      https://..........supabase.co
Publishable key:  sb_publishable_....................
Secret key:       sb_secret_....................
Callback URL:     https://..........supabase.co/auth/v1/callback
```

---

## 2 · Google OAuth — the only way to sign in

**What it's for:** MaxPoll has no passwords. Google is the single door, which
removes forgot/reset flows and an entire attack surface.

> Google renamed this whole area. What tutorials call the "OAuth consent screen" is
> now **Google Auth Platform**, split into **Branding / Audience / Clients / Data
> Access** tabs.

### 2.1 Create the Cloud project

1. **[console.cloud.google.com](https://console.cloud.google.com)** → sign in
2. Project dropdown in the top bar → **New Project**
3. Name `MaxPoll`, no organisation → **Create**
4. **Wait for the notification, then switch to the new project** using the same
   dropdown. Almost every "it didn't work" here is having configured the wrong project

### 2.2 Google Auth Platform

1. Go to **[console.cloud.google.com/auth/overview](https://console.cloud.google.com/auth/overview)**
2. Click **Get started** and complete the wizard:

   | Step | Value |
   |---|---|
   | App name | `MaxPoll` |
   | User support email | your address |
   | Audience | **External** |
   | Contact email | your address |

3. Agree to the policy → **Create**

### 2.3 Audience — stay in Testing

1. Left menu → **Audience**
2. Publishing status must read **Testing**. **Leave it there.**
3. Under **Test users** → **Add users** → your Gmail address, plus any friends who
   should be able to sign in. Up to 100

> **Why stay in Testing:** publishing to Production requires a verified authorised
> domain, and a `*.vercel.app` subdomain **cannot be verified** — that only becomes
> possible with a real domain. Testing mode works completely; sign-in just shows an
> "unverified app" screen with a **Continue** link. That's expected, not a bug.
>
> Only listed test users can sign in. If a friend can't, they're not on the list.

### 2.4 Data Access — scopes

1. Left menu → **Data Access** → **Add or remove scopes**
2. Select these three:
   - `openid` — **must be typed into "Manually add scopes"**; it isn't in the list
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
3. **Update** → **Save**

That's the minimum: email to identify the account, profile to prefill display name
at onboarding. Nothing else, so the consent screen stays trustworthy.

### 2.5 Create the OAuth client

1. Left menu → **Clients** → **Create client**
   (direct: [console.cloud.google.com/auth/clients](https://console.cloud.google.com/auth/clients))
2. **Application type: Web application**. Name: `MaxPoll Web`
3. **Authorised JavaScript origins** → Add URI:
   ```
   http://localhost:3000
   ```
4. **Authorised redirect URIs** → Add URI — the Supabase callback from step 1.3:
   ```
   https://<your-ref>.supabase.co/auth/v1/callback
   ```
   ⚠️ Exact match, character for character. A trailing slash or `http` instead of
   `https` produces `redirect_uri_mismatch`, the single most common failure here.
   This is **Supabase's** URL, not localhost — Google redirects to Supabase, and
   Supabase redirects to us.
5. **Create** → a dialog shows **Client ID** and **Client secret**. Copy both

### 2.6 Paste back into Supabase

1. Supabase → **Authentication** → **Sign In / Providers** → **Google**
2. Paste the Client ID and Client Secret → **Save**

```
=== SEND ME AFTER SECTION 2 ===
Google Cloud project name:  MaxPoll
Client ID:                  ....................apps.googleusercontent.com
(Client secret goes only into the Supabase dashboard — I never need it,
 and it never enters this repo)
```

---

## 3 · Vercel — hosting

**What it's for:** hosting, and the CDN that makes the live leaderboard free to run.
Connecting now means every gate can be checked against real edge behaviour instead of
discovering a deploy-time problem in Phase 8.

### 3.1 Import the repo

1. **[vercel.com](https://vercel.com)** → **Sign Up** → **Continue with GitHub**
2. ⚠️ Choose the **Hobby** plan, for **personal use**
3. **Add New… → Project**
4. Find `MaxPoll` in the list → **Import**
   - If it isn't listed: **Adjust GitHub App Permissions** → grant access to the repo
   - ⚠️ Keep the repo on your **personal** GitHub account. Vercel Hobby **cannot
     connect to organisation-owned repositories**
5. Framework Preset should auto-detect **Next.js**. Leave Build and Output settings
   alone — `vercel.json` already carries what matters

### 3.2 Environment variables

Expand **Environment Variables**. The box accepts a **pasted `.env` file** and parses
it, so paste this in one go (with your real values):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
NEXT_PUBLIC_PAYMENTS_MODE=coming_soon
NEXT_PUBLIC_SITE_URL=https://maxpoll.vercel.app
```

Leave all three scopes (Production / Preview / Development) ticked for now. Phase 8
narrows `PAYMENTS_MODE` so Preview gets `test` while Production stays `coming_soon`.

### 3.3 Deploy

**Deploy**, then wait ~1 minute.

**You should see:** the MaxPoll shell — wordmark, the Phase 1 harness board, bottom
nav. Note the assigned URL; it'll be `maxpoll.vercel.app` or
`maxpoll-<something>.vercel.app` if that name is taken.

### 3.4 Register the live URL

Now that the URL exists, add it in both places, **alongside** the existing entries —
don't replace anything, or local development breaks:

1. **Google** → Clients → `MaxPoll Web` → Authorised JavaScript origins → add
   `https://<your-url>`
2. **Supabase** → Authentication → **URL Configuration**:
   - Site URL → `https://<your-url>`
   - Redirect URLs → add `https://<your-url>/**` and `http://localhost:3000/**`

### 3.5 Confirm the region pin

Deployment → **Functions** tab (or Project Settings → Functions) → the region should
read **Mumbai, India (bom1)**, from `vercel.json`. If it says Washington D.C., the
config didn't apply — tell me before Phase 5, because it costs ~250ms on every
uncached request.

```
=== SEND ME AFTER SECTION 3 ===
Deployment URL:  https://....................vercel.app
Function region shown in the dashboard:  ....................
```

---

## 4 · Razorpay — payments (test mode only)

**What it's for:** the ₹9 unlock. Built and fully tested now, hard-disabled in
production behind one env var.

> Not needed until **Phase 7**. Skip it if you'd rather get to a working product
> first — nothing before Phase 7 touches it.
>
> Production stays `coming_soon` regardless, for two reasons: real money needs KYC,
> and **Vercel Hobby forbids commercial use**.

### 4.1 Account and keys

1. **[razorpay.com](https://razorpay.com)** → **Sign Up** → email + password
2. Skip / dismiss any business-details prompt. **Test mode needs no KYC**
3. Top-right toggle → switch to **Test Mode**. ⚠️ Confirm it says Test before going
   further
4. **Account & Settings** → under *Website and app settings* → **API Keys**
5. **Generate Test Key**
6. ⚠️ A dialog shows **Key Id** and **Key Secret**. **Download the credentials** —
   the secret is shown once and is never retrievable. Regenerating invalidates the old pair

The webhook secret is a **different value** and comes in Phase 7, once a preview URL
exists to point it at.

```
=== SEND ME AFTER SECTION 4 (Phase 7) ===
Key Id:      rzp_test_....................
Key Secret:  ....................
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` | The Google redirect URI doesn't match exactly | It must be `https://<ref>.supabase.co/auth/v1/callback` — Supabase's URL, not localhost. No trailing slash. Changes take a few minutes to propagate |
| "Google hasn't verified this app" | Expected in Testing mode | Click **Advanced** → **Go to MaxPoll (unsafe)**. Normal until there's a real domain |
| A friend can't sign in | Not a listed test user | Google Auth Platform → Audience → Test users → add them |
| Lost the Razorpay secret | Shown once only | Generate a new key pair; the old one stops working |
| Supabase project "paused" | 7 days with no activity | Dashboard → Resume project. Data is intact. Won't happen during active development — dashboard visits count as activity |
| Vercel can't see the repo | Hobby can't use org repos, or permissions weren't granted | Keep the repo personal; Adjust GitHub App Permissions |
| Function region says `iad1` | `vercel.json` didn't apply | Tell me — it's ~250ms on every uncached request |
| Build fails on Vercel, fine locally | Usually a missing env var | Check the build log's first error, and that all three scopes are ticked |

## Teardown

Full procedures in [08-runbook.md](08-runbook.md) §4. Short version: **pause** the
Supabase project rather than deleting it (free, data kept for a year, and paused
projects don't count against the 2-project limit); delete the Vercel project from
Settings; Razorpay test mode holds nothing billable.
