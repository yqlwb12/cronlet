// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";

import { CronError, describe, parse } from "../src/parse.js";

test("wildcards select the whole range", () => {
  const schedule = parse("* * * * *");
  assert.equal(schedule.minutes.size, 60);
  assert.equal(schedule.hours.size, 24);
  assert.equal(schedule.daysOfMonth.size, 31);
  assert.equal(schedule.months.size, 12);
  assert.equal(schedule.daysOfWeek.size, 7);
  assert.equal(schedule.domRestricted, false);
  assert.equal(schedule.dowRestricted, false);
});

test("steps count from the range start", () => {
  assert.deepEqual([...parse("*/15 * * * *").minutes].sort((a, b) => a - b), [0, 15, 30, 45]);
  assert.deepEqual([...parse("10-20/5 * * * *").minutes].sort((a, b) => a - b), [10, 15, 20]);
});

test("a bare value with a step runs to the end of the field", () => {
  assert.deepEqual([...parse("50/5 * * * *").minutes].sort((a, b) => a - b), [50, 55]);
});

test("ranges and lists", () => {
  const schedule = parse("0 9-11,18 * * *");
  assert.deepEqual([...schedule.hours].sort((a, b) => a - b), [9, 10, 11, 18]);
});

test("names are case insensitive", () => {
  assert.deepEqual([...parse("0 0 1 jan *").months], [1]);
  assert.deepEqual([...parse("0 0 * * mon-fri").daysOfWeek].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert.deepEqual([...parse("0 0 * * SUN").daysOfWeek], [0]);
});

test("7 and 0 are both Sunday", () => {
  assert.deepEqual([...parse("0 0 * * 7").daysOfWeek], [0]);
  assert.deepEqual([...parse("0 0 * * 0,7").daysOfWeek], [0]);
});

test("restricted flags only fire on real restrictions", () => {
  const both = parse("0 0 1 * MON");
  assert.equal(both.domRestricted, true);
  assert.equal(both.dowRestricted, true);

  const onlyDom = parse("0 0 1 * *");
  assert.equal(onlyDom.domRestricted, true);
  assert.equal(onlyDom.dowRestricted, false);

  // "?" is the quartz spelling of "any", and means the same thing here.
  assert.equal(parse("0 0 ? * *").domRestricted, false);
});

test("macros expand", () => {
  assert.deepEqual([...parse("@daily").hours], [0]);
  assert.deepEqual([...parse("@hourly").minutes], [0]);
  assert.deepEqual([...parse("@weekly").daysOfWeek], [0]);
  assert.deepEqual([...parse("@monthly").daysOfMonth], [1]);
  assert.equal(parse("@YEARLY").source, "@YEARLY");
});

test("bad expressions are rejected with a useful message", () => {
  const cases = [
    ["", /empty/],
    ["* * * *", /expected 5 fields/],
    ["60 * * * *", /outside 0-59/],
    ["* 24 * * *", /outside 0-23/],
    ["* * 0 * *", /outside 1-31/],
    ["* * * 13 *", /outside 1-12/],
    ["* * * * 8", /outside 0-7/],
    ["*/0 * * * *", /positive integer/],
    ["5-1 * * * *", /backwards/],
    ["a * * * *", /not a number/],
    ["1,,2 * * * *", /empty item/],
  ];
  for (const [expression, pattern] of cases) {
    assert.throws(() => parse(expression), CronError, expression);
    assert.throws(() => parse(expression), pattern, expression);
  }
});

test("describe lists the selected values", () => {
  const text = describe(parse("*/30 9 * * MON"));
  assert.match(text, /minute\s+0,30/);
  assert.match(text, /hour\s+9/);
  assert.match(text, /weekday\s+1/);
});
