import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  categories, notifications, occasionProfiles, orderItems, orders, products, shippingQuoteRequests,
  users, vendorLedgerEntries, vendors,
} from "../shared/schema";
import {
  deleteVerifiedTestVendor, isConfirmedTestPayment, isEligibleTestDeletionAccount, previewTestVendorDeletion,
  TestVendorDeletionError,
} from "./test-vendor-deletion";

test("the designated owner is never eligible for test-data deletion", () => {
  const inactiveVendor = { vendor_id: 10, vendor_status: "suspended", roles: ["customer", "vendor"] };
  assert.equal(isEligibleTestDeletionAccount({
    ...inactiveVendor, email: "FEMI.ELEGBELEYE@AFROLANDX.COM",
  }), false);
  assert.equal(isEligibleTestDeletionAccount({
    ...inactiveVendor, email: "ordinary-vendor@example.test",
  }), true);
});

test("only matching test-mode payments are eligible", () => {
  const order = {
    id: 1, buyerId: "buyer", reference: "test-order", amount: "1200.00",
    paymentStatus: "paid", shippingPaymentStatus: "included",
    shippingPaymentReference: null, shippingRefundStatus: null, shippingRefundAmount: null, quoteId: null,
  };
  const verification = {
    status: true,
    data: { domain: "test", reference: "test-order", currency: "NGN",
      amount: 120000, status: "success", paid_at: "2026-09-12" },
  };
  assert.equal(isConfirmedTestPayment(order, verification), true);
  assert.equal(isConfirmedTestPayment(order, { ...verification, data: { ...verification.data, domain: "live" } }), false);
  assert.equal(isConfirmedTestPayment(order, { ...verification, data: { ...verification.data, amount: 1 } }), false);
  assert.equal(isConfirmedTestPayment(order, { ...verification, data: { ...verification.data, reference: "other" } }), false);
  assert.equal(isConfirmedTestPayment(order, { ...verification, data: { ...verification.data, status: "pending" } }), false);
});

test("admin test-data flow rejects live payments and atomically removes verified fixtures", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Fixture test must never run against production.");
  const targetId = randomUUID();
  const buyerId = randomUUID();
  const email = `delete-test-${randomUUID()}@example.invalid`;
  const reference = `test_delete_${randomUUID().replaceAll("-", "")}`;
  let vendorId: number | undefined;
  let categoryId: number | undefined;
  let productId: number | undefined;
  let orderId: number | undefined;
  let quoteId: number | undefined;
  try {
    await db.insert(users).values([{ id: targetId, email, roles: ["vendor"] }, { id: buyerId }]);
    [{ id: vendorId }] = await db.insert(vendors).values({ userId: targetId, businessName: "Disposable test vendor", status: "rejected" }).returning({ id: vendors.id });
    [{ id: categoryId }] = await db.insert(categories).values({ name: "Disposable test category", slug: `purge-${randomUUID()}` }).returning({ id: categories.id });
    [{ id: productId }] = await db.insert(products).values({
      vendorId, categoryId, name: "Disposable test product", description: "Test only", price: "1200.00", stock: 1, status: "rejected",
    }).returning({ id: products.id });
    [{ id: quoteId }] = await db.insert(shippingQuoteRequests).values({
      userId: buyerId, carrier: "Test carrier", shippingAddress: {},
      cartSnapshot: [], cartFingerprint: "test-fingerprint",
    }).returning({ id: shippingQuoteRequests.id });
    [{ id: orderId }] = await db.insert(orders).values({
      userId: buyerId, totalAmount: "1200.00", shippingAddress: {},
      paymentStatus: "paid", paymentReference: reference,
      shippingQuoteRequestId: quoteId,
    }).returning({ id: orders.id });
    await db.insert(orderItems).values({ orderId, productId, quantity: 1, priceAtTime: "1200.00" });
    await db.insert(vendorLedgerEntries).values({
      vendorId, orderId, entryType: "sale", grossAmount: "1200.00",
      commissionAmount: "96.00", netAmount: "1104.00",
    });
    await db.insert(notifications).values({ userId: buyerId, orderId, type: "order_placed", title: "Test", message: "Test only" });

    await assert.rejects(storage.createEventCollection({
      name: "Should not exist", eventType: "test", productIds: [productId],
    }));
    await assert.rejects(storage.createShippingQuoteRequest({
      userId: buyerId, carrier: "Test carrier", shippingAddress: {},
      cartSnapshot: [{ productId }], cartFingerprint: "should-not-exist",
    }));

    const verification = async (ref: string) => ({
      status: true,
      data: { domain: "test", reference: ref, currency: "NGN",
        amount: 120000, status: "success", paid_at: "2026-09-12" },
    });
    const paymentReader = { verify: verification, refunds: async () => [] };
    await db.update(orders).set({ shippingRefundStatus: "pending" }).where(eq(orders.id, orderId));
    await assert.rejects(previewTestVendorDeletion(targetId, paymentReader));
    await db.update(orders).set({ shippingRefundStatus: null }).where(eq(orders.id, orderId));
    await assert.rejects(previewTestVendorDeletion(targetId, {
      ...paymentReader, refunds: async () => [{ status: "pending" }],
    }));
    const preview = await previewTestVendorDeletion(targetId, paymentReader);
    assert.deepEqual([preview.products, preview.orders, preview.ledgerEntries, preview.quotes, preview.notifications], [1, 1, 1, 1, 1]);
    await assert.rejects(
      deleteVerifiedTestVendor(targetId, email, preview.fingerprint, {
        ...paymentReader,
        verify: async ref => ({ ...(await verification(ref)), data: { ...(await verification(ref)).data, domain: "live" } }),
      }),
      (error: unknown) => error instanceof TestVendorDeletionError,
    );
    assert.ok((await db.select().from(users).where(eq(users.id, targetId))).length);
    // An unanticipated account dependency must roll back all earlier deletes.
    await db.insert(occasionProfiles).values({ userId: targetId, eventType: "test" });
    await assert.rejects(deleteVerifiedTestVendor(targetId, email, preview.fingerprint, paymentReader));
    assert.equal((await db.select().from(orders).where(eq(orders.id, orderId))).length, 1);
    assert.equal((await db.select().from(vendorLedgerEntries).where(eq(vendorLedgerEntries.orderId, orderId))).length, 1);
    assert.equal((await db.select().from(shippingQuoteRequests).where(eq(shippingQuoteRequests.id, quoteId))).length, 1);
    await db.delete(occasionProfiles).where(eq(occasionProfiles.userId, targetId));
    await deleteVerifiedTestVendor(targetId, email, preview.fingerprint, paymentReader);
    assert.equal((await db.select().from(users).where(eq(users.id, targetId))).length, 0);
    assert.equal((await db.select().from(orders).where(eq(orders.id, orderId))).length, 0);
    assert.equal((await db.select().from(shippingQuoteRequests).where(eq(shippingQuoteRequests.id, quoteId))).length, 0);
    assert.equal((await db.select().from(notifications).where(eq(notifications.orderId, orderId))).length, 0);
    assert.equal((await db.select().from(users).where(eq(users.id, buyerId))).length, 1);
  } finally {
    await db.delete(occasionProfiles).where(eq(occasionProfiles.userId, targetId));
    if (orderId !== undefined) {
      await db.delete(notifications).where(eq(notifications.orderId, orderId));
      await db.delete(vendorLedgerEntries).where(eq(vendorLedgerEntries.orderId, orderId));
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await db.delete(orders).where(eq(orders.id, orderId));
    }
    if (quoteId !== undefined) await db.delete(shippingQuoteRequests).where(eq(shippingQuoteRequests.id, quoteId));
    if (productId !== undefined) await db.delete(products).where(eq(products.id, productId));
    if (vendorId !== undefined) await db.delete(vendors).where(eq(vendors.id, vendorId));
    if (categoryId !== undefined) await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(users).where(inArray(users.id, [targetId, buyerId]));
  }
});