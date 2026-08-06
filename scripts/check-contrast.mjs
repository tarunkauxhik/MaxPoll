/**
 * Reads the shipped app/globals.css, parses the :root tokens, and checks every
 * text/background pair the design actually uses against WCAG 2.1 AA.
 *
 * Run: pnpm check:contrast
 *
 * Exists because two tokens shipped failing this and nobody noticed — they came
 * from the design drafts and were carried forward unquestioned. Contrast is
 * measured, never eyeballed. See docs/DECISIONS.md C1.
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
const PAIRS = [
  ['body text on page', '--ink', '--paper', 4.5],
  ['paragraphs on page', '--body', '--paper', 4.5],
  ['.opt .sub / .t-sec / nav label', '--muted', '--paper', 4.5],
  ['.opt .sub on a card', '--muted', '--card', 4.5],
  ['.opt .rk on a card', '--muted', '--card', 4.5],
  ['.badge.g gold text', '--gold-text', '--gold-soft', 4.5],
  ['gold text on a card', '--gold-text', '--card', 4.5],
  ['.wordmark i', '--teal-text', '--paper', 4.5],
  ['.pcard .space label', '--teal-text', '--card', 4.5],
  ['.gap line text', '--teal-text', '--teal-soft', 4.5],
  ['.mv.new badge', '--teal-text', '--teal-soft', 4.5],
  ['.mv.up badge', '--up-text', '--up-soft', 4.5],
  ['.mv.dn badge', '--heat-text', '--heat-soft', 4.5],
  ['.chip.hot text', '--heat-text', '--heat-soft', 4.5],
  ['.state.err text', '--heat-text', '--paper', 4.5],
  ['.field border', '--line-strong', '--card', 3],
  ['.field border on page', '--line-strong', '--paper', 3],
  ['timer text on dark', '--on-dark', '--dark', 4.5],
  ['timer label on dark', '--on-dark-dim', '--dark', 4.5],
  ['text on the raised dark stop', '--on-dark', '--dark-2', 4.5],
  ['label on the raised dark stop', '--on-dark-dim', '--dark-2', 4.5],
  ['nav label on dark nav', '--on-dark-dim', '--dark', 4.5],
  ['nav active label on dark nav', '--on-dark', '--dark', 4.5],
  ['top bar wordmark on dark top bar', '--teal-text', '--dark', 4.5],
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
  `\n${failures === 0 ? 'ALL PASS' : `${failures} FAILING`} · ${PAIRS.length} pairs checked`
);
process.exit(failures === 0 ? 0 : 1);
