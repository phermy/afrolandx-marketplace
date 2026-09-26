import assert from "node:assert/strict";
import { test } from "node:test";
import { bootstrappedAdminRoles } from "./admin-role-bootstrap";

test("only a verified designated owner receives non-delegable superadmin access", () => {
  assert.deepEqual(bootstrappedAdminRoles(["customer"], false), ["customer", "admin"]);
  assert.deepEqual(bootstrappedAdminRoles(["customer"], true), ["customer", "admin", "superadmin"]);
  assert.deepEqual(bootstrappedAdminRoles(["customer", "admin", "superadmin"], true),
    ["customer", "admin", "superadmin"]);
});