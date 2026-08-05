/**
 * The Space results gate — 03-ux-flows §C.
 *
 * Its own module, not `poll-queries.ts`, for two reasons: that file is
 * `server-only` and so cannot be unit tested, and this rule now guards a
 * payment. The number was copy-pasted into four screens before this existed.
 */

/**
 * A Space shows results only once it has this many members.
 *
 * 03 §C specifies 20. Lowered to 5 at launch: 20 is tuned for a Space that
 * already has a campus behind it, and a brand-new one cannot clear it — the
 * first 8–10 people would vote into a blank board, which is exactly when they
 * decide whether to pass the link on. Raise it once a Space routinely clears it;
 * the mechanic and the progress bar are unchanged, only the bar height.
 */
export const SPACE_UNLOCK_MEMBERS = 5;

/**
 * Are this poll's results still behind the Space gate?
 *
 * Sibling of `isExpired()`, and here for the same reason: the poll page, the
 * board and the paywall must not disagree about it.
 *
 * **It hides numbers, never the ballot.** A Space is joined by voting (03 §I,
 * "implicit on first vote"), so gating the vote itself on member count is a
 * deadlock — member_count can never reach 20 because nobody can vote. That
 * shipped, and the first stranger to open a poll link hit it.
 */
export function resultsLocked(poll: {
  space: { member_count: number } | null;
}): boolean {
  return poll.space !== null && poll.space.member_count < SPACE_UNLOCK_MEMBERS;
}
