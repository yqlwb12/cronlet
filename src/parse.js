// SPDX-License-Identifier: MIT
//
// Parsing a crontab line into five sets. The fiddly bits are names (JAN, MON),
// steps (every 15 minutes), and the POSIX rule that day-of-month and
// day-of-week are OR-ed when both are restricted -- which is the behaviour
// everyone forgets and nobody documents.

export class CronError extends Error {
  constructor(message) {
    super(message);
    this.name = "CronError";
  }
}

export const MACROS = Object.freeze({
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
});

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const FIELDS = [
  { key: "minutes", name: "minute", label: "minute", min: 0, max: 59, span: 60 },
  { key: "hours", name: "hour", label: "hour", min: 0, max: 23, span: 24 },
  { key: "daysOfMonth", name: "day-of-month", label: "day", min: 1, max: 31, span: 31 },
  { key: "months", name: "month", label: "month", min: 1, max: 12, span: 12, names: MONTHS, nameBase: 1 },
  { key: "daysOfWeek", name: "day-of-week", label: "weekday", min: 0, max: 7, span: 7, names: DAYS, nameBase: 0, sundayAlias: true },
];

function lookup(token, spec) {
  const upper = token.toUpperCase();
  if (spec.names) {
    const index = spec.names.indexOf(upper);
    if (index >= 0) {
      return index + spec.nameBase;
    }
  }
  if (!/^\d+$/.test(token)) {
    throw new CronError(`"${token}" is not a number${spec.names ? " or a known name" : ""}`);
  }
  const value = Number(token);
  if (value < spec.min || value > spec.max) {
    throw new CronError(`${spec.name} ${value} is outside ${spec.min}-${spec.max}`);
  }
  return value;
}

function parseField(text, spec) {
  if (text === "") {
    throw new CronError(`empty ${spec.name} field`);
  }
  const values = new Set();

  for (const part of text.split(",")) {
    if (part === "") {
      throw new CronError(`empty item in ${spec.name} field "${text}"`);
    }

    const slash = part.indexOf("/");
    let range = part;
    let step = 1;
    if (slash >= 0) {
      range = part.slice(0, slash);
      const digits = part.slice(slash + 1);
      if (!/^\d+$/.test(digits) || Number(digits) === 0) {
        throw new CronError(`step "${digits}" in ${spec.name} must be a positive integer`);
      }
      step = Number(digits);
    }

    let low;
    let high;
    if (range === "*" || range === "?") {
      low = spec.min;
      high = spec.max;
    } else if (range.includes("-")) {
      const [left, right] = range.split("-");
      if (right === undefined) {
        throw new CronError(`"${range}" is not a range`);
      }
      low = lookup(left, spec);
      high = lookup(right, spec);
      if (low > high) {
        throw new CronError(`range ${low}-${high} in ${spec.name} runs backwards`);
      }
    } else {
      low = lookup(range, spec);
      // "5/2" means "from 5 to the end, every 2".
      high = slash >= 0 ? spec.max : low;
    }

    for (let value = low; value <= high; value += step) {
      values.add(spec.sundayAlias && value === 7 ? 0 : value);
    }
  }

  if (values.size === 0) {
    throw new CronError(`${spec.name} field "${text}" selects nothing`);
  }
  return values;
}

export function parse(expression) {
  if (typeof expression !== "string") {
    throw new CronError("expression must be a string");
  }
  const trimmed = expression.trim();
  if (trimmed === "") {
    throw new CronError("expression is empty");
  }

  const expanded = MACROS[trimmed.toLowerCase()] ?? trimmed;
  const parts = expanded.split(/\s+/);
  if (parts.length !== 5) {
    throw new CronError(
      `expected 5 fields (minute hour day month weekday), got ${parts.length}`,
    );
  }

  const schedule = { source: trimmed };
  FIELDS.forEach((spec, index) => {
    schedule[spec.key] = parseField(parts[index], spec);
  });

  schedule.domRestricted = parts[2] !== "*" && parts[2] !== "?";
  schedule.dowRestricted = parts[4] !== "*" && parts[4] !== "?";
  return schedule;
}

export function describe(schedule) {
  return FIELDS.map((spec) => {
    const values = [...schedule[spec.key]].sort((a, b) => a - b);
    let shown;
    if (values.length === spec.span) {
      shown = "any";
    } else if (values.length > 10) {
      shown = `${values.slice(0, 3).join(",")},… (${values.length} values)`;
    } else {
      shown = values.join(",");
    }
    return `${spec.label.padEnd(12)}${shown}`;
  }).join("\n");
}
