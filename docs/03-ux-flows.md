# UX flows

Every screen, every state. Visual values live in [04-design.md](04-design.md).

## There are no password flows

Google OAuth is the only auth method, so **there are no passwords** — forgot,
reset and login-with-password do not exist and must not be built.

- "Sign up" and "Log in" are **the same button and the same flow**. Google returns
  the account if it exists, creates it if not. Label both, route both to one handler.
- **Account recovery = recover the Google account.** MaxPoll has nothing to reset.
- If a user loses Google access, that account is unreachable. State this in Settings.

This removes a class of work and an entire attack surface. Keep it.

---

## A — First visit (logged out)

```
maxpoll.vercel.app → landing (live board hero, growing counters, Log in / Sign up)
   → "Continue with Google" → Google consent → /onboarding
```

**Onboarding — one screen, ≤20s:**

| Field | Required | Notes |
|---|---|---|
| Handle | ✅ | unique, suggested from the Google name |
| Display name | ✅ | prefilled from Google |
| Date of birth | ✅ | **18+ gate. Never displayed publicly** |
| Bio | — | 150 chars |
| Instagram / X / Snapchat | — | unverified, decorative |

Under-18 → friendly hard stop: *"MaxPoll is 18+. Come back on your birthday."*
**Do not soft-gate this.**

→ lands on the Home feed.

## B — The critical path (link → vote → pay)

This is the flow that makes or breaks the product. Every extra tap costs users.

```
WhatsApp link tap
   → Poll page (counts hidden, totals visible, timer running)
   → tap an option
       ├─ logged out → Google sign-in → onboarding → back to poll, vote intent preserved
       └─ logged in, not in Space → JOIN SPACE SHEET
   → "Join DTU & cast my vote"  [🔓 Votes are public — name visible]
   → vote lands → counts unlock, animate up, gap line appears
   → scroll → under-list blurred → ₹9 sheet
```

**Rules:**
- Vote intent is stored in `localStorage` **before** redirecting to Google.
  **Losing it on return is the single most damaging bug that can ship.** It gets its
  own end-to-end test.
- Joining a Space is framed as belonging (*"You're in DTU 🎓 · 1,240 students"*),
  never as a gate.
- Voting auto-joins. No separate join step after the sheet.
- The disclosure line appears in the join sheet, on the landing page, and on the poll.

## C — Poll page states

| State | What shows |
|---|---|
| **Not voted** | Options with rank only, no counts. Totals in chips. Timer. `Tap a name to vote` |
| **Voted, free** | Ranks + % + counts on top 5, own pick marked, **gap line**, under-list ranks visible / counts blurred |
| **Voted, ₹9 paid** | Everything: exact counts on all options, full under-list, voter names per option, "voted same as you" |
| **Closed** | Winner banner, final board, chat read-only, `Share result` |
| **Space < 20 members** | Board hidden, `12/20 members to unlock results` + progress bar |
| **< 10 votes** | Board shown, but "results firm up at 10 votes" |
| **Removed** | `This poll was removed.` + report/appeal link |
| **Loading** | Skeleton rows at the real row height — no layout shift |

## D — Create poll

```
[+] → Space picker (your Spaces + search + "create Space")
    → Subject type: 👤 A person  |  🎬 A thing
        person → adjective dropdown (preset positive only)
                 "Best ___ " → user fills subject scope
        thing  → free-text title
    → Add 2–10 starting options
    → Timer: 6h / 24h / 3d / 7d / none
    → Private? (₹99 tier only)
    → Create → share sheet opens immediately
```

- Free tier: **3 polls/week**, enforced **server-side**. Counter shown:
  `2 of 3 left this week`.
- After creation the share sheet is the *default* next screen — never make them hunt.

**Adjective list (owner-controlled, positive only):** Best · Most helpful · Most
underrated · Funniest · Most reliable · Most improved · Hardest working

> ⚠️ **Superseded 2026-08-07 — [DECISIONS D10](DECISIONS.md).** The person-poll
> question is free-text now; this list is one-tap suggestions underneath it, not
> the only option. Left here as the record of what the preset-only rule was and
> why it existed, not as current behaviour.

> ⚠️ **The timer picker is also superseded.** `DeadlinePicker` (a quick-hours slider
> + a `datetime-local` picker, 7-day cap) replaced the six-option `<select>` shown
> above, on both Create and Manage poll.

## E — Add an option

```
"+ Add someone missing" → text field
   → 250ms debounce → trigram search
   → suggestions show LABEL · RANK · VOTE COUNT
   → similarity > 0.8 → warn: "Looks like X is already here"
   → [Vote for existing]  (primary)
      [Add as new anyway] (de-emphasised)
```

Blocked when `options_locked` (≥10 votes and the creator locked it) or the poll is
closed.

## F — Poll owner actions

| Action | Rule |
|---|---|
| Close early | Any time. Irreversible. Confirm |
| Extend timer | Any owner, any time — not tier-gated. `+1h`/`+6h`/`+24h` quick-extend, or the picker directly. This row originally said "₹99 tier only"; that was never built, and Phase 16 shipped it open on purpose — `update_poll()` has never gated on payment tier for anything else it does either |
| Remove an option | Only before 10 votes; after that **merge**, don't delete |
| **Merge options** | Combines vote counts. Available always. **Build before launch** |
| Delete poll | Confirm modal naming the count: *"Delete? 340 votes will be lost. This can't be undone."* Soft-delete 30 days, then purge |
| View analytics | ₹99 tier: velocity, unique devices, share count |

## G — Payments

The ₹9 sheet appears only *after* voting, and only when the user scrolls to locked
content. **Never on arrival.**

```
👀 See who voted
   ✓ Exact names of voters on all 28 options
   ✓ Exact counts & the full under-list
   ✓ Who voted the same as you
   ₹9  one time · this poll
   [ Pay ₹9 with UPI ]
   ₹99 unlocks every poll for 30 days + unlimited creating
```

Headline copy: **"See the exact names of voters."** Plain, not clever.

Tapping the CTA goes to `/pay/[ref]` — a page, not a modal. There is no gateway
overlay to keep alive, and the payer will leave to their UPI app and come back, so a
URL they can return to is the right container.

**States to build:** pending (QR + intent link + UTR form) · submitted
(`Got it — checking your payment. Usually within a few hours.`) · verified (unblur) ·
rejected (the admin's note, verbatim) · already-owned (skip the sheet entirely).

Note the honest difference from a gateway: **there is no "failed" state.** A UPI
payment either never happens — in which case the order sits `pending` and the payer
just leaves — or it happens and gets verified. Don't invent a failure screen for a
transaction MaxPoll never sees.

Full pipeline in [05-payments.md](05-payments.md).

## H — Activity (the return engine)

No web push on iOS, so this screen *is* retention. The badge count sits in the header
on every screen.

Types, ordered by conversion value:
1. **`same_as_you`** — *"9 people voted exactly like you"* — 2 names visible, rest
   blurred, `Unlock names · ₹9`. Two real names showing proves it isn't a tease; a
   fully blurred list reads as fake
2. `option_climbed` — *"Anand Sir climbed to #3. 17 votes from #2."*
3. `poll_closed` — result of a poll you voted in
4. `chat_reply` / `chat_hot` — *"47 people are chatting on a poll you voted in"*
5. `new_follower`
6. `badge_earned`

Email (Supabase SMTP) for `poll_closed` and `same_as_you` **only**. More than that
and people mute you.

## I — Spaces

- **Browse:** Your Spaces → Growing (with `12/20` progress) → Discover
- **Create:** name, slug, description (**required** — thin descriptions are how fakes
  get through), category. Fakes get removed; a `verified` tick marks real institutions
- **Join:** one tap, or implicit on first vote
- **Leave:** Settings → Spaces → leave

## J — Profile

Public and shareable at `maxpoll.vercel.app/@handle`.

Display name · @handle · bio · social chips · badges (top 2, rest under "see all") ·
**Followers / Following / Polls** · Follow + Share · tabs Created / Voted / Badges.

**No profile photo.** No storage cost, no moderation surface, no compression problem
— and it forces status to come from badges, which is the point.

## K — Settings

```
Account      handle · display name · bio · socials · DOB (locked after set)
Spaces       joined list, leave
Subscription plan, next billing, cancel, payment history
Privacy      who can follow · profile visibility
Notifications email toggles per activity type
About        terms · privacy · grievance officer · 18+ policy
Sign out
Delete account   ← required under DPDP
```

**Delete account:** confirm by typing the handle → 30-day soft delete → purge. Votes
become anonymous (`user_id` nulled) rather than deleted, so poll counts don't
retroactively change. **State this in the confirm copy.**

**Sign out:** clears the Supabase session + `localStorage`, returns to the landing
page. Confirm only if an unsaved poll draft exists.

## L — Share

Native `navigator.share()` where available, else copy-link with a toast.

Prefilled: `bhai isme vote kardo 👇 maxpoll.vercel.app/dtu-teacher`
From the gap line, prefill instead: `Anand Sir is 17 votes behind, vote kardo 👇`

---

## Empty & error states — instructions, never apologies

| Screen | Copy |
|---|---|
| No polls in Space | `No polls yet. Be the first — it takes 30 seconds.` + [Create] |
| No options | `Nobody's been added yet. Add the first name.` |
| Space growing | `12/20 members to unlock results` + progress + [Invite] |
| Activity empty | `Nothing yet. Vote on a poll and you'll see who agreed with you.` |
| Poll not found | `This poll doesn't exist or was removed.` + [Browse] |
| Already voted | `You've already voted here.` + show board |
| Offline | `You're offline. Your vote will send when you reconnect.` |
| Rate limited | `Slow down a second.` |
| Search, no results | `No matches. Add them as a new option.` |
| Load failed | `Couldn't load the board.` + [Try again] |

## Accessibility floor

48px touch targets · visible keyboard focus (including on dark surfaces) · WCAG AA
contrast, measured not eyeballed · `aria-live="polite"` on the board so rank changes
are announced · real `<button>`/`<a>` elements, never clickable divs · alt text on
emoji used as meaning · `prefers-reduced-motion` respected.
