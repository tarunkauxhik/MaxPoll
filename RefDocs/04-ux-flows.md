# 04 — UX Flows (every screen, every state)

---

## ⚠️ CORRECTION: password flows do not exist

You asked for **forgot password / reset password / login**. With **Google OAuth as the only auth method there are no passwords**, so those three flows don't exist and must not be built. You have exactly one door:

- "Sign up" and "Log in" are **the same button and the same flow** — Google returns the account if it exists, creates it if not. Label both, route both to the same handler.
- **Account recovery = recover the Google account.** MaxPoll has nothing to reset.
- If a user loses Google access, that account is unreachable. State this in Settings.

This removes a whole class of work and an entire attack surface. Keep it.

---

## FLOW A — First visit (logged out)

```
maxpoll.vercel.app → landing (live board hero, growing counters, Log in / Sign up)
   → "Continue with Google" → Google consent → /onboarding
```

**Onboarding (one screen, ≤20s):**
| Field | Required | Notes |
|---|---|---|
| Handle | ✅ | unique, suggested from Google name |
| Display name | ✅ | prefilled from Google |
| Date of birth | ✅ | **18+ gate. Never displayed publicly.** |
| Bio | — | 150 chars |
| Instagram / X / Snapchat | — | unverified, decorative |

Under-18 → friendly hard stop: *"MaxPoll is 18+. Come back on your birthday."* Do not soft-gate this.

→ lands on **Home feed**

---

## FLOW B — The critical path (link → vote → pay)

This is the flow that makes or breaks the product. Every extra tap costs you users.

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
- Vote intent is stored in `localStorage` **before** redirecting to Google. Losing it on return is the single most damaging bug you can ship.
- Joining a Space is framed as belonging (*"You're in DTU 🎓 · 1,240 students"*), never as a gate.
- Voting auto-joins. No separate join step after the sheet.
- The disclosure line appears in the join sheet, on the landing page, and on the poll.

---

## FLOW C — Poll page states

| State | What shows |
|---|---|
| **Not voted** | Options with rank only, no counts. Totals in chips. Timer. `Tap a name to vote` |
| **Voted, free** | Ranks + % + counts on top 5, own pick marked, **gap line**, under-list ranks visible / counts blurred |
| **Voted, ₹9 paid** | Everything: exact counts all options, full under-list, voter names per option, "voted same as you" |
| **Closed** | Winner banner, final board, chat read-only, `Share result` |
| **Space < 20 members** | Board hidden, `12/20 members to unlock results` + progress bar |
| **< 10 votes** | Board shown, but "results firm up at 10 votes" |
| **Removed** | `This poll was removed.` + report/appeal link |

**Timer:** inverted dark block (only dark element on a paper page). Gold progress ring, monospaced `04:12:07`, red bar draining below. **Under 1 hour** → deep red gradient, ⏳ pulses, and the number switches to `MM:SS`.

---

## FLOW D — Create poll

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

- Free tier: **3 polls/week**, enforced at creation. Counter shown: `2 of 3 left this week`.
- After creation the share sheet is the *default* next screen — never make them hunt for it.

**Adjective list (owner-controlled, positive only):** Best · Most helpful · Most underrated · Funniest · Most reliable · Most improved · Hardest working

## FLOW E — Add an option
```
"+ Add someone missing" → text field
   → 250ms debounce → trigram search
   → suggestions show LABEL · RANK · VOTE COUNT
   → similarity > 0.8 → warn: "Looks like X is already here"
   → [Vote for existing]  (primary)
      [Add as new anyway] (de-emphasised)
```
Blocked when `options_locked` (poll has ≥10 votes and creator locked it) or poll closed.

## FLOW F — Poll owner actions
| Action | Rule |
|---|---|
| Close early | Any time. Irreversible. Confirm. |
| Extend timer | ₹99 tier only |
| Remove an option | Only before 10 votes; after that **merge**, don't delete |
| **Merge options** | Combines vote counts. Available always. Build this before launch. |
| Delete poll | Confirm modal naming the vote count: *"Delete? 340 votes will be lost. This can't be undone."* Soft-delete 30 days, then purge. |
| View analytics | ₹99 tier: velocity, unique devices, share count |

## FLOW G — Payments

**₹9 sheet** — appears only *after* voting, and only when they scroll to locked content. Never on arrival.
```
👀 See who voted
   ✓ Exact names of voters on all 28 options
   ✓ Exact counts & the full under-list
   ✓ Who voted the same as you
   ₹9  one time · this poll
   [ Pay ₹9 with UPI ]
   ₹99/month unlocks every poll + unlimited creating
```
Headline copy: **"See the exact names of voters."** Plain, not clever.

**Flow:** Razorpay Standard Checkout → webhook to a Next.js Route Handler → verify signature → insert `entitlements` row → client polls `/api/entitlement` → content unblurs with the count-up animation.

**States to build:** processing · success (unblur) · failed (`Payment didn't go through. You weren't charged.` + retry) · already-owned (skip sheet entirely).

**₹99 subscription:** Razorpay Subscriptions, monthly/annual toggle, `Manage` in Settings, cancel = access until period end. Non-refundable, stated before payment — MDR isn't returned on refunds, so a ₹9 refund costs you more than the sale.

## FLOW H — Activity (the return engine)
No web push on iOS, so this screen *is* retention. Badge count sits in the header on every screen.

Types, ordered by conversion value:
1. **`same_as_you`** — *"9 people voted exactly like you"* — 2 names visible, rest blurred, `Unlock names · ₹9`. Two real names showing proves it isn't a tease; a fully blurred list reads as fake.
2. `option_climbed` — *"Anand Sir climbed to #3. 17 votes from #2."*
3. `poll_closed` — result of a poll you voted in
4. `chat_reply` / `chat_hot` — *"47 people are chatting on a poll you voted in"*
5. `new_follower`
6. `badge_earned`

Also send email (Supabase SMTP) for `poll_closed` and `same_as_you` only. More than that and people mute you.

## FLOW I — Spaces
- **Browse:** Your Spaces → Growing (with `12/20` progress) → Discover
- **Create:** name, slug, description (required — thin descriptions are how fakes get through), category. You can remove fakes; add a `verified` tick for real institutions.
- **Join:** one tap, or implicit on first vote
- **Leave:** Settings → Spaces → leave

## FLOW J — Profile
Public, shareable at `maxpoll.vercel.app/@handle`.

Display name · @handle · bio · social chips · badges (top 2, rest under "see all") · **Followers / Following / Polls** · Follow + Share buttons · tabs: Created / Voted / Badges.

**No profile photo.** No storage cost, no moderation surface, no compression problem — and it forces status to come from badges, which is the point.

## FLOW K — Settings
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
**Delete account:** confirm by typing handle → 30-day soft delete → purge. Votes become anonymous (`user_id` nulled) rather than deleting, so poll counts don't retroactively change. State this in the confirm copy.

**Sign out:** clears Supabase session + `localStorage`, returns to landing. Confirm only if unsaved poll draft exists.

## FLOW L — Share
Native `navigator.share()` where available, else copy-link with toast.

Prefilled text: `bhai isme vote kardo 👇 maxpoll.vercel.app/dtu-teacher`
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

---

## Motion spec
| Element | Motion |
|---|---|
| **Rank rows** | FLIP transform 340ms `cubic-bezier(.22,1,.36,1)` — the signature |
| ▲▼ badge | fade + 4px rise, 240ms, on rank change |
| Counters | count-up 600ms ease-out, monospaced |
| Fill bars | width transition 500ms |
| Sheets | slide up 280ms, backdrop fade 200ms |
| Unblur on payment | 400ms blur→0 with count-up |
| Live dot | 1.9s pulse |
| Timer <1h | 2s opacity pulse |

Only `transform` and `opacity` animate. Everything respects `prefers-reduced-motion`.

## Accessibility floor
48px touch targets · visible keyboard focus · WCAG AA contrast (check gold on white — darken to `#9A6E05` for text) · `aria-live="polite"` on rank changes · alt text on emoji used as meaning.
