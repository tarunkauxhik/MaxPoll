# Design

**This file and `app/globals.css` are the visual source of truth.** `globals.css` is
the executable version; this file explains what the values mean and why. Where they
disagree, the CSS is what ships — fix the CSS, then fix this.

Originally derived from two HTML prototypes (`maxpoll-prototype.html`,
`maxpoll-landing-activity.html`), now absorbed here and deleted. Every numeric value
below was lifted from them. See [DECISIONS.md](DECISIONS.md) D8.

---

## 1. Colour

**Colour discipline is the whole design.** Every colour has exactly one job. If you
reach for a colour to decorate, use `--line` or `--muted` instead.

```css
/* surface */
--paper:#FAFAF7;        /* page background — warm white, NOT cream */
--card:#FFFFFF;         /* cards, sheets */
--line:#E6E5E0;         /* decorative hairlines & separators */
--line-strong:#8F8E87;  /* form control borders — WCAG 1.4.11 needs >=3:1 */

/* text */
--ink:#111114;          /* primary */
--body:#55555F;         /* long-form paragraphs */
--muted:#6B6B75;        /* secondary, labels */

/* semantic — one job each, never decorative.
   Each has a -text sibling: the brand colour is a SURFACE colour, and used
   as text it fails contrast. Never substitute one for the other. */
--gold:#F5B324;         /* RANK 1 ONLY — fills, rank digit, timer ring */
--gold-text:#8F6605;    /* gold as text */
--gold-soft:#FFFCF3;
--violet:#6B4EFF;       /* MOVEMENT ONLY — fills, live dot, button bg */
--violet-text:#5B3EE8;  /* violet as text */
--violet-soft:#EFEBFF;
--heat:#E8452C;         /* TIME PRESSURE ONLY — bars, fills */
--heat-text:#C2321C;    /* heat as text */
--heat-soft:#FDECE9;
--up:#0E8A4F;           /* ▲ rank gain — fills */
--up-text:#0A7442;      /* up as text */
--up-soft:#E6F6EE;

--press:rgba(17,17,20,.045);  /* pressed background */
```

### Contrast — measured, and enforced

```bash
pnpm check:contrast     # parses globals.css, checks all 17 pairs, exits 1 on failure
```

| Pair | Ratio | Where |
|---|---|---|
| `--ink` on `--paper` | 18.03:1 | body text |
| `--body` on `--paper` | 7.04:1 | paragraphs |
| `--muted` on `--paper` | 5.04:1 | sublines, labels, nav |
| `--gold-text` on `--gold-soft` | 5.03:1 | gold badge |
| `--violet` on `--card` | 5.05:1 | space label, wordmark |
| `--violet-text` on `--violet-soft` | 5.46:1 | gap line, `NEW` badge |
| `--up-text` on `--up-soft` | 5.23:1 | ▲ badge |
| `--heat-text` on `--heat-soft` | 4.87:1 | ▼ badge, time chip |
| `--line-strong` on `--paper` | 3.14:1 | input borders |

**Five tokens shipped failing AA and had to be corrected.** They came from the
design drafts and had been carried forward unquestioned:

| Token | Was | Ratio |
|---|---|---|
| `--muted` | `#8A8A94` | 3.27:1 ✗ |
| violet as text | `#6B4EFF` | 4.33:1 ✗ |
| `--up` as text | `#0E8A4F` | 3.94:1 ✗ |
| `--heat` as text | `#E8452C` | 3.45:1 ✗ |
| `--gold-text` on `--gold-soft` | `#9A6E05` | 4.44:1 ✗ |

Hand-arithmetic caught only two of the five. **Run the checker; don't reason about
it, and never judge by eye.**

The *brand* colours are unchanged — `#6B4EFF`, `#F5B324`, `#E8452C`, `#0E8A4F` are
still the fills, dots and bars, because those are surfaces. Only their use *as text*
moved. No colour's job changed.

`--line` stays at 1.21:1 deliberately. It's a decorative separator, not a component
boundary — cards are identified by their surface and shadow. Only form controls,
where the border *is* what identifies the control, use `--line-strong`. Pushing every
hairline to 3:1 would turn a deliberately light design heavy.

**No dark mode in v1.** A scoreboard reads better on paper, and light is cheaper to
render on budget Android. Revisit post-launch.

## 2. Typography

| Role | Family | Weight | Where |
|---|---|---|---|
| Display | **Archivo** | 800 / 900 | Poll titles, hero, profile name. Tracking `-.03em` → `-.045em` |
| UI | **Space Grotesk** | 400/500/600/700 | Everything else |
| Numbers | **Space Mono** | 700 | **Every number, without exception** |

```css
.num{font-family:var(--font-num);font-variant-numeric:tabular-nums}
```

**Why monospace numbers is non-negotiable:** counts animate live. Proportional digits
change width as they tick, so rows jitter mid-animation. Tabular figures don't. This
is the single most common thing that makes a live leaderboard look cheap.

**Scale:** hero 41/.96 · poll title 25/1.08 · card title 17/1.15 · body 15/1.45 ·
secondary 13 · label 11 uppercase `.07em` · micro 10 (non-text only — 10px body text
fails the readable-size floor; nav labels are 11px).

Archivo and Space Grotesk are variable fonts (one file each covers every weight).
Space Mono has no variable cut, so 400/700 ship as two static files.

**Emoji:** system stack — `'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji'`.
Apple Color Emoji cannot be bundled ([DECISIONS](DECISIONS.md) A5).

## 3. Geometry & elevation

```css
--r-sm:10px; --r-md:14px; --r-lg:20px; --r-xl:24px;
--tap:48px;                /* minimum touch target */
--ease:cubic-bezier(.22,1,.36,1);

/* spacing scale — layout rhythm and all new components */
--s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-6:24px;

/* elevation — a scale, not one-offs */
--shadow-1:0 1px 2px rgba(17,17,20,.05), 0 8px 24px -12px rgba(17,17,20,.12);
--shadow-2:0 -12px 40px -14px rgba(17,17,20,.3);
```

Component-internal padding stays as the prototypes drew it (13px, 11px, 9px…) —
those are deliberate optical choices. The spacing scale governs *layout* gaps and
anything built from here on.

**z-index is a declared scale**, never an ad-hoc number:
`--z-nav:20 · --z-top:30 · --z-backdrop:40 · --z-sheet:50`.

## 4. Layout shell

- **Mobile-first, single column, max-width 480px, centred.**
- Bottom nav: **Home · Spaces · Create(+) · Profile**. Create is a centred dark
  square, raised `-4px`. **Becomes a left rail at ≥768px** — same markup, media
  query only.
- Top bar: sticky, `rgba(250,250,247,.86)` + `backdrop-filter:blur(14px)`, 1px
  bottom border, min-height 54px. Gains a shadow once scrolled.
- Page padding 14–16px. Card gap 12px.
- `min-height:100dvh`, not `100vh`. Safe-area insets on nav and sheets.
- Content reserves `--nav-h` bottom padding so the last row never hides behind
  the nav.
- Activity bell with unread badge sits in the top bar on **every** signed-in screen.

## 5. Components

### 5.1 `<OptionRow>` — the most important component
```
[rank] [────fill────] [name + subline] [▲2] [34%]
```
- Element is a **`<button>`**, not a div. It's the product's primary action and must
  be keyboard-reachable.
- Container: `--card`, 1px `--line`, `--r-md`, padding `12px 13px`,
  `position:relative; overflow:hidden`, `min-height:var(--tap)`
- **Fill bar:** absolute, `inset:0 auto 0 0`, width = vote %, `--violet-soft`,
  `z-index:0`. All content `z-index:1`. Width transition 500ms `--ease`
- Rank: Space Mono 700, 16px, width 26px, `--muted`, zero-padded (`01`, `02`)
- Name: 600, 15px, ellipsis on overflow, `min-width:0` on its flex parent
- Subline: 11px `--muted`, `<count> votes` + movement badge
- Percentage: Space Mono 700, 16px, right-aligned

**Five variants:**

| Variant | Spec |
|---|---|
| **Rank 1** | border `rgba(245,179,36,.45)`, bg `linear-gradient(180deg,#FFFCF3,#fff)`, rank digit `--gold`, fill `rgba(245,179,36,.14)` |
| **Own pick** | border `--ink` + `box-shadow:0 0 0 1px var(--ink)`, plus a `YOUR PICK` pill (dark, 9px, uppercase, `border-radius:99px`) |
| **Small** (under-list) | padding `9px 12px`, name 13.5px, rank 13px/22px wide, pct 13px |
| **Locked** | `filter:blur(4.5px); opacity:.55; pointer-events:none`. **Contains placeholder strings only** — real names never reach the client without a server-side entitlement check |
| **Movement badge** | `▲2` in `--up`/`--up-soft` · `▼1` in `--heat`/`--heat-soft` · `NEW` in `--violet`/`--violet-soft`. Space Mono 10px/700, `padding:2px 5px`, `--r 5px` |

**Density rule (360px):** name truncates with ellipsis; rank, badge and percentage
never shrink or wrap. Verified at 360px with a long name + badge + percentage.

**Pressed state:** background darkens *and* `transform:scale(.985)`. Transform alone
is unreliable on Android.

### 5.2 `<GapLine>` — the growth engine
```
↑ 17 votes behind Verma Ma'am. Share to close the gap.
```
`--violet-soft` bg, `--violet-text` text, `--r-sm`, padding `7px 12px`, 11.5px/600,
`margin:1px 12px`. The number is Space Mono bold. Sits directly beneath the user's
own option.

**Always free, never blurred.** Tapping it opens the share sheet with text
prefilled naming the gap. This line is simultaneously the FOMO and the call to
action — it tells the user why to share *and* what sharing achieves.

### 5.3 `<Timer>` — the eye-catcher
Inverted dark block — the only dark element on a paper page, so it pulls the eye
without colour noise.

- Container: `--ink` bg, white text, `--r-md`, padding `11px 14px`, margin `0 12px 12px`,
  `position:relative; overflow:hidden`
- **Left:** 34px SVG ring. `<circle cx=17 cy=17 r=14 fill=none stroke="rgba(255,255,255,.18)" stroke-width=3>`
  plus a gold progress circle, `stroke-width:3`, `stroke-linecap:round`,
  `stroke-dasharray:88`, `stroke-dashoffset` = remaining. SVG rotated `-90deg`.
  Percentage centred inside, Space Mono 9px/700
- **Middle:** label `VOTING CLOSES IN` (9.5px, `.1em`, `rgba(255,255,255,.55)`, 700)
  over `04:12:07` (Space Mono 700, 19px, `-.03em`) — **colons in `--gold`**
- **Right:** ⏳ emoji, 19px
- **Bottom edge:** 3px `--heat` bar draining left→right
- **Under 1 hour:** bg → `linear-gradient(100deg,#2A0F0A,#7A1E10)`, ⏳ pulses 2s,
  format switches to `MM:SS`

### 5.4 `<CountChips>`
```
🗳️ 340 votes    👥 28 options    ⏳ 4h left
```
`--paper` bg, 1px `--line`, `--r-sm`, padding `4px 9px`, Space Mono 11px/700, gap 7px.
Time chip uses `--heat-soft` bg / `rgba(232,69,44,.25)` border / `--heat` text.
On every poll card and poll header.

### 5.5 `<PollCard>` (feed)
`--card`, 1px `--line`, `--r-md`, padding 14px, `--shadow-1`, `:active` scale `.985`.

Composition: space label (violet, 10px uppercase `.07em`, live dot if active) →
Archivo 800 17px title → CountChips → 3-row mini preview → tap opens the poll.

Mini rows: rank (15px wide, 11px/700 `--muted`) · name (ellipsis) · 70px bar
(`height:5px`, `border-radius:99px`, track `--line`, fill `--ink`; **rank-1 fill is
`--gold`**).

**Unvoted polls show `🔒 vote to reveal` instead of names**, with a zero-width bar.

### 5.6 `<Sheet>` (bottom sheet)
`--card`, `border-radius:24px 24px 0 0`, padding `22px 18px`, `--shadow-2`, 1px top
border, `max-width:480px` centred. 36×4px `--line` grab handle centred above the
content. Slide up 280ms `--ease`; backdrop `rgba(17,17,20,.45)` fades 200ms.

Used for: join Space · ₹9 paywall · share · destructive confirm.

Accessibility: focus trap, Esc to dismiss, scroll lock, focus returns to the trigger.
Built on `@radix-ui/react-dialog` — hand-rolling a correct focus trap is not the
lazy option.

### 5.7 `<Button>`
Min-height 48px (`sm` 36px), `--r-md` (`sm` `--r-sm`), Space Grotesk 700 15px
(`sm` 13px), `:active` `scale(.975)` 160ms.

| Variant | Spec |
|---|---|
| `pri` | `--ink` bg, white text |
| `sec` | `--card` bg, `--ink` text, 1px `--line` |
| `vio` | `--violet` bg, white, `box-shadow:0 6px 20px -8px var(--violet)` — **payment CTAs only** |

Focus ring is violet on light surfaces, white on dark (`.pri`, the timer block) —
a violet ring on `--ink` is nearly invisible.

### 5.8 `<LiveDot>`
6px violet circle, `::after` ring expanding `scale(.6)→scale(1.5)`, opacity
`.4→0`, 1.9s infinite. **Only where something is genuinely live.**

### 5.9 `<Counter>`
Count-up from the previously rendered value to the new one, **600ms ease-out**,
`requestAnimationFrame`. Always wrapped in `.num`. Respects `prefers-reduced-motion`
by jumping instead of animating.

Applies to: card totals · per-option counts after voting · member counts · landing
stats · follower counts.

### 5.10 `<Typeahead>` (add option)
Input: `--card`, 1px `--line`, `--r-md`, min-height 48px, **font-size 16px** (below
16px, iOS zooms the page on focus). Focused: border `--violet`, `box-shadow:0 0 0 3px var(--violet-soft)`.

Suggestion rows show **label · rank pill · vote count** — the rank and count are what
actually stop the duplicate, because "#2, 82 votes" makes voting for the existing one
the obvious move. Rank pill: Space Mono 11px/700, `--paper` bg, `padding:2px 6px`.

Similarity > 0.8 → `--heat-soft` warning strip: *"Looks like Narendra Modi is already
here. Vote for the existing one so the count isn't split."* Primary CTA
`Vote for <existing>`; `Add as new anyway` secondary at `opacity:.72`.

### 5.11 `<ActivityRow>`
34px rounded (`--r-md`) icon tile + text + timestamp. Text 13.5px/1.4, timestamp
10.5px/600 `--muted`.

The `same_as_you` variant gets `rgba(107,78,255,.35)` border, `linear-gradient(180deg,#F8F6FF,#fff)`
bg, `--violet-soft` icon tile, **2 real names visible + the rest blurred**, and an
inline `Unlock names · ₹9` violet button.

Name chips: 11.5px/600, `--paper` bg, 1px `--line`, `padding:4px 9px`,
`border-radius:8px`. Locked chips get `filter:blur(4px)`, `user-select:none`, and
hold placeholder text. The unlock row sits `margin-top:10px`, gap 8px.

### 5.12 `<Disclosure>`
```
🔓 Votes on MaxPoll are public. Your name will be visible on this poll.
```
`--paper` bg, 1px `--line`, `--r-sm`, padding `9px 11px`, 11px `--muted`, gap 7px.

Appears in the join sheet, on the landing footer, and on the poll page.
**Do not make it smaller than 11px.** This line is what separates selling depth from
selling a betrayal.

### 5.13 `<SpaceCard>`
Row: `--card`, 1px `--line`, `--r-md`, padding `13px 14px`, gap 12px, `--shadow-1`.

Avatar: 44×44 (46px in the join sheet), `border-radius:12px`, `flex:0 0 44px`,
`display:grid;place-items:center`, **Archivo 800 15px, `-.03em`, white on a solid
fill**. Two-letter monogram — `DT`, `IN`, `HW`.

Name 15px/700 `-.01em`; subline 11.5px `--muted` (`1,240 members · 18 live polls`,
numbers in `.num`).

`GROWING` badge: 10px/700, `--violet-text` on `--violet-soft`, `padding:2px 7px`,
`border-radius:99px`.

Progress bar: `height:4px`, `border-radius:99px`, track `--line`, fill `--violet`,
`margin-top:7px`, `overflow:hidden`.

### 5.14 Profile pieces
- **Badge chip:** inline-flex, gap 5px, 11px/700, `padding:5px 10px`,
  `border-radius:99px`, 1px `--line`, `--card` bg.
  **Gold variant:** border `rgba(245,179,36,.5)`, bg `--gold-soft`, text `--gold-text`
- **Social chip:** inline-flex, gap 6px, 12px/600, `padding:6px 11px`,
  `border-radius:99px`, 1px `--line`, `--card` bg. Unverified, decorative
- **Stat / follows row:** equal flex cells, `padding:13–14px 6px`, centred, split by
  1px `--line` (last cell no border). Value Space Mono 700 19–20px `-.03em`; key
  9.5–10px uppercase `.06–.07em` `--muted`
- **Tabs:** `padding:0 14px`, gap 18px, 1px `--line` bottom. Each tab
  `padding:11–12px 0`, 13px/600 `--muted`, `border-bottom:2px solid transparent`,
  `margin-bottom:-1px`. Active: `--ink` text, `--ink` border

### 5.15 Chat
- **Bubble:** `max-width:78%`, `padding:9px 12px`, `border-radius:14px`, 13.5px/1.38
- **Author line:** 10.5px/700, `margin-bottom:3px`, `--muted`
- **Theirs:** `--card` bg, 1px `--line`, `align-self:flex-start`,
  `border-bottom-left-radius:5px`
- **Yours:** `--ink` bg, white text, `align-self:flex-end`,
  `border-bottom-right-radius:5px`; author line `rgba(255,255,255,.55)`
- **Anonymous:** author line in `--violet-text`, rendered `anon · owl4713`
- **Composer:** 1px `--line` top, `padding:10px 12px`, gap 8px, `--paper` bg
- **Anon toggle:** 11px/700 `--violet-text` on `--violet-soft`, `padding:8px 10px`,
  `--r-sm`, `white-space:nowrap`, label `◐ Anon`

### 5.16 OG image (WhatsApp preview)
1200×630, rendered by `next/og`. **This is the only place a gradient is permitted.**

- Background: `linear-gradient(135deg, #111114, #2A2145 60%, #6B4EFF)`
- Space label: 9px/700 uppercase `.12em`, `rgba(255,255,255,.6)`
- Title: **Archivo 800**, white, `line-height:1.1`, `-.025em`
- Leader line: `🥇 <leader> leading · <n> votes · <t> left` — 11px,
  `rgba(255,255,255,.85)`, with **the leader name and count in Space Mono `--gold`**

`og:title` and `og:description` carry the current leader and vote count; the
description ends with a call to act. Cache `s-maxage=60` and **version the URL when
the leader changes** — WhatsApp caches previews hard.

### 5.17 States — loading, empty, error
The prototypes are static frames and have none of these. All three are required
before any screen ships.

- **Skeleton:** `--line` block at `--r-md`, shimmer 1.4s. Shown when an operation
  exceeds 300ms. Reserve the real element's height so there's no layout shift.
- **Empty:** an instruction, never an apology. Copy in [03-ux-flows.md](03-ux-flows.md).
- **Error:** what happened + what to do, with a recovery action.
  *"Payment didn't go through. You weren't charged."* + retry. Never vague, never
  an apology.

## 6. Page composition

| Route | Contents |
|---|---|
| `/` logged out | Landing: nav (Log in / Sign up) → hero with **live demo board + gap line** → 3 stat columns → 4-step "How it works" → Google CTA → footer with disclosure. **The hero *is* the product** — a working leaderboard, not a headline |
| `/` logged in | Top bar (wordmark + activity bell) → `🔥 Top performing today` → PollCards → `📈 Moving fast` → PollCards → bottom nav |
| `/p/[slug]` | Back bar → space label → Archivo 900 title → CountChips → **Timer** → board (top 5) → GapLine → under-list (blurred if unpaid) → `+ Add someone missing` → `💬 Poll chat · N talking` → sticky `Share to WhatsApp` |
| `/p/[slug]/chat` | Bubbles: own = dark right-aligned (`border-bottom-right-radius:5px`), others = card left-aligned (`…left-radius:5px`), anon = violet handle `anon · owl4713`. Composer + `◐ Anon` toggle pill |
| `/spaces` | `You're in` → `Growing` (with `12/20` + progress bar) → `Discover`. 44–46px rounded-square avatar, 2-letter Archivo 800 monogram on a solid fill |
| `/s/[slug]` | Space header (members, live polls, Join/Leave) → its polls |
| `/create` | Space picker → 👤 person / 🎬 thing → adjective dropdown (person) or free title → options → timer → create |
| `/@[handle]` | Name (Archivo 900 24px) → @handle (violet) → bio → social chips → badges → **Followers / Following / Polls** → Follow + Share → tabs Created/Voted/Badges. **No profile photo** |
| `/activity` | ActivityRows, `same_as_you` first |
| `/settings` | Account · Spaces · Subscription · Privacy · Notifications · About · Sign out · Delete account |
| `/onboarding` | handle · display name · DOB (18+ gate) · bio · socials |

### Landing hero detail
Eyebrow pill: `--violet-soft` bg, `--violet-text`, 11px/700 `.06em` uppercase,
`border-radius:99px`, `padding:5px 11px`, with a live dot. Carries a **real**
aggregate number — see [01-product.md](01-product.md) on seeded numbers.

Hero h1: Archivo 900, 41px/.96, `-.045em`, with one word in `--violet`.
Demo board below it: `--card`, 1px `--line`, `border-radius:18px`, padding 13px,
`--shadow-1`, holding three compact rows + a gap line.

Stat columns: three equal cells split by 1px `--line`, value in Space Mono 700 19px
`-.03em`, key in 9.5px uppercase `.07em` `--muted`.

### WhatsApp / OG preview
1200×630 PNG via `next/og`. `og:title` and `og:description` carry the **current
leader and vote count**; the description ends with a call to act ("Add your own
name."). Version the image URL when the leader changes — WhatsApp caches previews
hard and a stale preview makes a live poll look dead.

## 7. Motion

**One signature motion: rank rows sliding on recompute.** Everything else is still.
Scattered animation reads amateur; one orchestrated moment reads considered.

| Element | Spec |
|---|---|
| **Rank rows** | FLIP transform, **340ms `--ease`** — the signature, spend boldness here |
| ▲▼ badge | fade + 4px rise, 240ms, on rank change |
| Counters | count-up 600ms ease-out |
| Fill bars | width 500ms `--ease` |
| Sheets | slide up 280ms; backdrop fade 200ms |
| Payment unblur | blur 4.5px→0 over 400ms + count-up |
| Live dot | 1.9s pulse |
| Timer <1h | 2s opacity pulse |
| Skeleton | 1.4s shimmer |
| Button press | `scale(.975)` 160ms |

**Only `transform` and `opacity` animate.** No layout-triggering properties.
Everything sits inside `@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`.

## 8. Copy rules

- Sentence case. Active voice. A button says exactly what happens.
- The action keeps its name through the flow: `Pay ₹9` → toast `Paid`.
- Paywall headline is literally **"See the exact names of voters."** Plain, not clever.
- Errors state what happened and what to do. Never apologise, never be vague.
- Empty states are invitations, never `Nothing here`.

## 9. Quality floor — verify before shipping any screen

- [ ] Every number wrapped in `.num`
- [ ] Gold only on rank 1 · violet only on movement · red only on time
- [ ] All tap targets ≥48px, primary actions in the bottom third
- [ ] Visible `:focus-visible` ring, and it's visible on dark surfaces too
- [ ] Interactive elements are real `<button>` / `<a>`, not clickable divs
- [ ] Text contrast ≥4.5:1 — checked in DevTools, not by eye
- [ ] `aria-live="polite"` on the board so rank changes are announced
- [ ] Loading, empty and error states all exist
- [ ] `prefers-reduced-motion` respected
- [ ] No layout shift when counts change (tabular figures)
- [ ] Works identically at 360px and 1440px, no horizontal scroll
