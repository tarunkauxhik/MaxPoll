/**
 * Vote-intent preservation — build plan 4.4.
 *
 * "Losing it on return is the single most damaging bug that can ship."
 * A user taps a name, gets bounced to Google, comes back — and the vote must land
 * on the option they originally tapped, not vanish.
 *
 * Pure functions over a Storage-like object so this is testable without a browser.
 * `localStorage`, not a cookie: it must survive the OAuth round trip without
 * riding on any request, and it must never reach the edge-cached routes (A2).
 */

const KEY = "maxpoll.vote_intent";

/** 30 minutes. Long enough for a slow Google sign-up, short enough that a vote
 *  from last week never fires unexpectedly on a poll the user forgot about. */
const TTL_MS = 30 * 60 * 1000;

export type VoteIntent = { pollId: string; optionId: string; at: number };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveIntent(
  storage: StorageLike,
  intent: Omit<VoteIntent, "at">,
  now: number = Date.now()
): void {
  try {
    storage.setItem(KEY, JSON.stringify({ ...intent, at: now }));
  } catch {
    // Private mode / quota. The vote is lost, but a thrown error here would
    // block the sign-in redirect entirely, which is strictly worse.
  }
}

/**
 * Returns the pending intent for this poll, or null. Always clears what it reads:
 * replaying twice would double-submit, and `cast_vote` would raise ALREADY_VOTED
 * on the second — showing the user an error for a vote that actually succeeded.
 */
export function takeIntent(
  storage: StorageLike,
  pollId: string,
  now: number = Date.now()
): VoteIntent | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearIntent(storage);
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as VoteIntent).pollId !== "string" ||
    typeof (parsed as VoteIntent).optionId !== "string" ||
    typeof (parsed as VoteIntent).at !== "number"
  ) {
    clearIntent(storage);
    return null;
  }

  const intent = parsed as VoteIntent;

  if (now - intent.at > TTL_MS) {
    clearIntent(storage);
    return null;
  }

  // A different poll's intent stays put — the user may have opened this poll in a
  // new tab mid-sign-in, and dropping it here would lose the original vote.
  if (intent.pollId !== pollId) return null;

  clearIntent(storage);
  return intent;
}

export function clearIntent(storage: StorageLike): void {
  try {
    storage.removeItem(KEY);
  } catch {
    /* nothing we can do, and nothing worth breaking the page over */
  }
}
