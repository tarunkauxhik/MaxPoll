/** Formatting helpers. Pure and tested — the timer and percentages are visible on
 *  every screen, and an off-by-one there is the kind of thing users screenshot. */

/** Indian digit grouping: 1,00,000 not 100,000. Always rendered inside `.num`. */
export const n = (v: number) => v.toLocaleString("en-IN");

/**
 * Whole-percent share. Floors rather than rounds, so the displayed percentages
 * can never sum above 100 — a board reading 34% + 34% + 34% = 102% looks broken
 * even though each row rounded correctly.
 */
export const pctOf = (votes: number, total: number) =>
  total > 0 ? Math.floor((votes / total) * 100) : 0;

export type Countdown = {
  /** `04:12:07`, or `12:07` under an hour. */
  text: string;
  /** Under one hour — switches the timer to its red state. */
  urgent: boolean;
  expired: boolean;
  /** 0–1 of the window elapsed, for the ring. */
  elapsed: number;
};

const p2 = (v: number) => String(Math.floor(v)).padStart(2, "0");

/**
 * `expiresAt`/`startedAt` in ms. Clamps rather than going negative: a closed poll
 * shows `00:00`, never `-01:23`.
 */
export function countdown(
  expiresAt: number | null,
  now: number = Date.now(),
  startedAt?: number
): Countdown {
  if (expiresAt === null) {
    return { text: "", urgent: false, expired: false, elapsed: 0 };
  }

  const remaining = Math.max(0, expiresAt - now);
  const expired = remaining === 0;
  const urgent = !expired && remaining < 3_600_000;

  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  /**
   * Three forms, because one does not survive the range.
   *
   * A six-day poll rendered `146:38:14` — technically the hours remaining, and
   * unreadable. Nobody counts in 146 hours, and the chip beside it already said
   * "6d left", so the page contradicted itself. Past a day the seconds are noise
   * anyway; under an hour the hours column is, and MM:SS reads more urgent.
   */
  const text =
    urgent || expired
      ? `${p2(m)}:${p2(s)}`
      : h >= 24
        ? `${Math.floor(h / 24)}d ${p2(h % 24)}:${p2(m)}`
        : `${p2(h)}:${p2(m)}:${p2(s)}`;

  let elapsed = 0;
  if (startedAt !== undefined && expiresAt > startedAt) {
    elapsed = Math.min(1, Math.max(0, (now - startedAt) / (expiresAt - startedAt)));
  }

  return { text, urgent, expired, elapsed };
}

/**
 * Is this poll close enough to the end that saying so is *information* rather
 * than decoration?
 *
 * CLAUDE.md: red is time pressure only. Every live poll was rendering the red
 * `.chip.hot`, which means red said "this poll exists" and nothing on any screen
 * said "this one is about to close". Six hours is the window where a share can
 * still change the result — past that it is a reminder, not a deadline.
 */
export const ENDING_SOON_MS = 6 * 3600e3;

export function endingSoon(expiresAt: number | null, now: number = Date.now()): boolean {
  if (expiresAt === null) return false;
  const left = expiresAt - now;
  return left > 0 && left <= ENDING_SOON_MS;
}

/** The chip form: `4h left`, `3d left`, `12m left`, `Closed`. */
export function shortLeft(expiresAt: number | null, now: number = Date.now()): string {
  if (expiresAt === null) return "No deadline";
  const ms = expiresAt - now;
  if (ms <= 0) return "Closed";

  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

/** `2h ago`, `3d ago` — activity rows and the admin queue. */
export function ago(at: number, now: number = Date.now()): string {
  const secs = Math.max(0, Math.floor((now - at) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * Two-letter monogram for Space avatars — doc 04 §5.13.
 *
 * Punctuation is stripped **before** words are counted. "India · Settle It" was
 * rendering as `I·` — the interpunct is its own whitespace-delimited word, and a
 * separator is not an initial. Names with a middle dot are common here, since
 * that is how the Space picker suggests formatting them.
 */
export function monogram(name: string): string {
  const words = (name ?? "")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * `1 vote` / `12 votes`. Grouped by `n()`, so it is still safe inside `.num`.
 *
 * Exists because "1 votes" appeared on a share preview — the single surface
 * where the product's credibility is decided before anyone has clicked.
 */
export const plural = (count: number, one: string, many = `${one}s`) =>
  `${n(count)} ${unit(count, one, many)}`;

/**
 * Just the noun. For the chips, where the digits need their own `.num` span —
 * CLAUDE.md: every number is wrapped, without exception, or live counts jitter.
 */
export const unit = (count: number, one: string, many = `${one}s`) =>
  count === 1 ? one : many;
