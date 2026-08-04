// Explicit .ts extension: Node's ESM resolver (which runs the tests) requires it,
// while the bundler is happy either way. Any lib file reachable from a test needs it.
import { pctOf } from "./format.ts";

export type RankInput = {
  id: string;
  label: string;
  vote_count: number | null;
  rank_snapshot: number | null;
  created_at: string;
};

export type BoardOption = {
  id: string;
  label: string;
  votes: number;
  pct: number;
  rank: number;
  /** rank_snapshot − current rank. Positive = climbed. "new" = never snapshotted. */
  movement: number | "new" | undefined;
};

/**
 * Ranks options at read time — DECISIONS A3. There is deliberately no `rank`
 * column: a stored rank drifts the moment two votes race, and recomputing it on
 * write would touch every row of a poll on every vote.
 *
 * The sort must match `search_options()` in the migration exactly
 * (`vote_count desc, created_at`), or the typeahead advertises "#2" for an option
 * the board shows at #3 — and that inconsistency is precisely what the typeahead
 * exists to prevent.
 */
export function rankOptions(rows: RankInput[], totalVotes: number): BoardOption[] {
  return [...rows]
    .sort(
      (a, b) =>
        (b.vote_count ?? 0) - (a.vote_count ?? 0) ||
        a.created_at.localeCompare(b.created_at)
    )
    .map((o, i) => {
      const rank = i + 1;
      const delta = o.rank_snapshot === null ? null : o.rank_snapshot - rank;
      return {
        id: o.id,
        label: o.label,
        votes: o.vote_count ?? 0,
        pct: pctOf(o.vote_count ?? 0, totalVotes),
        rank,
        // 0 becomes undefined so <Movement> renders nothing rather than "▲0".
        movement: delta === null ? "new" : delta === 0 ? undefined : delta,
      };
    });
}

/**
 * The gap line — doc 04 §5.2, the growth engine.
 *
 * Returns how far the user's pick is behind the option directly above it, or
 * null when they're already #1 or haven't voted. `+1` because overtaking needs
 * one vote *more* than parity, and a line that says "5 votes behind" when 6 are
 * needed is a small lie people notice after sharing.
 */
export function gapAbove(
  board: BoardOption[],
  myOptionId: string | null
): { need: number; target: string } | null {
  if (!myOptionId) return null;
  const i = board.findIndex((o) => o.id === myOptionId);
  if (i <= 0) return null;

  const above = board[i - 1];
  return { need: above.votes - board[i].votes + 1, target: above.label };
}
