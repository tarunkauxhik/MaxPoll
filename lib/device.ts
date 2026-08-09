/**
 * A stable per-browser id.
 *
 * RULES.md: `device_id` is a fraud **signal**, not a constraint. It is
 * indexed, never unique — a unique index would break the shared-laptop case that
 * is common on an Indian campus (A votes, signs out, B signs in → ALREADY_VOTED).
 * The real guard is `unique(poll_id, user_id)`.
 *
 * So this does not need to be unforgeable, and deliberately isn't: no
 * fingerprinting, nothing to consent to under DPDP.
 */
const KEY = "maxpoll.device";

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Private mode: a per-session id is fine. It only ever feeds velocity
    // flagging, so a miss costs nothing.
    return crypto.randomUUID();
  }
}
