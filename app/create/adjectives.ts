/**
 * One-tap suggestions for person-poll questions — DECISIONS D7 (2026-08-07).
 *
 * No longer a guardrail: the question is a free-text field now, and these are
 * presets underneath it. The preventive control this list used to be is gone;
 * what remains is reactive — the report button, the 3-report auto-hide, and
 * the `/admin` moderation queue. See DECISIONS D7 for the trade-off as stated
 * when the owner made this call.
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
  "Most chill",
  "Best dressed",
  "Kindest",
  "Most creative",
  "Best mentor",
  "Most punctual",
] as const;
