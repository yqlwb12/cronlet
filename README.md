# cronlet

[![tests](https://github.com/yqlwb12/cronlet/actions/workflows/ci.yml/badge.svg)](https://github.com/yqlwb12/cronlet/actions/workflows/ci.yml)

> **Experimental project, for reference and learning only.**
> Published as-is, with no warranty of correctness or fitness for purpose.
> 本项目仅供参考与实验用途，不保证可靠性；生产使用前请自行充分测试。

**Parse a cron expression and find out when it will actually fire.** No dependencies, one command, and the POSIX day rule implemented the way the manual describes it rather than the way most libraries guess.

```console
$ cronlet "*/15 * * * *" -n 3 --from 2026-01-01T00:00:00Z
2026-01-01T00:15:00Z  Thu
2026-01-01T00:30:00Z  Thu
2026-01-01T00:45:00Z  Thu

$ cronlet "0 9 * * MON-FRI" --validate
expression  0 9 * * MON-FRI
minute      0
hour        9
day         any
month       any
weekday     1,2,3,4,5
```

## Why

Every cron library gets the same three things wrong, and each one shows up as a
ticket at 3am:

1. **`0 0 1 * MON` means "the first of the month, OR any Monday".** When both
   day-of-month and day-of-week are restricted, POSIX ORs them. Most parsers AND
   them, which silently halves the schedule.
2. **`7` is Sunday**, but only in the weekday field, and only in some dialects.
   Here `0` and `7` both mean Sunday, in names and in ranges.
3. **`5/2` means "every two, starting at five, to the end of the field"** — not
   "5 or 2", and not an error.

## Install

```console
$ npm install -g .        # gives you the cronlet command
$ cronlet "@daily" -n 3
```

Or run it from the checkout: `node src/cli.js "@daily"`.

## Usage

```console
$ cronlet "*/15 * * * *"              # next 5 runs from now
$ cronlet "0 0 1 * *" -n 12           # next year of month starts
$ cronlet "@weekly" --json            # one JSON array of ISO strings
$ cronlet "0 9 * * MON-FRI" --from 2026-01-02T10:00:00Z
$ cronlet "30 6 * * MON-FRI" --validate
```

| Option | Meaning |
| --- | --- |
| `-n, --count N` | how many runs to print (default 5) |
| `--from WHEN` | ISO 8601 start point, or `now` |
| `--json` | JSON array of ISO strings |
| `--validate` | print the parsed field sets |
| `-h, --help` | usage |

Exit codes: **0** fine, **1** the schedule never fires, **2** bad input.

## The library

```js
import { parse, next } from "cronlet";

const schedule = parse("0 9 * * MON-FRI");
next(schedule, new Date("2026-01-02T10:00:00Z"), 2);
// [ 2026-01-05T09:00:00.000Z, 2026-01-06T09:00:00.000Z ]
```

- `parse(expression)` → `{ minutes, hours, daysOfMonth, months, daysOfWeek,
  domRestricted, dowRestricted, source }`, all `Set`s of integers.
- `next(expressionOrSchedule, from, count)` → array of `Date`, strictly later
  than `from`, UTC.
- `nextOne(...)` → the first match, or `null`.
- `matchesDay(schedule, date)` → the OR rule, exposed so it can be tested.

Supported syntax: `*`, `?`, `a`, `a-b`, `a-b/s`, `*/s`, `a/s`, lists, `JAN`-`DEC`,
`SUN`-`SAT`, and the `@hourly` / `@daily` / `@weekly` / `@monthly` / `@yearly`
macros.

## Deliberately UTC

Everything is evaluated in UTC. That is not a missing feature, it is the only
defensible default: cron's local-time behaviour around a daylight-saving change
is where "the job ran twice" and "the job never ran" come from. Convert for
display, keep the schedule unambiguous.

The search horizon is **eight years**, which is what makes `0 0 29 2 *` find the
next leap day instead of reporting "never". Confirm it in the tests; it is one
line to change.

## Tests

```console
$ npm test        # node --test, 28 tests
```

The interesting ones are the OR rule (both directions), the leap day, the 64-bit
boundary of a `1,,2` list, and the ten rejected expressions that must produce a
message rather than a wrong answer.

## Known limits

- **UTC only.** Local-time schedules with DST semantics are out of scope.
- **No seconds field.** Five fields, like Vixie cron.
- **No `L`, `W` or `#`.** Quartz extensions are not implemented; `?` is accepted
  because it is common in copied expressions and means `*`.
- **A linear scan.** `next()` walks day by day and hour by hour rather than
  precomputing a bitmap; for leap-day schedules it can touch ~3,000 days. That is
  microseconds, but it is not a constant.

## Licence

MIT.
