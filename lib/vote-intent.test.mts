import { test } from "node:test";
import assert from "node:assert/strict";
import { saveIntent, takeIntent, clearIntent } from "./vote-intent.ts";

function mem() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

const T = 1_754_300_000_000;

test("the round trip: tap → sign in → vote lands on the same option", () => {
  const s = mem();
  saveIntent(s, { pollId: "poll-1", optionId: "opt-9" }, T);
  const got = takeIntent(s, "poll-1", T + 5000);
  assert.equal(got?.optionId, "opt-9");
});

test("an intent is consumed exactly once", () => {
  const s = mem();
  saveIntent(s, { pollId: "p", optionId: "o" }, T);
  assert.ok(takeIntent(s, "p", T));
  // Replaying would double-submit and surface ALREADY_VOTED for a vote that
  // actually succeeded.
  assert.equal(takeIntent(s, "p", T), null);
});

test("a different poll's intent is left alone, not destroyed", () => {
  const s = mem();
  saveIntent(s, { pollId: "poll-A", optionId: "o" }, T);
  assert.equal(takeIntent(s, "poll-B", T), null);
  // Still there — the user may have opened poll B in another tab mid-sign-in.
  assert.equal(takeIntent(s, "poll-A", T)?.optionId, "o");
});

test("intents expire after 30 minutes", () => {
  const s = mem();
  saveIntent(s, { pollId: "p", optionId: "o" }, T);
  assert.equal(takeIntent(s, "p", T + 30 * 60_000 + 1), null);

  saveIntent(s, { pollId: "p", optionId: "o" }, T);
  assert.ok(takeIntent(s, "p", T + 29 * 60_000));
});

test("garbage in storage is discarded, not thrown", () => {
  const s = mem();
  for (const junk of ["not json", "null", "[]", '{"pollId":"p"}', '{"pollId":1,"optionId":"o","at":1}']) {
    s.setItem("maxpoll.vote_intent", junk);
    assert.equal(takeIntent(s, "p", T), null, junk);
    assert.equal(s.getItem("maxpoll.vote_intent"), null, `cleared: ${junk}`);
  }
});

test("storage that throws never breaks the sign-in redirect", () => {
  const hostile = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceeded");
    },
    removeItem: () => {
      throw new Error("nope");
    },
  };
  assert.doesNotThrow(() => saveIntent(hostile, { pollId: "p", optionId: "o" }, T));
  assert.equal(takeIntent(hostile, "p", T), null);
  assert.doesNotThrow(() => clearIntent(hostile));
});
