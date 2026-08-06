import { test } from "node:test";
import assert from "node:assert/strict";
import { pctOf, countdown, shortLeft, ago, monogram, plural, n } from "./format.ts";

const T = Date.UTC(2026, 7, 4, 12, 0, 0);

test("pctOf floors so a board can never sum past 100", () => {
  assert.equal(pctOf(1, 3), 33);
  assert.equal(pctOf(2, 3), 66);
  // three equal options: 33+33+33 = 99. Rounding would give 102.
  const third = pctOf(1, 3);
  assert.ok(third * 3 <= 100);
  assert.equal(pctOf(0, 0), 0, "no divide-by-zero on an empty poll");
  assert.equal(pctOf(5, 5), 100);
});

test("countdown formats and flags urgency", () => {
  assert.equal(countdown(T + 4 * 3600e3 + 12 * 60e3 + 7e3, T).text, "04:12:07");
  assert.equal(countdown(T + 4 * 3600e3, T).urgent, false);

  const soon = countdown(T + 12 * 60e3 + 7e3, T);
  assert.equal(soon.text, "12:07", "under an hour drops the hours column");
  assert.equal(soon.urgent, true);
});

test("countdown clamps instead of going negative", () => {
  const done = countdown(T - 60_000, T);
  assert.equal(done.text, "00:00");
  assert.equal(done.expired, true);
  assert.equal(done.urgent, false, "expired is not urgent — it's over");
});

test("countdown handles a poll with no deadline", () => {
  const forever = countdown(null, T);
  assert.equal(forever.expired, false);
  assert.equal(forever.text, "");
});

test("countdown elapsed drives the ring, clamped to 0..1", () => {
  const started = T - 3600e3;
  assert.equal(countdown(T + 3600e3, T, started).elapsed, 0.5);
  assert.equal(countdown(T - 1, T, started).elapsed, 1);
  assert.equal(countdown(T + 3600e3, started, started).elapsed, 0);
});

test("shortLeft", () => {
  assert.equal(shortLeft(T + 12 * 60e3, T), "12m left");
  assert.equal(shortLeft(T + 4 * 3600e3, T), "4h left");
  assert.equal(shortLeft(T + 3 * 24 * 3600e3, T), "3d left");
  assert.equal(shortLeft(T - 1, T), "Closed");
  assert.equal(shortLeft(null, T), "No deadline");
});

test("ago", () => {
  assert.equal(ago(T - 30e3, T), "just now");
  assert.equal(ago(T - 5 * 60e3, T), "5m ago");
  assert.equal(ago(T - 2 * 3600e3, T), "2h ago");
  assert.equal(ago(T - 3 * 24 * 3600e3, T), "3d ago");
  assert.equal(ago(T - 14 * 24 * 3600e3, T), "2w ago");
  assert.equal(ago(T + 5000, T), "just now", "clock skew must not print a negative");
});

test("monogram", () => {
  // doc 04 §5.13 names this exact case: DTU renders as "DT"
  assert.equal(monogram("Delhi Technological University"), "DT");
  assert.equal(monogram("IIT"), "II");
  assert.equal(monogram("a b"), "AB");
  assert.equal(monogram(""), "??");
  assert.equal(monogram("   "), "??");

  // A separator is not an initial. This shipped as "I·" on a real Space avatar
  // and on its WhatsApp preview.
  assert.equal(monogram("India · Settle It"), "IS");
  assert.equal(monogram("St. Xavier's College"), "SX");
  assert.equal(monogram("·  ·"), "??", "punctuation only");
});

test("plural", () => {
  assert.equal(plural(0, "vote"), "0 votes");
  assert.equal(plural(1, "vote"), "1 vote");
  assert.equal(plural(2, "vote"), "2 votes");
  assert.equal(plural(100000, "vote"), "1,00,000 votes", "keeps Indian grouping");
  assert.equal(plural(1, "person", "people"), "1 person");
  assert.equal(plural(3, "person", "people"), "3 people");
});

test("n uses Indian grouping", () => {
  assert.equal(n(100000), "1,00,000");
  assert.equal(n(340), "340");
});
