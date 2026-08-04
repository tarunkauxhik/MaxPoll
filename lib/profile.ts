/** Profile validation. Pure functions so the 18+ gate is testable — it's a legal
 *  boundary, not a preference. */

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const BIO_MAX = 150;

/**
 * 18+ gate. Compares calendar dates, not milliseconds — someone born on 29 Feb
 * or turning 18 today must not be off by a day because of timezone drift.
 *
 * Returns false for anything unparseable or in the future: **fail closed**. This
 * decides whether a minor gets into an 18+ product.
 */
export function isAdult(dob: string, now: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob?.trim() ?? "");
  if (!m) return false;

  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Reject 2026-02-31 and friends: Date rolls them over silently.
  const parsed = new Date(Date.UTC(y, mo - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== mo - 1 ||
    parsed.getUTCDate() !== d
  ) {
    return false;
  }
  if (parsed.getTime() > now.getTime()) return false;

  let age = now.getUTCFullYear() - y;
  const monthDiff = now.getUTCMonth() - (mo - 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < d)) age -= 1;

  return age >= 18;
}

export const isValidHandle = (h: string) => HANDLE_RE.test(h?.trim() ?? "");

/** Seeds the handle field from the Google display name. Never authoritative — the
 *  unique index decides, and the user can always overwrite it. */
export function suggestHandle(displayName: string | null | undefined): string {
  const base = (displayName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 16);
  if (base.length >= 3) return base;
  return `user_${Math.random().toString(36).slice(2, 8)}`;
}

/** Strips an @ and whitespace off a pasted social handle. Decorative, unverified. */
export const cleanSocial = (v: string | null | undefined) => {
  const s = (v ?? "").trim().replace(/^@+/, "").slice(0, 30);
  return s.length ? s : null;
};
