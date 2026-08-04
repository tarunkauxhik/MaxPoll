import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdult, isValidHandle, suggestHandle, cleanSocial } from "./profile.ts";

const NOW = new Date(Date.UTC(2026, 7, 4)); // 2026-08-04

test("isAdult: the birthday boundary is exact", () => {
  assert.equal(isAdult("2008-08-04", NOW), true, "18 today");
  assert.equal(isAdult("2008-08-05", NOW), false, "18 tomorrow");
  assert.equal(isAdult("2008-08-03", NOW), true, "18 yesterday");
  assert.equal(isAdult("2007-01-01", NOW), true);
  assert.equal(isAdult("2010-01-01", NOW), false); // the gate-3 case
});

test("isAdult fails closed on anything it cannot trust", () => {
  for (const bad of [
    "",
    "   ",
    "not-a-date",
    "2008",
    "08-04-2008",
    "2026-02-31", // rolls over silently if you trust Date
    "2027-01-01", // future
    "2008-13-01",
  ]) {
    assert.equal(isAdult(bad, NOW), false, `should reject ${JSON.stringify(bad)}`);
  }
  // @ts-expect-error — guarding the runtime path, not the type
  assert.equal(isAdult(undefined, NOW), false);
});

test("isAdult handles a 29 Feb birthday", () => {
  assert.equal(isAdult("2008-02-29", new Date(Date.UTC(2026, 1, 28))), false);
  assert.equal(isAdult("2008-02-29", new Date(Date.UTC(2026, 2, 1))), true);
});

test("isValidHandle", () => {
  assert.equal(isValidHandle("tarun_k"), true);
  assert.equal(isValidHandle("ab"), false); // too short
  assert.equal(isValidHandle("a".repeat(21)), false); // too long
  assert.equal(isValidHandle("Tarun"), false); // uppercase
  assert.equal(isValidHandle("tarun k"), false); // space
  assert.equal(isValidHandle("tarun-k"), false); // hyphen
});

test("suggestHandle always produces something valid", () => {
  assert.equal(suggestHandle("Tarun Kaushik"), "tarun_kaushik");
  // Too-short and unusable names must still yield a valid handle, not ""
  assert.notEqual(suggestHandle("A"), "A");
  for (const name of ["", null, undefined, "A", "!!!", "Ravi", "A Very Long Display Name Indeed"]) {
    assert.equal(isValidHandle(suggestHandle(name)), true, `from ${JSON.stringify(name)}`);
  }
});

test("cleanSocial strips @ and empties to null", () => {
  assert.equal(cleanSocial("@tarun"), "tarun");
  assert.equal(cleanSocial("  @@tarun  "), "tarun");
  assert.equal(cleanSocial(""), null);
  assert.equal(cleanSocial(null), null);
});
