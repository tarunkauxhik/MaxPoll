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

### 1.3 Turn Email **off**, and Google on

1. Left sidebar → **Authentication** → **Sign In / Providers**
2. ⚠️ **Find Email and toggle it OFF.** It is **on by default**, and leaving it on
   means anyone can create a real account by calling `POST /auth/v1/signup` directly
   — the publishable key needed to do that ships in the browser bundle by design.
   Building no password UI does not close that door. Verified against this project:
   a signup with an arbitrary address created a genuine user row.

   MaxPoll has exactly one door, and it's Google. This is the toggle that makes the
   "no password surface" claim actually true.
3. Find **Google**, toggle it **on**
4. Leave Client ID and Secret empty — section 2 fills them
5. Copy the **Callback URL (for OAuth)** shown in that panel. It looks like
   `https://<your-ref>.supabase.co/auth/v1/callback`. Google needs this exact string
6. **Save**

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

### 2.3 Audience — Testing while you build, Production before you launch

1. Left menu → **Audience**
2. While building, **Testing** is fine. Add yourself under **Test users → Add users**,
   plus anyone who needs to sign in.
3. Before real users: **Publish app**. See §2.6.

> **⚠️ This section used to say "leave it in Testing, publishing needs a verified
> domain and `*.vercel.app` can't be verified". That was wrong**, and it invented a
> launch blocker that never existed. Corrected 2026-08-05.
>
> MaxPoll requests only `openid`, `email` and `profile` — all **non-sensitive**.
> Google does not require verification for those, so nothing goes into a review
> queue. And because they're basic profile scopes, **there is no "unverified app"
> warning and no 7-day token expiry even in Testing.**
>
> Testing mode's one real limitation is the **100-test-user cap**, each added by
> hand. That is the only thing publishing changes.

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

### 2.7 Publish — the step that lets strangers sign in

Do this once `/privacy` and `/terms` are live on your domain. Google's Branding step
rejects URLs that don't resolve, so this order matters.

1. `console.cloud.google.com` → select the project holding `MaxPoll Web`
2. **Google Auth Platform → Branding**:
   - App name `MaxPoll`, user support email, developer contact email
   - **App home page** `https://<your-domain>`
   - **Privacy policy** `https://<your-domain>/privacy`
   - **Terms of service** `https://<your-domain>/terms`
3. **Authorised domains** → `<your-domain>` **only**. If `supabase.co` appears,
   remove it — it belongs in redirect URIs, and you cannot verify a domain you don't
   own.
4. Verify the domain in [Google Search Console](https://search.google.com/search-console),
   signed in as **the same Google account that owns the Cloud project** — otherwise
   the OAuth system won't see the ownership. Add the TXT record wherever your DNS
   lives (Vercel, if the nameservers point there).
5. **Data access** → confirm only `openid`, `…/userinfo.email`, `…/userinfo.profile`.
   All non-sensitive, so **there is nothing to submit and no review to wait for.**
6. **Audience → Publish app → Confirm.** Status reads *In production*.
7. **Clients → `MaxPoll Web` → Authorised JavaScript origins** → add
   `https://<your-domain>`. The **redirect URI does not change** — it points at
   Supabase.

> **The only proof that matters:** sign in with a Google account that is *not* on the
> test-user list. Everything else is a setting that looks right.

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

## 4 · PhonePe for Business — how you actually get paid

**What it's for:** the ₹9 unlock and the ₹99 pass. The payer sends money from
their own UPI app to your business VPA, types the 12-digit reference number back
into MaxPoll, and you approve it from `/admin`.

**Zero MDR** — ₹9 arrives as ₹9. There is no gateway, no webhook, and no
integration to get wrong. See [05-payments.md](05-payments.md).

> Not needed until **Phase 7**. Nothing before it touches payments.
>
> ⚠️ Start this early anyway if you can — it is the only step here with a
> **human approval delay**. Everything else in this document is instant.

### 4.1 Why a *business* account and not your personal UPI

Two reasons, and the first is the one that matters to you:

1. **Your personal name is hidden.** A personal VPA shows your legal name on the
   payer's confirmation screen. A business account shows your **brand name** —
   strangers on the internet paying you ₹9 see "MaxPoll", not you.
2. Collecting business payments on a personal VPA is against NPCI norms once
   there's any volume, and personal accounts carry P2P transaction limits.

### 4.2 Onboard

1. Install **PhonePe Business** (Play Store / App Store) — a different app from
   consumer PhonePe
2. Register with the phone number linked to the bank account you want paid into
3. Business name → **`MaxPoll`**. ⚠️ **This exact string is what payers see.**
   Check it on a real payment before you launch
4. Category → *Digital services / Internet services*
5. Documents. Expect to need **PAN**, a **bank account** (cancelled cheque or a
   3-month statement), and **Aadhaar or another photo ID**. A **GST certificate**
   may be requested — if you're under the registration threshold, look for the
   declaration / "not registered" option rather than abandoning the flow
6. Wait for approval, then find your **VPA** in the app — it looks like
   `something@ybl`

### 4.3 If PhonePe won't onboard you

**Google Pay for Business** is the drop-in fallback — same UPI rails, same
`upi://` intent link, and the only thing that changes in the codebase is the
`NEXT_PUBLIC_UPI_VPA` string. Nothing in MaxPoll is PhonePe-specific.

Don't fall back to a personal VPA to get unblocked. That's the one option that
puts your legal name in front of every payer.

### 4.4 Verify it before you trust it

**Send yourself ₹1 from a different phone.** Then check:

- [ ] The payer's screen says **MaxPoll**, not your personal name
- [ ] The payment lands in PhonePe Business
- [ ] You can find the **12-digit UTR** in the app's transaction history —
      this is the number you'll be matching against every single order

That last one is the whole verification loop. If you can't find UTRs easily in
the app, the admin queue will be painful, and that's worth knowing now.

```
=== SEND ME AFTER SECTION 4 (Phase 7) ===
Business VPA:   ....................@ybl
Display name:   MaxPoll            (or whatever it actually shows)
Your profile UUID for admin access — I'll get this from the DB after you first
sign in, so nothing to send.
```

### 4.5 Razorpay — later, not now

Your test keys are already in `.env.local` and unused. Razorpay becomes worth it
when verifying UTRs by hand stops fitting into one sitting a day —
[05-payments.md](05-payments.md) §5. Nothing to do today.

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
