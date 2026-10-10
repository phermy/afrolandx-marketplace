import assert from "node:assert/strict";
import { test } from "node:test";
import { bootstrappedAdminRoles, isDesignatedOwnerEmail } from "./admin-role-bootstrap";

test("only the verified designated owner is seeded as superadmin on startup", () => {
  assert.deepEqual(bootstrappedAdminRoles(["customer"], false), ["customer", "admin"]);
  assert.deepEqual(bootstrappedAdminRoles(["customer"], true), ["customer", "admin", "superadmin"]);
  assert.deepEqual(bootstrappedAdminRoles(["customer", "admin", "superadmin"], true),
    ["customer", "admin", "superadmin"]);
  assert.deepEqual(bootstrappedAdminRoles(["customer", "admin", "superadmin"], false),
    ["customer", "admin", "superadmin"]);
  assert.equal(isDesignatedOwnerEmail("FEMI.ELEGBELEYE@AFROLANDX.COM"), true);
  assert.equal(isDesignatedOwnerEmail("someone@example.com"), false);
});