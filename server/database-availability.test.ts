import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db";

test("database shutdown on an idle connection does not crash the server or disclose credentials", t => {
  const output: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { output.push(args.join(" ")); });
  const error = Object.assign(new Error("fixture sensitive connection details"), { code: "57P01" });
  assert.doesNotThrow(() => pool.emit("error", error, { password: "fixture-private-password" }));
  assert.equal(output.length, 1);
  assert.match(output[0], /57P01/);
  assert.doesNotMatch(output[0], /fixture|password|sensitive/);
});

test("unexpected database error codes are not copied into logs", t => {
  const output: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { output.push(args.join(" ")); });
  const error = Object.assign(new Error("fixture private details"), { code: "fixture-private-code" });
  assert.doesNotThrow(() => pool.emit("error", error));
  assert.match(output[0], /\(unknown\)/);
  assert.doesNotMatch(output[0], /fixture|private/);
});
