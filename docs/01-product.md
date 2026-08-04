# Product

**Domain:** maxpoll.vercel.app · **Platform:** web only, mobile-first · **Market:** India, Gen Z, 18+

## One line

Make a poll about anything. Watch names climb a live leaderboard. Every vote is on
the record.

## What it actually is

A site of **Spaces** (a college, an office, a fandom, "India"). Inside a Space,
anyone creates a **poll**. A poll is a ranked leaderboard, not a survey:

- Top 5 shown prominently, ranked
- An **under-list** below — anyone can add an option, and it climbs if it gets votes
- Totals always visible (`340 votes · 28 options`)
- **Per-option splits and voter names are the paid layer**

| WhatsApp poll | MaxPoll |
|---|---|
| Dies in one group | Spans a whole college via Spaces |
| Fixed options | Anyone adds options; they climb |
| Scrolls away in an hour | Permanent page, indexable, shareable |
| Just counts | Ranks, gaps, movement, voter names |

The competitive layer is the product. A poll asks an opinion; MaxPoll runs a
**contest** — which is why people campaign, and campaigning is the growth engine.

## The core loop

1. Someone sees their pick sitting at #6, 17 votes off #5
2. The gap line tells them exactly that, **for free**
3. They share the link to close the gap
4. New voters arrive, the board moves, ▲ badges flash
5. Curiosity about *who* voted → ₹9

**The paywall is downstream of the loop, never blocking it.**

```
WhatsApp link → poll page → vote → join Space → sees gap
     ↑                                              ↓
     └──────────── shares to close the gap ─────────┘
```

Secondary loop: **add an option** → the person added shows up to see → they vote
and share.

## Positioning rules

- **Not anonymous.** Votes are public by design. Say it on the landing page, in the
  join sheet, and on the poll. This is what separates selling depth from selling a
  betrayal.
- **18+ only.** Minors bring DPDP verifiable-parental-consent obligations that
  cannot be serviced solo.
- **Person-polls use preset positive adjectives** (best / most helpful / most
  underrated) from an owner-controlled list. Users pick *who*; the system owns the
  *adjective*.

**What MaxPoll is not:** a dating app · anonymous confessions · a survey tool · a
chat app that happens to have polls.

---

## The untested assumption

Everything rests on one thing: **do poll links travel between WhatsApp groups on
their own?** Not "does someone paste it once" — does a poll posted in group A appear
in group B without you doing it.

Test this in week 1 with 3 real polls **before building anything past the vote flow**.
⚠️ marks an assumption; ✅ marks something controlled.

## Users

| User | ~% | Wants | Reward |
|---|---|---|---|
| **Voter** | 95% | Settle the argument | Sees the board, sees the gap |
| **Creator** | ~2% | Start the argument, run something | Top Creator badge, poll analytics |
| **Payer** | 1–3% of engaged | Know who voted | ₹9 unlock |

## Pricing

**Free forever (must stay complete):**
Vote unlimited · see ranks, percentages and the gap · add options · totals
(`340 votes · 28 options`) · join Spaces · create 3 polls/week · chat

**₹9 — one time, per poll**
- **"See the exact names of voters"** ← the headline, use this exact phrasing
- Exact counts on every option
- Full under-list
- Who voted the same as you

**₹99/month or ₹599/year**
- Names + counts on every poll · unlimited poll creation · private polls (link-only,
  results to creator) · extend/restart timers · creator analytics

### Why ₹9 one-time, not a subscription
UPI Autopay needs a mandate — several taps of friction for nine rupees. Nobody sets
that up. One-time UPI is a two-tap impulse buy at peak curiosity, and it repeats
naturally per poll. ₹99/mo is the upgrade for people who've paid ₹9 three times.

### Payment economics ✅
Razorpay standard TDR is **2% + GST, percentage-based, no flat per-transaction fee**.
₹9 nets ≈ ₹8.79. Bank-to-bank UPI carries government-mandated zero MDR; Razorpay's
2% is their platform fee on top. RuPay-credit-on-UPI is 2.15% + GST — immaterial at ₹9.

**Never charge to see ranks, percentages, or the gap.** Those create the urgency that
drives sharing. Hiding them would fight your own growth loop.

## Metrics

| Metric | Why | Target ⚠️ |
|---|---|---|
| **Link travel rate** | The whole thesis | Poll appears in ≥1 group you didn't post to |
| Vote → join-Space | Friction check | >50% |
| Options added per 100 votes | Growth loop health | >3 |
| Create : vote ratio | Supply health | >1:50 |
| ₹9 conversion (of voters) | Revenue | 1–3% |

If **create:vote** falls below 1:50 you have a consumption product with no engine.

## Honest revenue picture ⚠️

At 10,000 monthly voters and 2% conversion at ₹9 → **~₹1,800/month**. This is small.
It compounds only if link-travel works and Spaces multiply.

Do not model this as fast money. Model it as: near-zero running cost, so it can be
wrong for a long time without hurting you.

## Launch sequence

1. **Week 0** — seed 1 Space (your college) + 20–30 polls. Get 8–10 real friend-votes
   on each *before* posting publicly. A poll at 2 votes looks dead.
2. **Week 1** — post 3 polls into real groups. Measure link travel.
   **Stop and rethink if it's zero.**
3. **Week 2–4** — recruit the 5–10 people who create polls unprompted. They are your
   distribution.
4. **Month 2** — second campus, carried in by someone from campus one. Add fandom
   Spaces (cricket/anime/music) as holiday insurance — college dies 3× a year.
5. **Month 3+** — payments on, once free limits actually bite.

## Seeded numbers — read this before faking anything ⚠️

Count-up animation on the logged-out landing page is **fine and good**. Fabricated
engagement numbers are **not**: that is specifically what the FTC fined NGL $5M for
(simulated activity), and it's trivially caught when a user with 4 friends sees
"2,412 voting now".

Instead:
- Run the animation on **real** aggregate numbers
- Seed real data (your 20–30 polls, your friends' real votes) so the real numbers
  aren't zero
- Round up honestly ("1.2k+ votes"), never invent
- If you have nothing yet, show **activity** rather than counts: recent poll titles
  scrolling, "18 live polls"

Same premium, alive feeling — without a number you'd have to defend.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Links don't travel | **Fatal** | Week-1 test before building further |
| Poll supply dries up | High | Seed heavily; recruit creators personally; Top Creator status |
| Empty Space looks dead | High | 20-member gate showing "12/20 to unlock" |
| Vote gaming (multi-device) | Medium | Accepted; rate-limit velocity, flag don't block |
| Person-poll defamation | High | Preset positive adjectives; report → auto-hide at 3 reports |
| College seasonality | Medium | Fandom Spaces from day one |
| Public votes chill honesty | Medium | Accept: spicy polls get thinner data. Price it in |
