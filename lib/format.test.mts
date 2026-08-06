import { test } from "node:test";
import assert from "node:assert/strict";
import { pctOf, countdown, shortLeft, endingSoon, ago, monogram, plural, n, segments } from "./format.ts";

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

test("countdown counts days once past 24h", () => {
  // Shipped as "146:38:14" on a six-day poll, beside a chip reading "6d left".
  assert.equal(countdown(T + 146 * 3600e3 + 38 * 60e3 + 14e3, T).text, "6d 02:38");
  assert.equal(countdown(T + 24 * 3600e3, T).text, "1d 00:00", "exactly 24h");
  assert.equal(
    countdown(T + 23 * 3600e3 + 59 * 60e3, T).text,
    "23:59:00",
    "under 24h keeps HH:MM:SS"
  );
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

test("segments has no deadline", () => {
  assert.deepEqual(segments(null, T), []);
});

test("segments is over at zero", () => {
  assert.deepEqual(segments(T - 1, T), [
    { value: "00", unit: "MIN" },
    { value: "00", unit: "SEC" },
  ]);
});

test("segments shows days, hours, minutes past a day", () => {
  assert.deepEqual(segments(T + 6 * 86400e3 + 2 * 3600e3 + 38 * 60e3, T), [
    { value: "06", unit: "DAYS" },
    { value: "02", unit: "HRS" },
    { value: "38", unit: "MIN" },
  ]);
});

test("segments shows hours, minutes, seconds under a day", () => {
  assert.deepEqual(segments(T + 4 * 3600e3 + 12 * 60e3 + 7e3, T), [
    { value: "04", unit: "HRS" },
    { value: "12", unit: "MIN" },
    { value: "07", unit: "SEC" },
  ]);
});

test("segments drops hours under an hour", () => {
  assert.deepEqual(segments(T + 40 * 60e3 + 5e3, T), [
    { value: "40", unit: "MIN" },
    { value: "05", unit: "SEC" },
  ]);
});

test("segments at exactly 24h is a days block, not 24 hours", () => {
  assert.deepEqual(segments(T + 24 * 3600e3, T), [
    { value: "01", unit: "DAYS" },
    { value: "00", unit: "HRS" },
    { value: "00", unit: "MIN" },
  ]);
});

test("endingSoon is the 6h window, not 'is live'", () => {
  assert.equal(endingSoon(null, T), false, "no deadline is never urgent");
  assert.equal(endingSoon(T - 1, T), false, "already closed is not 'ending soon'");
  assert.equal(endingSoon(T + 1, T), true);
  assert.equal(endingSoon(T + 6 * 3600e3, T), true, "exactly 6h is inside");
  assert.equal(endingSoon(T + 6 * 3600e3 + 1, T), false, "past 6h is not");
});
