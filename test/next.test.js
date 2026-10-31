// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";

import { matchesDay, next, nextOne } from "../src/next.js";
import { parse } from "../src/parse.js";

const at = (iso) => new Date(iso);
const iso = (date) => date.toISOString();
const runs = (expression, from, count) =>
  next(expression, at(from), count).map(iso);

test("next run is strictly later", () => {
  assert.deepEqual(runs("*/15 * * * *", "2026-01-01T00:00:00Z", 1), [
    "2026-01-01T00:15:00.000Z",
  ]);
  // Starting exactly on a matching minute moves to the following one.
  assert.deepEqual(runs("*/15 * * * *", "2026-01-01T00:15:00Z", 1), [
    "2026-01-01T00:30:00.000Z",
  ]);
});

test("consecutive runs", () => {
  assert.deepEqual(runs("0 * * * *", "2026-01-01T10:30:00Z", 3), [
    "2026-01-01T11:00:00.000Z",
    "2026-01-01T12:00:00.000Z",
    "2026-01-01T13:00:00.000Z",
  ]);
});

test("daily schedule rolls into the next day", () => {
  assert.deepEqual(runs("0 0 * * *", "2026-01-01T12:00:00Z", 1), [
    "2026-01-02T00:00:00.000Z",
  ]);
});

test("monthly schedule rolls into the next month", () => {
  assert.deepEqual(runs("0 0 1 * *", "2026-01-15T00:00:00Z", 1), [
    "2026-02-01T00:00:00.000Z",
  ]);
});

test("day-of-month OR day-of-week, the POSIX rule", () => {
  // 2026-01-01 is a Thursday, so the first Monday is the 5th.
  assert.deepEqual(runs("0 0 1 * MON", "2026-01-02T00:00:00Z", 1), [
    "2026-01-05T00:00:00.000Z",
  ]);
  // From 28 January: 1 February is a Sunday, which beats Monday the 2nd.
  assert.deepEqual(runs("0 0 1 * MON", "2026-01-28T00:00:00Z", 1), [
    "2026-02-01T00:00:00.000Z",
  ]);
});

test("leap day is found, however far away", () => {
  assert.deepEqual(runs("0 0 29 2 *", "2026-01-01T00:00:00Z", 1), [
    "2028-02-29T00:00:00.000Z",
  ]);
});

test("an impossible schedule yields nothing", () => {
  assert.equal(nextOne(parse("0 0 31 2 *"), at("2026-01-01T00:00:00Z")), null);
  assert.deepEqual(runs("0 0 31 2 *", "2026-01-01T00:00:00Z", 3), []);
});

test("weekday-only schedule skips the weekend", () => {
  // 2026-01-02 is a Friday; the next weekday run is Monday the 5th at 09:00.
  assert.deepEqual(runs("0 9 * * MON-FRI", "2026-01-02T10:00:00Z", 1), [
    "2026-01-05T09:00:00.000Z",
  ]);
});

test("matchesDay follows the flags", () => {
  const day = at("2026-01-05T00:00:00Z"); // a Monday
  assert.equal(matchesDay(parse("0 0 * * *"), day), true);
  assert.equal(matchesDay(parse("0 0 5 * *"), day), true);
  assert.equal(matchesDay(parse("0 0 6 * *"), day), false);
  assert.equal(matchesDay(parse("0 0 * * MON"), day), true);
  assert.equal(matchesDay(parse("0 0 1 * MON"), day), true);
  assert.equal(matchesDay(parse("0 0 1 * TUE"), day), false);
});

test("count zero returns nothing and negative caps at one", () => {
  assert.deepEqual(next("0 * * * *", at("2026-01-01T00:00:00Z"), 0), []);
  assert.equal(next("0 * * * *", at("2026-01-01T00:00:00Z"), 1).length, 1);
});
