import { test } from "node:test";
import assert from "node:assert/strict";
import { resultsLocked, SPACE_UNLOCK_MEMBERS } from "./space.ts";

const inSpace = (member_count: number) => ({ space: { member_count } });

test("locked below the threshold, open at it and above", () => {
  assert.equal(resultsLocked(inSpace(0)), true);
  assert.equal(resultsLocked(inSpace(1)), true);
  assert.equal(resultsLocked(inSpace(SPACE_UNLOCK_MEMBERS - 1)), true);
  // At exactly 20 the gate opens — "20/20 members to unlock" must not still lock.
  assert.equal(resultsLocked(inSpace(SPACE_UNLOCK_MEMBERS)), false);
  assert.equal(resultsLocked(inSpace(SPACE_UNLOCK_MEMBERS + 500)), false);
});

test("a poll outside any Space is never gated", () => {
  // polls.space_id is nullable and create_poll accepts null. A standalone poll
  // has no member count to reach, so gating it would lock its results forever.
  assert.equal(resultsLocked({ space: null }), false);
});
