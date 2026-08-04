/**
 * Trigram similarity, client-side.
 *
 * Postgres already ranks matches with `pg_trgm` inside `search_options()`. This
 * exists only to decide whether to show the >0.8 "already here" warning without
 * a second round trip, and it mirrors `pg_trgm`'s definition so the client and
 * the database agree about what "nearly identical" means.
 *
 * pg_trgm: pad the string with two leading spaces and one trailing space, take
 * the set of 3-grams, then |A ∩ B| / |A ∪ B|.
 */
function trigrams(input: string): Set<string> {
  // Must match the migration's label_norm expression exactly.
  const norm = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "");
  if (!norm) return new Set();

  const padded = `  ${norm} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  return out;
}

export function similarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;

  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;

  const union = A.size + B.size - shared;
  return union === 0 ? 0 : shared / union;
}
