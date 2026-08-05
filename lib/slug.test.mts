import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slug.ts";

const body = (s: string) => s.slice(0, s.lastIndexOf("-"));
const suffix = (s: string) => s.slice(s.lastIndexOf("-") + 1);

test("lowercases, collapses punctuation, trims edges", () => {
  assert.equal(body(slugify("Best 1st year teacher")), "best-1st-year-teacher");
  assert.equal(body(slugify("  Verma Ma'am!!  ")), "verma-ma-am");
});

test("no trailing dash when the title ends in punctuation", () => {
  // "Best teacher?" collapses to "best-teacher-", which would read
  // "best-teacher--x8f2q" once the suffix is appended.
  assert.equal(body(slugify("Best teacher?")), "best-teacher");
  assert.ok(!slugify("Best teacher?").includes("--"));
});

test("max caps the readable part, not the whole slug", () => {
  const s = slugify("a".repeat(80), 30);
  assert.equal(body(s), "a".repeat(30));
  assert.equal(suffix(s).length, 5);
});

test("a title with nothing sluggable still produces a valid slug", () => {
  // Devanagari, emoji, pure punctuation — all strip to "". A bare "-x8f2q" is a
  // usable URL but reads like a bug; `untitled` is the fallback.
  for (const t of ["हिंदी", "🔥🔥", "???", ""]) {
    assert.equal(body(slugify(t)), "untitled");
  }
});

test("suffix is always the requested width", () => {
  // Math.random().toString(36) is not fixed-width — 0.5 renders as "0.i". A
  // short suffix means collisions, and slug is a unique index.
  for (let i = 0; i < 500; i++) {
    assert.equal(suffix(slugify("poll", 40, 5)).length, 5);
    assert.equal(suffix(slugify("space", 30, 4)).length, 4);
  }
});

test("two slugs from the same title differ", () => {
  assert.notEqual(slugify("Best teacher"), slugify("Best teacher"));
});
