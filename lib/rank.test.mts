import { test } from "node:test";
import assert from "node:assert/strict";
import { rankOptions, gapAbove, raceGap, type RankInput } from "./rank.ts";

const opt = (
  id: string,
  vote_count: number | null,
  created_at = "2026-01-01T00:00:00Z",
  rank_snapshot: number | null = null
): RankInput => ({ id, label: id, vote_count, rank_snapshot, created_at });

test("ranks by votes desc, then created_at — matching search_options()", () => {
  const board = rankOptions(
    [
      opt("c", 5, "2026-01-03T00:00:00Z"),
      opt("a", 10, "2026-01-01T00:00:00Z"),
      opt("b", 5, "2026-01-02T00:00:00Z"),
    ],
    20
  );
  assert.deepEqual(board.map((o) => o.id), ["a", "b", "c"]);
  assert.deepEqual(board.map((o) => o.rank), [1, 2, 3]);
  // The tie between b and c breaks on created_at, not on array order in.
  assert.equal(board[1].id, "b");
});

test("null vote_count is zero, not a crash", () => {
  const board = rankOptions([opt("a", null), opt("b", 3)], 3);
  assert.equal(board[0].id, "b");
  assert.equal(board[1].votes, 0);
});

test("percentages floor and never exceed 100 in total", () => {
  const board = rankOptions([opt("a", 1), opt("b", 1), opt("c", 1)], 3);
  assert.equal(board.reduce((s, o) => s + o.pct, 0), 99);
});

test("an empty poll does not divide by zero", () => {
  const board = rankOptions([opt("a", 0)], 0);
  assert.equal(board[0].pct, 0);
});

test("movement: never snapshotted is NEW, unchanged is undefined", () => {
  const board = rankOptions(
    [
      opt("a", 10, "2026-01-01T00:00:00Z", 3), // was 3rd, now 1st → ▲2
      opt("b", 5, "2026-01-02T00:00:00Z", 2), // was 2nd, still 2nd → nothing
      opt("c", 1, "2026-01-03T00:00:00Z", null), // never snapshotted → NEW
    ],
    16
  );
  assert.equal(board[0].movement, 2);
  assert.equal(board[1].movement, undefined, "0 must be undefined, not 0 → no ▲0 badge");
  assert.equal(board[2].movement, "new");
});

test("movement is negative when an option drops", () => {
  const board = rankOptions(
    [opt("a", 10, "2026-01-01T00:00:00Z", 1), opt("b", 20, "2026-01-02T00:00:00Z", 2)],
    30
  );
  assert.equal(board[1].movement, -1, "a fell from 1 to 2");
});

test("rankOptions does not mutate its input", () => {
  const input = [opt("a", 1), opt("b", 9)];
  const copy = [...input];
  rankOptions(input, 10);
  assert.deepEqual(input, copy);
});

test("gapAbove needs one MORE than parity to overtake", () => {
  const board = rankOptions(
    [opt("lead", 82, "2026-01-01T00:00:00Z"), opt("mine", 65, "2026-01-02T00:00:00Z")],
    147
  );
  const gap = gapAbove(board, "mine");
  assert.deepEqual(gap, { need: 18, target: "lead" }, "82-65=17, so 18 to pass");
});

test("gapAbove is null at rank 1, and when not voted", () => {
  const board = rankOptions([opt("a", 5), opt("b", 1, "2026-01-02T00:00:00Z")], 6);
  assert.equal(gapAbove(board, "a"), null, "already leading");
  assert.equal(gapAbove(board, null), null, "hasn't voted");
  assert.equal(gapAbove(board, "ghost"), null, "option not on this board");
});

test("gapAbove on a tie still asks for one vote", () => {
  const board = rankOptions(
    [opt("a", 5, "2026-01-01T00:00:00Z"), opt("b", 5, "2026-01-02T00:00:00Z")],
    10
  );
  assert.deepEqual(gapAbove(board, "b"), { need: 1, target: "a" });
});

test("raceGap names the top two and the distance between them", () => {
  const board = rankOptions(
    [opt("lead", 82, "2026-01-01T00:00:00Z"), opt("second", 65, "2026-01-02T00:00:00Z")],
    147
  );
  assert.deepEqual(raceGap(board), { lead: 17, leader: "lead", runnerUp: "second" });
});

test("raceGap is null when there is no race to describe", () => {
  assert.equal(raceGap([]), null, "empty board");
  assert.equal(raceGap(rankOptions([opt("a", 5)], 5)), null, "one option");
  assert.equal(
    raceGap(rankOptions([opt("a", 0), opt("b", 0, "2026-01-02T00:00:00Z")], 0)),
    null,
    "leader on zero votes — '0 ahead' is noise, not tension"
  );
});
