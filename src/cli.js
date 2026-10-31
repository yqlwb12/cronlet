#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import { pathToFileURL } from "node:url";

import { CronError, describe, parse } from "./parse.js";
import { next } from "./next.js";

const USAGE = `usage: cronlet "<expression>" [options]

  -n, --count N     how many runs to print (default 5)
      --from WHEN   start point: ISO 8601 or "now" (default: now)
      --json        one JSON array, ISO strings in UTC
      --validate    print the parsed field sets instead of runs
  -h, --help        this text

examples:
  cronlet "*/15 * * * *"
  cronlet "0 9-17 * * MON-FRI" -n 10
  cronlet "@daily" --from 2026-05-01T00:00:00Z --json
`;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function main(argv, out = process.stdout, err = process.stderr) {
  const args = argv.slice(2);
  let expression = null;
  let count = 5;
  let from = new Date();
  let json = false;
  let validate = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "-h" || argument === "--help") {
      out.write(USAGE);
      return 0;
    }
    if (argument === "-n" || argument === "--count") {
      count = Number(args[index + 1]);
      index += 1;
      if (!Number.isInteger(count) || count < 1) {
        err.write("cronlet: --count wants a positive integer\n");
        return 2;
      }
      continue;
    }
    if (argument === "--from") {
      const value = args[index + 1];
      index += 1;
      if (value === undefined) {
        err.write("cronlet: --from wants a value\n");
        return 2;
      }
      from = value === "now" ? new Date() : new Date(value);
      if (Number.isNaN(from.getTime())) {
        err.write(`cronlet: "${value}" is not a date\n`);
        return 2;
      }
      continue;
    }
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--validate") {
      validate = true;
      continue;
    }
    if (argument.startsWith("-")) {
      err.write(`cronlet: unknown option ${argument}\n`);
      return 2;
    }
    if (expression !== null) {
      err.write("cronlet: one expression at a time\n");
      return 2;
    }
    expression = argument;
  }

  if (expression === null) {
    err.write(USAGE);
    return 2;
  }

  let schedule;
  try {
    schedule = parse(expression);
  } catch (error) {
    if (error instanceof CronError) {
      err.write(`cronlet: ${error.message}\n`);
      return 2;
    }
    throw error;
  }

  if (validate) {
    out.write(`expression  ${schedule.source}\n${describe(schedule)}\n`);
    return 0;
  }

  const runs = next(schedule, from, count);
  if (runs.length === 0) {
    err.write(
      `cronlet: "${schedule.source}" does not fire within eight years of the start point\n`,
    );
    return 1;
  }

  if (json) {
    out.write(JSON.stringify(runs.map((date) => date.toISOString()), null, 2) + "\n");
    return 0;
  }

  for (const date of runs) {
    const weekday = WEEKDAYS[date.getUTCDay()];
    out.write(`${date.toISOString().replace(".000Z", "Z")}  ${weekday}\n`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv);
}
