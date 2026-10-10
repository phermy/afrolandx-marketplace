import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { RoleManagementError, updateManagedRoles } from "./superadmin-role-management";
import { categories, orders, products, sessions, users, vendors } from "../shared/schema";

test("a verified superadmin closes customer, vendor and admin accounts without deleting business history", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Account closure tests must not run against production.");
  const suffix = randomUUID();
  const ids = ["actor", "ordinary-admin", "customer", "vendor", "admin", "superadmin"].map(role => `close-${role}-${suffix}`);
  const [actorId, ordinaryAdminId, customerId, vendorUserId, adminId, protectedId] = ids;
  const email = (role: string) => `close-${role}-${suffix}@example.test`;
  let vendorId: number | undefined;
  let productId: number | undefined;
  let categoryId: number | undefined;
  let orderId: number | undefined;
  const sessionId = `close-session-${suffix}`;
  try {
    await db.insert(users).values([
      { id: actorId, email: email("actor"), emailVerified: true, roles: ["admin", "superadmin"] },
      { id: ordinaryAdminId, email: email("ordinary-admin"), emailVerified: true, roles: ["admin"] },
      { id: customerId, email: email("customer"), emailVerified: true, password: "hashed", roles: ["customer"], activeSessionId: sessionId },
      { id: vendorUserId, email: email("vendor"), emailVerified: true, roles: ["vendor"] },
      { id: adminId, email: email("admin"), emailVerified: true, roles: ["admin"] },
      { id: protectedId, email: email("superadmin"), emailVerified: true, roles: ["admin", "superadmin"] },
    ]);
    const [vendor] = await db.insert(vendors).values({
      userId: vendorUserId, businessName: "Closure test vendor", status: "approved", verificationStatus: "verified",
    }).returning({ id: vendors.id });
    vendorId = vendor.id;
    const [category] = await db.insert(categories).values({
      name: "Closure test", slug: `closure-${suffix}`,
    }).returning({ id: categories.id });
    categoryId = category.id;
    const [product] = await db.insert(products).values({
      vendorId, categoryId, name: "Closure test item", description: "Test", price: "100.00", status: "approved", featured: true,
    }).returning({ id: products.id });
    productId = product.id;
    const [order] = await db.insert(orders).values({
      userId: customerId, totalAmount: "100.00", shippingAddress: { name: "Test" },
    }).returning({ id: orders.id });
    orderId = order.id;
    await db.insert(sessions).values({
      sid: sessionId, sess: { passport: { user: customerId } }, expire: new Date(Date.now() + 60_000),
    });

    await assert.rejects(storage.closeUser(customerId, ordinaryAdminId, email("customer")), { message: "SUPERADMIN_REQUIRED" });
    await assert.rejects(storage.closeUser(actorId, actorId, email("actor")), { message: "PROTECTED_ACCOUNT" });
    await assert.rejects(storage.closeUser(protectedId, actorId, email("superadmin")), { message: "PROTECTED_ACCOUNT" });
    await assert.rejects(storage.closeUser(customerId, actorId, "wrong"), { message: "ACCOUNT_CONFIRMATION_REQUIRED" });
    assert.equal((await storage.getUser(customerId))?.closedAt, null);

    assert.equal(await storage.closeUser(customerId, actorId, email("customer")), true);
    const customer = await storage.getUser(customerId);
    assert.ok(customer?.closedAt);
    assert.equal(customer?.password, null);
    assert.equal(customer?.activeSessionId, null);
    assert.equal((await db.select().from(sessions).where(eq(sessions.sid, sessionId))).length, 0);
    assert.equal((await db.select().from(orders).where(eq(orders.id, orderId))).length, 1);
    await assert.rejects(storage.updateActiveSession(customerId, sessionId), { message: "ACCOUNT_CLOSED" });
    await assert.rejects(updateManagedRoles(actorId, customerId, { role: "admin", enabled: true }),
      (error: unknown) => error instanceof RoleManagementError && error.status === 409);
    await assert.rejects(storage.closeUser(customerId, actorId, email("customer")), { message: "ACCOUNT_ALREADY_CLOSED" });

    assert.equal(await storage.closeUser(vendorUserId, actorId, email("vendor")), true);
    assert.equal((await db.select().from(vendors).where(eq(vendors.id, vendorId)))[0].status, "suspended");
    const savedProduct = (await db.select().from(products).where(eq(products.id, productId)))[0];
    assert.equal(savedProduct.status, "suspended");
    assert.equal(savedProduct.featured, false);
    assert.equal(await storage.closeUser(adminId, actorId, email("admin")), true);
    assert.ok((await storage.getUser(adminId))?.closedAt);
    await assert.rejects(storage.deleteUser(adminId, actorId), { message: "PROTECTED_ACCOUNT" });
  } finally {
    await db.delete(sessions).where(eq(sessions.sid, sessionId));
    if (orderId) await db.delete(orders).where(eq(orders.id, orderId));
    if (productId) await db.delete(products).where(eq(products.id, productId));
    if (vendorId) await db.delete(vendors).where(eq(vendors.id, vendorId));
    if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(users).where(inArray(users.id, ids));
  }
});