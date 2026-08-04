# 02 — Business PRD

---

## 1. The untested assumption
Everything here rests on one thing: **do poll links travel between WhatsApp groups on their own?** Not "does someone paste it once" — does a poll posted in group A appear in group B without you doing it.

Test this in week 1 with 3 real polls before building anything past the vote flow. ⚠️ = assumption. ✅ = controlled.

## 2. Users
| User | ~% | Wants | Reward |
|---|---|---|---|
| **Voter** | 95% | Settle the argument | Sees the board, sees the gap |
| **Creator** | ~2% | Start the argument, run something | Top Creator badge, poll analytics |
| **Payer** | 1–3% of engaged | Know who voted | ₹9 unlock |

## 3. Pricing

**Free forever (must stay complete):**
Vote unlimited · see ranks, percentages and the gap · add options · totals (`340 votes · 28 options`) · join Spaces · create 3 polls/week · chat

**₹9 — one time, per poll**
- **"See the exact names of voters"** ← this is the headline, use this exact phrasing
- Exact counts on every option
- Full under-list
- Who voted the same as you

**₹99/month or ₹599/year**
- Names + counts on every poll
- Unlimited poll creation
- Private polls (link-only, results to creator)
- Extend/restart timers
- Creator analytics

### Why ₹9 one-time, not a subscription
UPI Autopay needs a mandate — several taps of friction for nine rupees. Nobody sets that up. One-time UPI is a two-tap impulse buy at peak curiosity, and it repeats naturally per poll. ₹99/mo is the upgrade for people who've paid ₹9 three times.

### Payment economics ✅
Razorpay standard TDR is **2% + GST, percentage-based, no flat per-transaction fee**. ₹9 nets ≈ ₹8.79. Bank-to-bank UPI carries government-mandated zero MDR; Razorpay's 2% is their platform fee on top. RuPay-credit-on-UPI is 2.15% + GST — immaterial at ₹9.

**Never charge to see ranks, percentages, or the gap.** Those create the urgency that drives sharing. Hiding them would fight your own growth loop.

## 4. Growth model
```
WhatsApp link → poll page → vote → join Space → sees gap
     ↑                                              ↓
     └──────────── shares to close the gap ─────────┘
```
The gap line ("17 votes behind Verma Ma'am. Share to close the gap") is simultaneously the FOMO and the call to action. It hands the user a reason to share *and* tells them what sharing achieves.

Secondary loop: **add an option** → the person added shows up to see → they vote and share.

## 5. Metrics that matter
| Metric | Why | Target ⚠️ |
|---|---|---|
| **Link travel rate** | The whole thesis | Poll appears in ≥1 group you didn't post to |
| Vote → join-Space | Friction check | >50% |
| Options added per 100 votes | Growth loop health | >3 |
| Create : vote ratio | Supply health | >1:50 |
| ₹9 conversion (of voters) | Revenue | 1–3% |

If **create:vote** falls below 1:50 you have a consumption product with no engine.

## 6. Honest revenue picture ⚠️
At 10,000 monthly voters and 2% conversion at ₹9 → ~₹1,800/month. This is small. It compounds only if link-travel works and Spaces multiply.

Do not model this as fast money. Model it as: near-zero running cost, so it can be wrong for a long time without hurting you.

## 7. Launch sequence
1. **Week 0** — seed 1 Space (your college) + 20–30 polls. Get 8–10 real friend-votes on each *before* posting publicly. A poll at 2 votes looks dead.
2. **Week 1** — post 3 polls into real groups. Measure link travel. **Stop and rethink if it's zero.**
3. **Week 2–4** — recruit the 5–10 people who create polls unprompted. They are your distribution.
4. **Month 2** — second campus, carried in by someone from campus one. Add fandom Spaces (cricket/anime/music) as holiday insurance — college dies 3× a year.
5. **Month 3+** — payments on, once free limits actually bite.

## 8. Seeded numbers — read this before you fake anything ⚠️
You wanted dummy counters on the logged-out landing page that grow live. **The count-up animation is fine and good.** Fabricated engagement numbers are not: that is specifically what the FTC fined NGL $5M for (simulated activity), and it's trivially caught when a user with 4 friends sees "2,412 voting now."

Do this instead:
- Run the animation on **real** aggregate numbers
- Seed real data (your 20–30 polls, your friends' real votes) so the real numbers aren't zero
- Round up honestly ("1.2k+ votes"), never invent
- If you have nothing yet, show activity rather than counts: recent poll titles scrolling, "18 live polls"

You get the same premium, alive feeling without a number you'd have to defend.

## 9. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Links don't travel | **Fatal** | Week-1 test before building further |
| Poll supply dries up | High | Seed heavily; recruit creators personally; Top Creator status |
| Empty Space looks dead | High | 20-member gate showing "12/20 to unlock" |
| Vote gaming (multi-device) | Medium | Accepted by owner; rate-limit velocity, flag don't block |
| Person-poll defamation | High | Preset positive adjectives; report → auto-hide at N reports |
| College seasonality | Medium | Fandom Spaces from day one |
| Public-votes chills honesty | Medium | Accept: spicy polls get thinner data. Price it in. |
