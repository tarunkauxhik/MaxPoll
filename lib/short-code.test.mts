import { test } from "node:test";
import assert from "node:assert/strict";
import { keyFilter } from "./short-code.ts";

test("matches either key", () => {
  assert.equal(keyFilter("k7m2xqp"), "slug.eq.k7m2xqp,code.eq.k7m2xqp");
  assert.equal(
    keyFilter("best-teacher-x8f2q"),
    "slug.eq.best-teacher-x8f2q,code.eq.best-teacher-x8f2q"
  );
});

test("uppercase in the URL still resolves", () => {
  assert.equal(keyFilter("K7M2XQP"), "slug.eq.k7m2xqp,code.eq.k7m2xqp");
});

/**
 * The whole reason this function exists. A comma or a dot is PostgREST filter
 * syntax, so an unchecked segment is an injection into the query, not a miss.
 */
test("refuses anything that could be filter syntax", () => {
  for (const bad of [
    "x,vote_count.gt.0",
    "x.eq.y",
    "*",
    "(a,b)",
    "a b",
    "-leading-dash",
    "",
    "a".repeat(81),
  ]) {
    assert.equal(keyFilter(bad), null, `should refuse ${JSON.stringify(bad)}`);
  }
});

test("accepts the longest real slug", () => {
  // slugify() caps the readable part at 40 and appends "-" + 5.
  assert.notEqual(keyFilter(`${"a".repeat(40)}-abcde`), null);
});
