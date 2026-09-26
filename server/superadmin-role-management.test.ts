import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { users, vendors } from "../shared/schema";
import {
  approveVendorWithRole, assertRoleTargetMutable, lockVerifiedSuperadminAndTarget,
  RoleManagementError, updateManagedRoles,
} from "./superadmin-role-management";

test("role-changing workflows protect the owner and the acting superadmin", () => {
  assert.throws(() => assertRoleTargetMutable("actor", "actor", "someone@example.com"),
    (error: unknown) => error instanceof RoleManagementError && error.status === 403);
  assert.throws(() => assertRoleTargetMutable("actor", "owner", "FEMI.ELEGBELEYE@AFROLANDX.COM"),
    (error: unknown) => error instanceof RoleManagementError && error.status === 403);
  assert.doesNotThrow(() => assertRoleTargetMutable("actor", "other", "someone@example.com"));
});

test("vendor approval grants the role atomically only while the actor is a superadmin", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Role tests must not run against production.");
  const suffix = randomUUID();
  const ownerId = `role-vendor-owner-${suffix}`;
  const adminId = `role-vendor-admin-${suffix}`;
  const targetId = `role-vendor-target-${suffix}`;
  const ids = [ownerId, adminId, targetId];
  await db.insert(users).values([
    { id: ownerId, email: `role-vendor-owner-${suffix}@example.test`, emailVerified: true, roles: ["customer", "admin", "superadmin"] },
    { id: adminId, email: `role-vendor-admin-${suffix}@example.test`, emailVerified: true, roles: ["customer", "admin"] },
    { id: targetId, email: `role-vendor-target-${suffix}@example.test`, emailVerified: true, roles: ["customer"] },
  ]);
  let vendorId: number | undefined;
  try {
    const [vendor] = await db.insert(vendors).values({
      userId: targetId, businessName: "Role approval test", status: "pending", verificationStatus: "verified",
    }).returning();
    vendorId = vendor.id;
    await assert.rejects(approveVendorWithRole(adminId, vendorId),
      (error: unknown) => error instanceof RoleManagementError && error.status === 403);
    await updateManagedRoles(ownerId, adminId, { role: "superadmin", enabled: true });
    await updateManagedRoles(ownerId, adminId, { role: "superadmin", enabled: false });
    await assert.rejects(db.transaction(tx => lockVerifiedSuperadminAndTarget(tx, adminId, targetId)),
      (error: unknown) => error instanceof RoleManagementError && error.status === 403);
    await assert.rejects(approveVendorWithRole(adminId, vendorId),
      (error: unknown) => error instanceof RoleManagementError && error.status === 403);
    const [stillPending] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
    assert.equal(stillPending.status, "pending");
    const approved = await approveVendorWithRole(ownerId, vendorId);
    assert.equal(approved.status, "approved");
    const [target] = await db.select().from(users).where(eq(users.id, targetId));
    assert.ok((target.roles as string[]).includes("vendor"));
  } finally {
    if (vendorId !== undefined) await db.delete(vendors).where(eq(vendors.id, vendorId));
    await db.delete(users).where(inArray(users.id, ids));
  }
});

test("only verified superadmins can manage other users' roles", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Role tests must not run against production.");
  const suffix = randomUUID();
  const ownerId = `role-test-owner-${suffix}`;
  const adminId = `role-test-admin-${suffix}`;
  const targetId = `role-test-target-${suffix}`;
  const unverifiedId = `role-test-unverified-${suffix}`;
  const ids = [ownerId, adminId, targetId, unverifiedId];

  await db.insert(users).values([
    { id: ownerId, email: `role-owner-${suffix}@example.test`, emailVerified: true, roles: ["customer", "admin", "superadmin"] },
    { id: adminId, email: `role-admin-${suffix}@example.test`, emailVerified: true, roles: ["customer", "admin"] },
    { id: targetId, email: `role-target-${suffix}@example.test`, emailVerified: true, roles: ["customer"] },
    { id: unverifiedId, email: `role-unverified-${suffix}@example.test`, emailVerified: false, roles: ["customer"] },
  ]);

  try {
    await assert.rejects(updateManagedRoles(adminId, targetId, { role: "superadmin", enabled: true }),
      (error: unknown) => error instanceof RoleManagementError && error.status === 403);
    await assert.rejects(updateManagedRoles(adminId, targetId, { roles: ["customer", "admin"] }),
      (error: unknown) => error instanceof RoleManagementError && error.status === 403);
    await assert.rejects(updateManagedRoles(ownerId, ownerId, { role: "superadmin", enabled: false }),
      (error: unknown) => error instanceof RoleManagementError && error.status === 403);
    await assert.rejects(updateManagedRoles(ownerId, unverifiedId, { role: "superadmin", enabled: true }),
      (error: unknown) => error instanceof RoleManagementError && error.status === 409);

    assert.deepEqual(await updateManagedRoles(ownerId, targetId, { role: "superadmin", enabled: true }),
      ["customer", "superadmin", "admin"]);
    await assert.rejects(storage.deleteUser(ownerId, targetId),
      (error: unknown) => error instanceof Error && error.message === "PROTECTED_ACCOUNT");
    await assert.rejects(updateManagedRoles(ownerId, targetId, { role: "admin", enabled: false }),
      (error: unknown) => error instanceof RoleManagementError && error.status === 409);
    await assert.rejects(updateManagedRoles(ownerId, targetId, { roles: ["customer", "superadmin"] }),
      (error: unknown) => error instanceof RoleManagementError && error.status === 409);
    await assert.rejects(updateManagedRoles(adminId, targetId, { role: "admin", enabled: false }),
      (error: unknown) => error instanceof RoleManagementError && error.status === 403);

    assert.deepEqual(await updateManagedRoles(ownerId, targetId, { role: "superadmin", enabled: false }),
      ["customer", "admin"]);
    await assert.rejects(storage.deleteUser(targetId, adminId),
      (error: unknown) => error instanceof Error && error.message === "SUPERADMIN_REQUIRED");
    assert.deepEqual(await updateManagedRoles(ownerId, targetId, { role: "admin", enabled: false }),
      ["customer"]);
    const [vendor, admin] = await Promise.all([
      storage.addUserRole(targetId, "vendor"),
      updateManagedRoles(ownerId, targetId, { role: "admin", enabled: true }),
    ]);
    assert.equal(vendor, undefined);
    assert.ok(admin.includes("admin"));
    const [updated] = await db.select({ roles: users.roles }).from(users).where(inArray(users.id, [targetId]));
    assert.deepEqual(new Set(updated.roles as string[]), new Set(["customer", "vendor", "admin"]));
  } finally {
    await db.delete(users).where(inArray(users.id, ids));
  }
});