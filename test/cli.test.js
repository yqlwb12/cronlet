// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../src/cli.js", import.meta.url));

function run(...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

test("prints upcoming runs as text", () => {
  const result = run("*/15 * * * *", "-n", "2", "--from", "2026-01-01T00:00:00Z");
  assert.equal(result.code, 0);
  assert.match(result.out, /2026-01-01T00:15:00Z {2}Thu/);
  assert.match(result.out, /2026-01-01T00:30:00Z/);
});

test("--json emits an array of ISO strings", () => {
  const result = run("0 9 * * *", "-n", "2", "--json", "--from", "2026-05-01T00:00:00Z");
  assert.equal(result.code, 0);
  const payload = JSON.parse(result.out);
  assert.deepEqual(payload, ["2026-05-01T09:00:00.000Z", "2026-05-02T09:00:00.000Z"]);
});

test("--validate explains the parse", () => {
  const result = run("*/30 9 * * MON", "--validate");
  assert.equal(result.code, 0);
  assert.match(result.out, /expression {2}\*\/30 9 \* \* MON/);
  assert.match(result.out, /minute {6}0,30/);
});

test("a bad expression is a usage error", () => {
  const result = run("not a cron");
  assert.equal(result.code, 2);
  assert.match(result.err, /cronlet: .*(fields|not a number)/);
});

test("no expression prints usage and fails", () => {
  const result = run();
  assert.equal(result.code, 2);
  assert.match(result.err, /usage: cronlet/);
});

test("--help succeeds", () => {
  const result = run("--help");
  assert.equal(result.code, 0);
  assert.match(result.out, /cronlet "<expression>"/);
});

test("an impossible schedule exits 1", () => {
  const result = run("0 0 31 2 *", "--from", "2026-01-01T00:00:00Z");
  assert.equal(result.code, 1);
  assert.match(result.err, /does not fire/);
});

test("--count wants a number", () => {
  const result = run("* * * * *", "-n", "zero");
  assert.equal(result.code, 2);
  assert.match(result.err, /positive integer/);
});
