// SPDX-License-Identifier: MIT
//
// Working out when a schedule fires. Everything is evaluated in UTC: that is
// the only way to be unambiguous, and it means a daylight-saving change cannot
// silently swallow or duplicate a run. Local time is a display concern.

import { parse } from "./parse.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How far ahead to look before giving up. Eight years covers 29 February. */
export const HORIZON_DAYS = 366 * 8;

/**
 * Does this day satisfy the schedule?
 *
 * The POSIX rule, and the one everybody gets wrong: when both day-of-month and
 * day-of-week are restricted, a day matches if EITHER matches. `0 0 1 * MON`
 * means "the first of the month, or any Monday", not "the first if it is a
 * Monday".
 */
export function matchesDay(schedule, date) {
  const onDay = schedule.daysOfMonth.has(date.getUTCDate());
  const onWeekday = schedule.daysOfWeek.has(date.getUTCDay());
  if (schedule.domRestricted && schedule.dowRestricted) {
    return onDay || onWeekday;
  }
  if (schedule.domRestricted) {
    return onDay;
  }
  if (schedule.dowRestricted) {
    return onWeekday;
  }
  return true;
}

function nextDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

function nextMonthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function nextHourStart(date) {
  return new Date(Math.floor(date.getTime() / HOUR) * HOUR + HOUR);
}

/**
 * The first matching instant strictly after `from`, or null if the schedule
 * cannot fire within the horizon.
 */
export function nextOne(schedule, from = new Date()) {
  // Jump to the next whole minute: a schedule never fires "during" one.
  let cursor = new Date(Math.floor(from.getTime() / MINUTE) * MINUTE + MINUTE);
  const stop = from.getTime() + HORIZON_DAYS * DAY;

  while (cursor.getTime() <= stop) {
    if (!schedule.months.has(cursor.getUTCMonth() + 1)) {
      cursor = nextMonthStart(cursor);
      continue;
    }
    if (!matchesDay(schedule, cursor)) {
      cursor = nextDayStart(cursor);
      continue;
    }
    if (!schedule.hours.has(cursor.getUTCHours())) {
      cursor = nextHourStart(cursor);
      continue;
    }
    if (!schedule.minutes.has(cursor.getUTCMinutes())) {
      cursor = new Date(cursor.getTime() + MINUTE);
      continue;
    }
    return cursor;
  }
  return null;
}

/** Up to `count` upcoming runs, newest last. Stops early if the schedule dies. */
export function next(expression, from = new Date(), count = 1) {
  const schedule = typeof expression === "string" ? parse(expression) : expression;
  const runs = [];
  let cursor = from;
  for (let index = 0; index < count; index += 1) {
    const hit = nextOne(schedule, cursor);
    if (hit === null) {
      break;
    }
    runs.push(hit);
    cursor = hit;
  }
  return runs;
}
