# 01 — About MaxPoll

**Domain:** maxpoll.vercel.app · **Platform:** Web only (mobile-first, works on desktop) · **Market:** India, Gen Z, 18+

---

## One line
Make a poll about anything. Watch names climb a live leaderboard. Every vote is on the record.

## What it actually is
A site of **Spaces** (a college, an office, a fandom, "India"). Inside a Space, anyone creates a **poll**. A poll is a ranked leaderboard, not a survey:

- Top 5 shown prominently, ranked
- An **under-list** below — anyone can add an option, and it climbs if it gets votes
- Totals always visible (`340 votes · 28 options`)
- **Per-option splits and voter names are the paid layer**

## Why it isn't a WhatsApp poll
| WhatsApp poll | MaxPoll |
|---|---|
| Dies in one group | Spans a whole college via Spaces |
| Fixed options | Anyone adds options; they climb |
| Scrolls away in an hour | Permanent page, indexable, shareable |
| Just counts | Ranks, gaps, movement, voter names |

The competitive layer is the product. A poll asks an opinion; MaxPoll runs a **contest** — which is why people campaign, and campaigning is the growth engine.

## The core emotional loop
1. Someone sees their pick sitting at #6, 17 votes off #5
2. The gap line tells them exactly that, for free
3. They share the link to close the gap
4. New voters arrive, board moves, ▲ badges flash
5. Curiosity about *who* voted → ₹9

**The paywall is downstream of the loop, never blocking it.**

## Positioning rules
- **Not anonymous.** Votes are public by design. Say it on the landing page, in the join sheet, and on the poll. This is what separates selling depth from selling a betrayal.
- **18+ only.** Minors bring DPDP verifiable-parental-consent obligations you cannot service solo.
- **Person-polls use preset positive adjectives** (best / most helpful / most underrated) from an owner-controlled list. Users pick *who*; the system owns the *adjective*.
- **iOS emoji everywhere** — bundle Apple Color Emoji with an SBIX fallback so Android renders identically. Mixed emoji sets are the fastest tell of a side project.

## Design identity
- **Gold `#F5B324`** — rank 1 only (medal logic, earned)
- **Violet `#6B4EFF`** — movement only (live, climbing, gaps, growing Spaces)
- **Red `#E8452C`** — time pressure only (timers, ▼ drops)
- **Paper `#FAFAF7`** base, ink `#111114`
- **Archivo 800/900** for titles, **Space Grotesk** for UI, **Space Mono for every number** (tabular digits don't jitter when counts tick live)
- **One signature motion:** rank rows sliding on recompute. Everything else is still. Scattered animation reads amateur; one orchestrated moment reads considered.

## What MaxPoll is not
Not a dating app. Not anonymous confessions. Not a survey tool. Not a chat app that happens to have polls.
