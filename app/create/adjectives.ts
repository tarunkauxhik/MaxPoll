/**
 * Preset adjectives for person-polls — 03-ux-flows D.
 *
 * **Positive only, and owner-controlled.** Free-text adjectives on a poll about a
 * named real person is how this product becomes a bullying tool; the preset list
 * is the guardrail.
 *
 * Lives in its own module because a `"use server"` file may only export async
 * functions — a const array there is a build error.
 */
export const ADJECTIVES = [
  "Best",
  "Most helpful",
  "Most underrated",
  "Funniest",
  "Most reliable",
  "Most improved",
  "Hardest working",
] as const;
