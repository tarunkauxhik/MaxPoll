# Design

`app/globals.css` is the visual source of truth. This file explains it — the tokens,
the scale, the breakpoints, and the floor every screen has to clear. It does not
duplicate it.

There are no per-component pixel specs here, deliberately. The previous version of this
file had seventeen of them, they duplicated the CSS, the CSS moved, and the specs rotted
into a document that confidently described a design that had not existed for three
phases. If you want to know what `.opt` looks like, read `.opt`.

Rationale for anything below lives in [DECISIONS.md](DECISIONS.md) D15, which wins.

---

## 1 · Surfaces

One theme. Light-based, with dark chrome. No toggle, no `prefers-color-scheme`.

Light where you read — the page, cards, forms, the board, legal text — **and the top
bar**. Dark where you navigate or where the design wants weight: the bottom nav,
primary buttons, the timer panel, monogram tiles, your own chat bubbles.

The two bars are treated differently on purpose. At the bottom, a dark bar separates
navigation from content, sits where the thumb lives and grounds the page. At the top,
the same treatment is a heavy slab across the thing you are reading, competing with the
content on every screen — so the top bar recedes to a near-white surface with a hairline
and a scroll shadow.

```css
--paper: #F4F6FA   /* page */
--card:  #FFFFFF   /* cards, sheets, inputs, the top bar */
--line:  #E2E7F0   /* decorative hairlines */
--line-strong: #79859F  /* form control borders — these are UI boundaries, 3:1 */

--dark:   #121A2E  /* chrome: bottom nav, primary buttons, timer, tiles */
--dark-2: #1E2942  /* the raised stop in a dark gradient */
```

## 2 · Text

Every value below is measured against both `--paper` and `--card`. The lower of the two
is quoted.

| Token | Value | Ratio | Carries |
|---|---|---|---|
| `--ink` | `#101828` | 16.4:1 | headings, names, primary copy |
| `--body` | `#3D485C` | 8.5:1 | paragraphs |
| `--muted` | `#59637A` | 5.6:1 | sublines, labels, timestamps, nav |
| `--on-dark` | `#FFFFFF` | 17.3:1 | text on the chrome |
| `--on-dark-dim` | `#AAB4CC` | 8.3:1 | secondary text on the chrome |

## 3 · Colour, and the one job each has

**Gold is rank 1. Indigo is movement. Red is time pressure. Green is rank gain.**
Nothing gets a colour to decorate — reach for `--line` or `--muted` instead.

Each accent ships as a family, because **a brand colour is a surface colour** and the
same hue used as text usually fails contrast. Never substitute one member for another.

| | fill | as text | soft pill | on the chrome |
|---|---|---|---|---|
| indigo — movement, focus, wordmark | `#3B4FD8` | `#2E3DAE` 8.1:1 | `#E9ECFC` | `#A9B6FF` 8.9:1 |
| gold — **rank 1 only** | `#C08A0E` | `#7E5C07` 6.1:1 | `#FBF1DA` | `#F0BE4A` 10.0:1 |
| red — **time pressure only** | `#D93B20` | `#B23018` 6.3:1 | `#FCE9E4` | `#FF9B80` 8.5:1 |
| green — **rank gain only** | `#157F4A` | `#0F6B3D` 6.6:1 | `#E2F5EA` | — |

Indigo is in the same family as the chrome on purpose. An unrelated accent hue against
navy reads as two colours sharing a page; this reads as one system.

### Contrast is measured, never eyeballed

`pnpm check:contrast` parses the shipped `globals.css` and checks all 33 pairs against
WCAG 2.1 — 4.5:1 for text, 3:1 for UI boundaries. It runs inside `pnpm check`, so a
failing pair cannot reach a commit. If you add a token that carries text, add its pair.

Tightest margin in the file is 3.05:1 on a 3:1 floor (`--gold` as the rank-1 card
border). Nudge it before adding anything near it.

## 4 · Type

Two faces. That is the whole list.

| Face | Token | Weights | Used for |
|---|---|---|---|
| **Lora** | `--font-serif` | **400 / 500 — never 600+** | `.t-hero`, `.t-title`, `.t-card`, card titles |
| **Inter** | `--font-ui` | 400–800 | everything else, including `.num` |

Lora is variable 400–700 and *can* go bold, so **the cap is enforced by the gate**, not
by memory: `check-contrast.mjs` fails the build if a rule setting `--font-serif` also
sets a weight of 600 or more.

Lora is a *text* serif carrying display sizes, which changes how it wants to be set:
more line-height and much less negative tracking than a display face would take.
Squeezing it closes its counters and it stops reading as a serif.

`.wordmark` is pinned to Inter 800 and does not follow `--font-serif`. A synthetically
bolded serif logotype is worse than a logotype that doesn't match the headline face.

**Every number goes in `.num`** — Inter with `font-variant-numeric: tabular-nums`.
Proportional digits change width as counts tick, so live rows jitter without it, and
that is the fastest way a leaderboard looks cheap.

Scale: 13 · 14 · 15 · 16 (body floor) · 17 · 27 · 40 · clamp(33, 8.8vw, 50) for the
hero. Body line-height 1.5. Inputs never below 16px — iOS zooms the viewport otherwise.

## 5 · Geometry, elevation, motion

```css
--r-sm:12px  --r-md:16px  --r-lg:22px  --r-xl:28px
--s-1:4px  --s-2:8px  --s-3:12px  --s-4:16px  --s-6:24px
--tap:48px       /* minimum touch target */
--tap-sm:44px    /* dense rows — WCAG 2.5.5 floor, never below */
--ease: cubic-bezier(.22,1,.36,1)
```

Three elevation stops, not one-offs: `--shadow-1` (cards), `--shadow-lift` (pressed and
hover), `--shadow-2` (sheets). Each is three layers — a tight contact shadow, a mid
lift, a wide ambient — because one blurred shadow reads as a sticker and two read as a
card. `--ring` is a 1px inner top highlight; it is what makes a surface read as lit
rather than as a rectangle with a border.

Motion 150–300ms on `transform` and `opacity` only. Press states pair `scale()` with a
background change — `scale()` alone is unreliable on Android. Everything sits behind
`prefers-reduced-motion`, and animations must be written so that *disabled* is the
correct resting state (bars animate `scaleX` from 0 to 1, so reduced-motion leaves them
at full width, not at zero).

Layers: `--z-nav:20  --z-top:30  --z-backdrop:40  --z-sheet:50`. Declared once so no
layer gets invented ad hoc.

## 6 · Layout — mobile first, then up

Designed at 360px. Everything else is a step up from there.

**One gutter, `--gut`.** Never hardcode a horizontal page padding — that is the single
rule that keeps screens lining up with each other. There used to be three different
values (the poll page on 12px, the feed on 14px, every `*wrap` page on 16px), so a
card's left edge moved as you navigated. That is most of what reads as "congested".

| Width | `--gut` | `--col` | Layout |
|---|---|---|---|
| **< 768** | 16px | 480px | Bottom nav. Single column. |
| **≥ 768** | 24px | 600px | Nav becomes an 88px icon rail. |
| **≥ 1024** | 24px | 760px | Rail becomes a 232px labelled sidebar. Card lists go two-column. |
| **≥ 1280** | 32px | 880px | Gutters open up. |

Ranked lists, chat and every form page cap at `--col-list` (620px) regardless — the cap
sits on the **column**, not the list, so everything on a page shares one alignment.

One DOM tree, media queries only — no JS breakpoint, no resize listener, no duplicate
markup to drift apart.

**Ranked and chronological lists stay single-column at every width**: the board, the
activity feed, chat, the admin queue. Rank only reads down one column. Only card grids
reflow.

Safe areas on all four sides — the rail needs `env(safe-area-inset-left)` in landscape
on a notched phone. `dvh`, never `vh`.

## 7 · Copy

Sentence case everywhere except `.t-label`, which is uppercase and tracked. Buttons name
the action, not the mechanism — "Create a poll", not "Submit". Empty and error states
give an instruction, never an apology.

## 8 · The floor — every screen, before it ships

1. Every number in `.num`
2. Every colour doing its one job
3. Tap targets ≥48px, ≥44px in dense rows
4. Visible focus ring — checked on the **light page and the dark chrome**, they need
   different rings
5. Real `<button>` / `<a>`, never a clickable div
6. Contrast gate green
7. Loading, empty and error states all exist
8. `prefers-reduced-motion` respected, and disabled is the correct resting state
9. No layout shift — skeletons match the real row's height
10. No horizontal scroll at 360, 768, 1024 or 1440
