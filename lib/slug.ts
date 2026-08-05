/**
 * URL slug from a title, with a random suffix.
 *
 * Suffixed rather than checked-and-retried: `polls.slug` and `spaces.slug` are
 * both unique, and a collision on insert would mean a lost draft at the worst
 * possible moment — right after someone finished typing.
 *
 * `max` is the length of the readable part, before the suffix. Polls allow 40,
 * Spaces 30 — the two callers this was extracted from.
 */
export function slugify(text: string, max = 40, suffixLen = 5): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    // A title ending in punctuation ("Best teacher?") slices to a trailing dash,
    // which would otherwise read "best-teacher--x8f2q".
    .replace(/-+$/, "");

  return `${base || "untitled"}-${suffix(suffixLen)}`;
}

/**
 * Padded, because `Math.random().toString(36)` is not fixed-width — 0.5 renders
 * as "0.i" and would hand back a one-character suffix. Rare, and the failure is
 * a unique-violation on insert, so it is not allowed to be possible.
 */
function suffix(len: number): string {
  return Math.random().toString(36).slice(2).padEnd(len, "0").slice(0, len);
}
