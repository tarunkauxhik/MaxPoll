/**
 * A poll or Space is reachable by two keys: its readable slug
 * (`greatest-indian-odi-batter-x8f2q`) and its short code (`k7m2xqp`).
 *
 * The slug is canonical — it is what gets indexed and what tells someone in a
 * WhatsApp group what they are about to tap. The code exists for the paste
 * itself. Both hit the same row, so no redirect sits on the hottest path in the
 * product.
 */

/**
 * Slugs and codes are `[a-z0-9-]` and nothing else. The URL segment is
 * attacker-controlled and goes into a PostgREST `or=(...)` filter, where a comma
 * or a dot is *syntax* — `?slug=x,vote_count.gt.0` would be parsed, not escaped.
 * So the shape is checked before the string is built, not after.
 */
const KEY = /^[a-z0-9][a-z0-9-]{0,79}$/;

/**
 * The PostgREST `.or()` argument matching either key, or `null` when the segment
 * cannot be a key at all — callers treat that as "not found" without a round
 * trip.
 */
export function keyFilter(key: string): string | null {
  const k = key.toLowerCase();
  return KEY.test(k) ? `slug.eq.${k},code.eq.${k}` : null;
}
