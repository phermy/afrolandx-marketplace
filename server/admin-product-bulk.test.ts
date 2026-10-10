import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { categories, products, users, vendors } from "@shared/schema";
import { db } from "./db";
import {
  approveProduct, approveSelectedProducts, getPendingAdminProducts, getProductByClientImportKey,
  matchesClientImportPayload, parsePendingProductPagination, resolveClientImportRetry, validateProductIds,
} from "./admin-product-bulk";

test("bulk approval input accepts only bounded, unique positive safe integer IDs", () => {
  assert.equal(validateProductIds([1]), true);
  assert.equal(validateProductIds(Array.from({ length: 50 }, (_, index) => index + 1)), true);
  assert.equal(validateProductIds([]), false);
  assert.equal(validateProductIds(Array.from({ length: 51 }, (_, index) => index + 1)), false);
  assert.equal(validateProductIds([1, 1]), false);
  assert.equal(validateProductIds([0]), false);
  assert.equal(validateProductIds([-1]), false);
  assert.equal(validateProductIds([1.5]), false);
  assert.equal(validateProductIds([Number.MAX_SAFE_INTEGER + 1]), false);
  assert.equal(validateProductIds("1"), false);
  assert.deepEqual(parsePendingProductPagination(undefined, undefined), { limit: 50, offset: 0 });
  assert.deepEqual(parsePendingProductPagination("1", "0"), { limit: 1, offset: 0 });
  assert.equal(parsePendingProductPagination("0", "0"), undefined);
  assert.equal(parsePendingProductPagination("51", "0"), undefined);
  assert.equal(parsePendingProductPagination("1.5", "0"), undefined);
  assert.equal(parsePendingProductPagination("1", "-1"), undefined);
  assert.equal(parsePendingProductPagination("1", "9007199254740992"), undefined);
});

test("manual approval scopes to selected pending products and rechecks eligibility on write", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Product approval tests must not run against production.");
  const suffix = randomUUID();
  const userIds = [`bulk-product-owner-${suffix}`, `bulk-product-unverified-${suffix}`];
  const vendorIds: number[] = [];
  const productIds: number[] = [];
  let categoryId: number | undefined;

  await db.insert(users).values(userIds.map((id, index) => ({
    id,
    email: `bulk-product-${index}-${suffix}@example.test`,
    emailVerified: true,
    roles: ["customer"],
  })));

  try {
    const [category] = await db.insert(categories).values({
      name: `Bulk approval ${suffix}`,
      slug: `bulk-approval-${suffix}`,
    }).returning();
    categoryId = category.id;

    const insertedVendors = await db.insert(vendors).values([
      { userId: userIds[0], businessName: "Approved verified", status: "approved", verificationStatus: "verified" },
      { userId: userIds[1], businessName: "Unverified", status: "approved", verificationStatus: "pending" },
    ]).returning();
    vendorIds.push(...insertedVendors.map(vendor => vendor.id));

    const insertedProducts = await db.insert(products).values([
      {
        vendorId: vendorIds[0], categoryId, name: "Valid selected product", description: "Complete description",
        price: "10.00", stock: 2, images: ["https://example.test/product.jpg"], status: "pending",
      },
      {
        vendorId: vendorIds[0], categoryId, name: "Not selected product", shortDescription: "Pending item",
        description: "Must remain pending",
        price: "12.00", stock: 1, images: ["https://example.test/other.jpg"], status: "pending",
      },
      {
        vendorId: vendorIds[1], categoryId, name: "Unverified vendor product", description: "Description",
        price: "8.00", stock: 0, imageUrl: "https://example.test/unverified.jpg", status: "pending",
      },
      {
        vendorId: vendorIds[0], categoryId, name: "Product without image", shortDescription: "Missing image",
        description: "Description",
        price: "8.00", stock: 0, images: [], status: "pending",
      },
      {
        vendorId: vendorIds[0], categoryId, name: "Concurrent vendor edit", description: "Description",
        price: "8.00", stock: 0, images: ["https://example.test/concurrent.jpg"], status: "pending",
      },
    ]).returning();
    productIds.push(...insertedProducts.map(product => product.id));

    const pending = await getPendingAdminProducts(50, 0);
    const listed = pending.products.find(product => product.id === productIds[0]);
    assert.ok(listed);
    assert.deepEqual(Object.keys(listed.vendor).sort(), ["businessName", "id", "status", "verificationStatus"].sort());
    assert.equal(listed.status, "pending");
    assert.equal(pending.total >= pending.products.length, true);
    assert.equal(pending.hasMore, pending.total > pending.products.length);
    const firstPage = await getPendingAdminProducts(1, 0);
    assert.equal(firstPage.products.length <= 1, true);
    assert.equal(firstPage.hasMore, firstPage.total > firstPage.products.length);

    const result = await approveSelectedProducts([productIds[0], productIds[2], productIds[3], 2147483647]);
    assert.deepEqual(result.approved, [productIds[0]]);
    assert.deepEqual(result.skipped, [
      { id: productIds[2], reason: "vendor_not_verified" },
      { id: productIds[3], reason: "missing_image" },
      { id: 2147483647, reason: "not_found" },
    ]);

    const retry = await approveSelectedProducts([productIds[0]]);
    assert.deepEqual(retry.approved, []);
    assert.deepEqual(retry.skipped, [{ id: productIds[0], reason: "not_pending" }]);

    const concurrent = await Promise.all([
      approveSelectedProducts([productIds[1]]),
      approveSelectedProducts([productIds[1]]),
    ]);
    assert.equal(concurrent.reduce((count, outcome) => count + outcome.approved.length, 0), 1);
    const [untouched] = await db.select({ status: products.status }).from(products).where(eq(products.id, productIds[3]));
    assert.equal(untouched.status, "pending");

    let releaseVendorEdit!: () => void;
    let signalVendorEdit!: () => void;
    const vendorEditReady = new Promise<void>(resolve => { signalVendorEdit = resolve; });
    const waitToCommit = new Promise<void>(resolve => { releaseVendorEdit = resolve; });
    const vendorEdit = db.transaction(async tx => {
      await tx.update(vendors).set({ status: "pending" }).where(eq(vendors.id, vendorIds[0]));
      signalVendorEdit();
      await waitToCommit;
    });
    await vendorEditReady;
    const approvalDuringEdit = approveProduct(productIds[4]);
    releaseVendorEdit();
    await vendorEdit;
    assert.deepEqual(await approvalDuringEdit, { approved: false, reason: "vendor_not_approved" });

    const importKey = randomUUID();
    await db.update(products).set({ clientImportKey: importKey }).where(eq(products.id, productIds[3]));
    const [sameKeyProduct] = await db.select().from(products).where(eq(products.id, productIds[3]));
    assert.equal((await getProductByClientImportKey(importKey))?.id, productIds[3]);
    const retryPayload = {
      name: sameKeyProduct.name,
      shortDescription: sameKeyProduct.shortDescription ?? "",
      description: sameKeyProduct.description,
      price: sameKeyProduct.price,
      stock: sameKeyProduct.stock,
      categoryId: sameKeyProduct.categoryId,
    };
    assert.equal(matchesClientImportPayload(sameKeyProduct, {
      ...retryPayload,
    }), true);
    assert.equal(matchesClientImportPayload(sameKeyProduct, {
      ...retryPayload, status: "draft",
    }), false);
    assert.deepEqual(resolveClientImportRetry(sameKeyProduct, vendorIds[0], retryPayload), {
      kind: "same_vendor", product: sameKeyProduct,
    });
    assert.deepEqual(resolveClientImportRetry(sameKeyProduct, vendorIds[1], retryPayload), {
      kind: "different_vendor",
    });
    assert.deepEqual(resolveClientImportRetry(sameKeyProduct, vendorIds[0], {
      ...retryPayload, name: "different content",
    }), { kind: "payload_conflict" });
    await assert.rejects(db.insert(products).values({
      vendorId: vendorIds[1], categoryId, name: "Cross-vendor duplicate", description: "Description",
      price: "9.00", stock: 0, clientImportKey: importKey,
    }), (error: unknown) => (error as { code?: string }).code === "23505");
  } finally {
    if (productIds.length) await db.delete(products).where(inArray(products.id, productIds));
    if (vendorIds.length) await db.delete(vendors).where(inArray(vendors.id, vendorIds));
    if (categoryId !== undefined) await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(users).where(inArray(users.id, userIds));
  }
});