# 05 — UI Specification

> **For the builder:** the two HTML prototypes (`maxpoll-prototype.html`, `maxpoll-landing-activity.html`) are the **visual source of truth**. Do not invent layouts, colours, or components. If something is unspecified here, copy it from the prototype. If it's in neither, ask before inventing.

---

## 1. Design tokens (exact — put these in `globals.css`)

```css
:root{
  /* surface */
  --paper:#FAFAF7;        /* page background */
  --card:#FFFFFF;         /* cards, sheets */
  --line:#E6E5E0;         /* every hairline & border */

  /* text */
  --ink:#111114;          /* primary */
  --muted:#8A8A94;        /* secondary, labels */
  --body:#55555F;         /* long-form paragraphs */

  /* semantic — each colour has ONE job, never decorative */
  --gold:#F5B324;         /* RANK 1 ONLY */
  --gold-text:#9A6E05;    /* gold on white — AA contrast */
  --gold-soft:#FFFCF3;
  --violet:#6B4EFF;       /* MOVEMENT ONLY: live, climbing, gaps, growing */
  --violet-soft:#EFEBFF;
  --heat:#E8452C;         /* TIME PRESSURE ONLY: timers, ▼ drops */
  --heat-soft:#FDECE9;
  --up:#0E8A4F; --up-soft:#E6F6EE;   /* ▲ rank gain */

  /* geometry */
  --r-sm:10px; --r-md:14px; --r-lg:20px; --r-xl:24px;
  --tap:48px;             /* minimum touch target */
  --shadow:0 1px 2px rgba(17,17,20,.05), 0 8px 24px -12px rgba(17,17,20,.12);
  --ease:cubic-bezier(.22,1,.36,1);
}
```

**Colour discipline is the whole design.** Gold appears only on rank 1. Violet only where something moves. Red only where time runs out. If you find yourself reaching for a colour for decoration, use `--line` or `--muted` instead.

## 2. Typography

| Role | Family | Weight | Usage |
|---|---|---|---|
| Display | **Archivo** | 800 / 900 | Poll titles, hero, profile name. Tracking `-.03em` to `-.045em` |
| UI | **Space Grotesk** | 400/500/600/700 | Everything else |
| Numbers | **Space Mono** | 700 | **Every number, without exception** |

```css
.num{font-family:'Space Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
```

**Why monospace for numbers is non-negotiable:** counts animate live. Proportional digits change width as they tick, so the row jitters. Tabular figures don't. This is the single most common thing that makes a live leaderboard look cheap.

**Type scale:** hero 41px/.96 · poll title 25px/1.08 · card title 17px/1.15 · body 15px/1.45 · secondary 13px · label 11px uppercase `.07em` · micro 10px

**Emoji:** iOS everywhere.
```css
body{font-family:'Space Grotesk','Apple Color Emoji','Segoe UI Emoji',sans-serif}
```
Bundle Apple Color Emoji (SBIX) as a `@font-face` fallback so Android renders identically. Mixed emoji sets are the fastest tell of a side project.

## 3. Layout shell

- **Mobile-first, single column, max-width 480px centred.** Desktop shows the same column with the bottom nav converted to a left rail above 768px.
- Bottom nav: **Home · Spaces · Create(+) · Profile**. Create is a centred dark square button, raised `-4px`.
- Top bar: sticky, `rgba(250,250,247,.86)` + `backdrop-filter:blur(14px)`, 1px bottom border, min-height 54px.
- Page padding 14–16px. Card gap 12px.
- Activity bell with unread badge sits in the top bar on **every** logged-in screen.

## 4. Component inventory

### 4.1 `<OptionRow>` — the most important component
```
[rank] [────fill────] [name + subline] [▲2] [34%]
```
- Container: `--card`, 1px `--line`, `--r-md`, padding `12px 13px`, `position:relative; overflow:hidden`
- **Fill bar**: absolutely positioned, `inset:0 auto 0 0`, width = vote %, `--violet-soft`, `z-index:0`. All content `z-index:1`
- Rank: Space Mono 700, 16px, width 26px, `--muted`, zero-padded (`01`, `02`)
- Percentage: Space Mono 700, 16px, right-aligned
- **Rank 1 variant:** border `rgba(245,179,36,.45)`, background `linear-gradient(180deg,#FFFCF3,#fff)`, rank digit `--gold`, fill `rgba(245,179,36,.14)`
- **Own pick variant:** border `--ink` + `box-shadow:0 0 0 1px var(--ink)`, plus a `YOUR PICK` pill (dark, 9px, uppercase)
- **Movement badge:** `▲2` in `--up`/`--up-soft`, `▼1` in `--heat`/`--heat-soft`, `NEW` in `--violet`/`--violet-soft`
- **Small variant** (under-list): padding `9px 12px`, name 13.5px, rank 13px
- **Locked variant:** `filter:blur(4.5px); opacity:.55; pointer-events:none`

### 4.2 `<GapLine>` — the growth engine
```
↑ 17 votes behind Verma Ma'am. Share to close the gap.
```
`--violet-soft` bg, `--violet` text, `--r-sm`, padding `7px 12px`, 11.5px/600. The number is Space Mono bold. Sits directly beneath the user's own option. **Always free, never blurred.** Tapping it opens the share sheet with prefilled text naming the gap.

### 4.3 `<Timer>` — the eye-catcher
Inverted dark block — the only dark element on a paper page, so it pulls the eye without colour noise.
- Container: `--ink` bg, white text, `--r-md`, padding `11px 14px`, margin `0 12px 12px`
- Left: 34px SVG progress ring, gold stroke, `stroke-linecap:round`, rotated `-90deg`, % in the centre (Space Mono 9px)
- Middle: label `VOTING CLOSES IN` (9.5px, `.1em`, 55% white) + `04:12:07` (Space Mono 700, 19px, colons in gold)
- Right: ⏳ emoji
- Bottom edge: 3px `--heat` progress bar draining left-to-right
- **Under 1 hour:** background → `linear-gradient(100deg,#2A0F0A,#7A1E10)`, ⏳ pulses 2s, format switches to `MM:SS`

### 4.4 `<CountChips>`
```
🗳️ 340 votes    👥 28 options    ⏳ 4h left
```
`--paper` bg, 1px `--line`, `--r-sm`, padding `4px 9px`, Space Mono 11px/700. The time chip uses `--heat-soft`/`--heat`. On every poll card and poll header.

### 4.5 `<PollCard>` (feed)
Space label (violet, 10px uppercase, live dot if active) → Archivo 800 17px title → CountChips → 3-row mini preview with 70px bars (rank 1 bar is gold) → tap = full card.
**Unvoted polls show `🔒 vote to reveal` instead of names.**

### 4.6 `<Sheet>` (bottom sheet)
`--card`, `border-radius:24px 24px 0 0`, padding `22px 18px`, `box-shadow:0 -12px 40px -14px rgba(17,17,20,.3)`, 36×4px grab handle centred. Slide up 280ms `--ease`, backdrop fade 200ms. Used for: join Space, ₹9 paywall, share, confirm destructive.

### 4.7 `<Button>`
Min-height 48px (`sm` 36px), `--r-md`, Space Grotesk 700 15px, `active:scale(.975)` 160ms.
- `pri` — `--ink` bg, white
- `sec` — `--card` bg, `--ink` text, 1px `--line`
- `vio` — `--violet` bg, white, `box-shadow:0 6px 20px -8px var(--violet)` (payment CTAs only)

### 4.8 `<LiveDot>`
6px violet circle with an expanding `::after` ring, 1.9s infinite. Only where something is genuinely live.

### 4.9 `<Counter>`
```tsx
// count-up from previous rendered value → new value, 600ms ease-out, rAF
// ALWAYS wrapped in .num. Respects prefers-reduced-motion (jump, don't animate).
```
Applies to: card totals, per-option counts after voting, member counts, landing stats, follower counts.

### 4.10 `<Typeahead>` (add option)
Input focused state: border `--violet` + `box-shadow:0 0 0 3px var(--violet-soft)`.
Suggestion rows show **label · rank pill · vote count** — the rank and count are what actually stop the duplicate.
Similarity > 0.8 → `--heat-soft` warning strip. Primary CTA is `Vote for <existing>`; `Add as new anyway` is secondary at `opacity:.72`.

### 4.11 `<ActivityRow>`
34px rounded icon tile + text + timestamp. The `same_as_you` variant gets `--violet` border, gradient bg, **2 real names visible + rest blurred**, and an inline `Unlock names · ₹9` violet button.

### 4.12 `<Disclosure>`
```
🔓 Votes on MaxPoll are public. Your name will be visible on this poll.
```
`--paper` bg, 1px `--line`, `--r-sm`, 11px `--muted`. Appears in the join sheet, on the landing footer, and on the poll page. Do not make it smaller than 11px.

## 5. Page-by-page

| Route | Contents |
|---|---|
| `/` logged out | Landing: nav (Log in / Sign up) → hero with **live demo board + gap line** → 3 stat columns → 4-step "How it works" → Google CTA → footer with disclosure. The hero *is* the product — a working leaderboard, not a headline. |
| `/` logged in | Top bar (wordmark + activity bell) → `🔥 Top performing today` → PollCards → `📈 Moving fast` → PollCards → bottom nav |
| `/p/[slug]` | Back bar → space label → Archivo 900 title → CountChips → **Timer** → board (top 5) → GapLine → under-list (blurred if unpaid) → `+ Add someone missing` → `💬 Poll chat · N talking` → sticky `Share to WhatsApp` |
| `/p/[slug]/chat` | Bubbles: own = dark right-aligned, others = card left-aligned, anon = violet handle `anon · owl4713`. Composer + `◐ Anon` toggle pill |
| `/spaces` | `You're in` → `Growing` (with `12/20` + progress bar) → `Discover`. 46px rounded-square avatar with 2-letter monogram |
| `/s/[slug]` | Space header (members, live polls, Join/Leave) → its polls |
| `/create` | Space picker → 👤 person / 🎬 thing → adjective dropdown (person) or free title → options → timer → create |
| `/@[handle]` | Name (Archivo 900 24px) → @handle (violet) → bio → social chips → badges → **Followers / Following / Polls** → Follow + Share → tabs Created/Voted/Badges. **No profile photo.** |
| `/activity` | ActivityRows, `same_as_you` first |
| `/settings` | Account · Spaces · Subscription · Privacy · Notifications · About · Sign out · Delete account |
| `/onboarding` | handle · display name · DOB (18+ gate) · bio · socials |

## 6. Motion

| Element | Spec |
|---|---|
| **Rank rows** | FLIP transform, 340ms `--ease` — **the signature, spend boldness here** |
| ▲▼ badge | fade + 4px rise, 240ms |
| Counters | count-up 600ms ease-out |
| Fill bars | width 500ms `--ease` |
| Sheets | slide 280ms |
| Payment unblur | blur 4.5px→0 over 400ms + count-up |
| Live dot | 1.9s pulse |
| Timer <1h | 2s opacity pulse |

**Only `transform` and `opacity` animate.** No layout-triggering properties. Everything inside `@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`.

## 7. Copy rules
- Sentence case. Active voice. A button says exactly what happens.
- The action keeps its name through the flow: `Pay ₹9` → toast `Paid`.
- Paywall headline is literally **"See the exact names of voters"** — plain, not clever.
- Errors state what happened and what to do: `Payment didn't go through. You weren't charged.` Never apologise, never be vague.
- Empty states are invitations: `No polls yet. Be the first — it takes 30 seconds.` Never `Nothing here`.

## 8. Quality floor (verify before shipping any screen)
- [ ] Every number wrapped in `.num`
- [ ] Gold used only on rank 1; violet only on movement; red only on time
- [ ] All tap targets ≥48px, primary actions in the bottom third
- [ ] Visible keyboard focus rings
- [ ] Gold text on white uses `--gold-text` (`#9A6E05`) for AA contrast
- [ ] `aria-live="polite"` on the board so rank changes are announced
- [ ] `prefers-reduced-motion` respected
- [ ] No layout shift when counts change (tabular figures)
- [ ] Works identically at 360px and 1440px
