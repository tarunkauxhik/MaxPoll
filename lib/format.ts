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

  // Under an hour the hours column is noise; MM:SS reads more urgent.
  const text = urgent || expired ? `${p2(m)}:${p2(s)}` : `${p2(h)}:${p2(m)}:${p2(s)}`;

  let elapsed = 0;
  if (startedAt !== undefined && expiresAt > startedAt) {
    elapsed = Math.min(1, Math.max(0, (now - startedAt) / (expiresAt - startedAt)));
  }

  return { text, urgent, expired, elapsed };
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

/** Two-letter monogram for Space avatars — doc 04 §5.13. */
export function monogram(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
