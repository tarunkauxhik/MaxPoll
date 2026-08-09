/**
 * One-tap suggestions for person-poll questions.
 *
 * Not a guardrail — the question is a free-text field, and these are presets
 * underneath it. The preventive control this list used to be is gone; what
 * remains is reactive: the report button, the 3-report auto-hide, and the
 * `/admin` moderation queue.
 *
 * **Six, not thirteen.** Thirteen wrapped to four rows and pushed the actual
 * question box off a 360px screen — a menu where a nudge was wanted. Keep it
 * short; if a seventh feels essential, one of these is weaker than it.
 *
 * Lives in its own module because a `"use server"` file may only export async
 * functions — a const array there is a build error.
 */
export const ADJECTIVES = [
  "Best",
  "Funniest",
  "Most underrated",
  "Most helpful",
  "Hardest working",
  "Best dressed",
] as const;
