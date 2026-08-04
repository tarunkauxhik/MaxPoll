import { test } from "node:test";
import assert from "node:assert/strict";
import { similarity } from "./similarity.ts";

test("identical strings are 1", () => {
  assert.equal(similarity("Narendra Modi", "Narendra Modi"), 1);
});

test("normalisation matches the migration's label_norm", () => {
  // label_norm lowercases, trims, and strips everything but [a-z0-9 ].
  assert.equal(similarity("Narendra Modi", "narendra modi"), 1);
  assert.equal(similarity("Verma Ma'am", "Verma Maam"), 1);
  assert.equal(similarity("  Rajma Sir  ", "Rajma Sir"), 1);
});

/**
 * Measured, not assumed. The spec's >0.8 warning threshold is strict: a single
 * dropped character scores 0.727–0.800 depending on name length, so it does NOT
 * fire for ordinary typos on short names.
 *
 * That is the intended division of labour, not a gap. The typeahead's >0.3 floor
 * surfaces "Rajma Sir · #1 · 116 votes" in the suggestion list, and seeing the
 * rank and count is what actually stops the duplicate (doc 04 §5.10). The 0.8
 * warning is the louder interruption reserved for near-identical strings.
 */
test("the 0.8 warning fires only for near-identical strings", () => {
  assert.ok(similarity("Narendra Modi", "Narendra Modii") > 0.8, "extra char: 0.813");
  assert.ok(similarity("Narendra Modi", "Narendra Mod") <= 0.8, "dropped char: 0.800");
  assert.ok(similarity("Rajma Sir", "Rajma Si") < 0.8, "short name typo: 0.727");
});

test("near-typos still clear the >0.3 typeahead floor, which is the real defence", () => {
  assert.ok(similarity("Rajma Sir", "Rajma Si") > 0.3);
  assert.ok(similarity("Narendra Modi", "Narendra Mod") > 0.3);
});

test("genuinely different names fall well below the threshold", () => {
  assert.ok(similarity("Rajma Sir", "Verma Ma'am") < 0.8);
  assert.ok(similarity("Anand Sir", "Rajma Sir") < 0.8);
});

test("the >0.3 typeahead floor separates related from unrelated", () => {
  assert.ok(similarity("narendr", "Narendra Modi") > 0.3, "prefix should surface");
  assert.ok(similarity("xyz", "Narendra Modi") < 0.3);
});

test("empty and punctuation-only inputs are 0, not NaN", () => {
  assert.equal(similarity("", "Rajma"), 0);
  assert.equal(similarity("!!!", "Rajma"), 0);
  assert.equal(similarity("", ""), 0);
});

test("similarity is symmetric", () => {
  const a = "Priyadarshini Venkataraman";
  const b = "Priyadarshini Venkatraman";
  assert.equal(similarity(a, b), similarity(b, a));
});
