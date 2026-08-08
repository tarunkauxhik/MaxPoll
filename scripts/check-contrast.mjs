/**
 * Two checks over the shipped app/globals.css, both of which exist because a
 * design rule that isn't executable stops being true.
 *
 *   1. Contrast — every text/background pair the design actually uses, against
 *      WCAG 2.1 AA. Hand-arithmetic during the original audit caught two of five
 *      failing tokens; the other three surfaced only when the numbers were run.
 *      Measure, don't reason — DECISIONS C1.
 *
 *   2. Lora's weight cap — Lora is variable 400-700 and must never render at 600
 *      or above (DECISIONS D15). Nothing in the bundler can see a CSS weight, so
 *      the rule is checked here or it is not checked at all.
 *
 * Run: pnpm check:contrast   ·   also runs inside pnpm check
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'app', 'globals.css'), 'utf8');

const root = css.slice(css.indexOf(':root'), css.indexOf('\n}'));
const T = Object.fromEntries(
  [...root.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]])
);

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    })
    .reduce((acc, c, i) => acc + [0.2126, 0.7152, 0.0722][i] * c, 0);
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

// [where it appears, foreground token, background token, minimum ratio]
// 4.5 = WCAG AA for text. 3 = WCAG 1.4.11 for UI component boundaries.
//
// The design has three surfaces — the page, a card, and the dark chrome — so
// most accents appear three times over. A brand colour is a *surface* colour;
// its `-text` sibling is for type on light, its `-on-dark` for type on chrome.
const PAIRS = [
  // ── text on the two light surfaces ────────────────────────────────────────
  ['body text on the page', '--ink', '--paper', 4.5],
  ['body text on a card', '--ink', '--card', 4.5],
  ['paragraphs on the page', '--body', '--paper', 4.5],
  ['paragraphs on a card', '--body', '--card', 4.5],
  ['.t-sec / .opt .sub / nav label', '--muted', '--paper', 4.5],
  ['.opt .sub / .opt .rk on a card', '--muted', '--card', 4.5],

  // ── form control boundaries — C1b: these are what identify an input ───────
  ['.field border on a card', '--line-strong', '--card', 3],
  ['.field border on the page', '--line-strong', '--paper', 3],

  // ── indigo · movement, focus, wordmark ───────────────────────────────────
  ['.wordmark i / .spacelink', '--brand-text', '--paper', 4.5],
  ['.pcard .space label', '--brand-text', '--card', 4.5],
  ['.gap line / .mv.new badge', '--brand-text', '--brand-soft', 4.5],
  ['.wordmark i on the top bar', '--brand-on-dark', '--dark', 4.5],
  ['focus ring on a card', '--brand', '--card', 3],
  ['focus ring on the page', '--brand', '--paper', 3],
  ['label on a primary button', '--on-dark', '--brand', 4.5],

  // ── gold · rank 1 only ───────────────────────────────────────────────────
  ['gold text on a card', '--gold-text', '--card', 4.5],
  ['gold text on the page', '--gold-text', '--paper', 4.5],
  ['.badge.g gold text', '--gold-text', '--gold-soft', 4.5],
  ['rank-1 digit on the timer', '--gold-on-dark', '--dark', 4.5],
  ['.opt.g1 border on a card', '--gold', '--card', 3],

  // ── red · time pressure only ─────────────────────────────────────────────
  ['.state.err text', '--heat-text', '--paper', 4.5],
  ['.fielderr on a card', '--heat-text', '--card', 4.5],
  ['.mv.dn / .chip.hot text', '--heat-text', '--heat-soft', 4.5],
  ['urgent label on the timer', '--heat-on-dark', '--dark', 4.5],
  ['timer track fill against a card', '--heat', '--card', 3],

  // ── green · rank gain only ───────────────────────────────────────────────
  ['.chip.voted text', '--up-text', '--card', 4.5],
  ['.mv.up badge', '--up-text', '--up-soft', 4.5],
  ['gain fill against a card', '--up', '--card', 3],

  // ── the dark chrome ──────────────────────────────────────────────────────
  ['nav active label / timer text', '--on-dark', '--dark', 4.5],
  ['nav label / timer unit', '--on-dark-dim', '--dark', 4.5],
  ['text on the raised dark stop', '--on-dark', '--dark-2', 4.5],
  ['label on the raised dark stop', '--on-dark-dim', '--dark-2', 4.5],
  ['the chrome against the page', '--dark', '--paper', 3],
];

let failures = 0;

for (const [where, fg, bg, min] of PAIRS) {
  if (!T[fg] || !T[bg]) {
    console.error(`MISSING TOKEN  ${fg} or ${bg}  — ${where}`);
    failures++;
    continue;
  }
  const r = ratio(T[fg], T[bg]);
  const ok = r >= min;
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${r.toFixed(2).padStart(6)}:1 (min ${min})  ` +
      `${fg} on ${bg}  — ${where}`
  );
}

console.log(
  `\n${failures === 0 ? 'ALL PASS' : `${failures} FAILING`} · ${PAIRS.length} contrast pairs`
);

/**
 * Lora must never render at 600 or above — DECISIONS D15.
 *
 * Split the stylesheet on `}` to get one chunk per declaration block, then flag
 * any block that both selects `--font-serif` and sets a weight of 600+. This
 * misses a weight inherited from a parent rule, which is the honest limit of a
 * check that doesn't build a cascade; it catches the mistake anyone actually
 * makes, which is typing `font-weight: 700` next to the font-family.
 */
const serifBlocks = css
  .split('}')
  .filter((block) => block.includes('var(--font-serif)'));

const heavy = serifBlocks.filter((block) => {
  const w = block.match(/font-weight:\s*(\d{3})/);
  return w && Number(w[1]) >= 600;
});

if (serifBlocks.length === 0) {
  console.log('\nLora — not used in globals.css. Nothing to cap.');
} else if (heavy.length === 0) {
  console.log(
    `\nPASS  Lora capped below 600 · ${serifBlocks.length} rule${
      serifBlocks.length === 1 ? '' : 's'
    } use --font-serif`
  );
} else {
  failures += heavy.length;
  for (const block of heavy) {
    // Strip comments before reading the selector — a rule's doc comment sits in
    // the same chunk and would otherwise be reported as part of its name.
    const selector = block
      .split('{')[0]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim()
      .replace(/\s+/g, ' ');
    const weight = block.match(/font-weight:\s*(\d{3})/)[1];
    console.error(
      `\nFAIL  Lora at ${weight} — "${selector}". ` +
        `Lora is capped at 500 (DECISIONS D15). Use --font-display, or drop the weight.`
    );
  }
}

process.exit(failures === 0 ? 0 : 1);
