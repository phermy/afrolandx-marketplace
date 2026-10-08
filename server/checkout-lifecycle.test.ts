import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkoutTotal, unpaidCheckoutExpired, UNPAID_CHECKOUT_LIFETIME_MS } from "../shared/checkout-lifecycle";
import { createVerifiedOrderCompleter } from "./order-processing";
import { mock } from "node:test";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { notifyOrderPayment } from "./payment-emails";
import { storage } from "./storage";
import { db } from "./db";
import { orders } from "../shared/schema";
import { closeUnpaidCheckout, unpaidCheckoutCanClose } from "./unpaid-checkouts";

test("checkout total uses integer kobo consistently and rejects invalid amounts", () => {
  assert.equal(checkoutTotal(0.1, 0.2), 0.3);
  assert.equal(checkoutTotal(8500, 1), 8501);
  for (const value of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => checkoutTotal(value, 1));
  }
});

test("unpaid expiry has a 24-hour boundary and never expires paid or invalid-dated records", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const expiry = createdAt.getTime() + UNPAID_CHECKOUT_LIFETIME_MS;
  assert.equal(unpaidCheckoutExpired({ paymentStatus: "pending", createdAt }, expiry - 1), false);
  assert.equal(unpaidCheckoutExpired({ paymentStatus: "pending", createdAt }, expiry), true);
  assert.equal(unpaidCheckoutExpired({ paymentStatus: "paid", createdAt }, expiry), false);
  assert.equal(unpaidCheckoutExpired({ paymentStatus: "pending", createdAt: "invalid" }, expiry), false);
});

test("closure checks Paystack first and retains successful, ambiguous or unverifiable payments", async () => {
  const order = { id: 1, userId: "buyer", totalAmount: "8501", paymentReference: "fixture-ref" };
  let confirmed = 0;
  const confirm = async () => { confirmed++; };
  const response = (status: string, amount = 850100) => async () => ({
    status: true, data: { status, reference: "fixture-ref", amount, currency: "NGN", metadata: { orderId: 1, userId: "buyer" } },
  });
  assert.equal(await unpaidCheckoutCanClose(order, confirm, response("success")), false);
  assert.equal(confirmed, 1);
  assert.equal(await unpaidCheckoutCanClose(order, confirm, response("success", 1)), false);
  assert.equal(confirmed, 1);
  for (const status of ["pending", "processing", "ongoing", "queued"]) {
    assert.equal(await unpaidCheckoutCanClose(order, confirm, response(status)), false);
  }
  for (const status of ["abandoned", "failed"]) {
    assert.equal(await unpaidCheckoutCanClose(order, confirm, response(status)), true);
  }
  assert.equal(await unpaidCheckoutCanClose(order, confirm, async () => { throw new Error("Fixture outage"); }), false);
});

test("late paid checkouts require review without granting inventory, earnings, loyalty or fulfillment", async () => {
  let notices = 0, emails = 0;
  const forbidden = async () => { throw new Error("Must not fulfill a closed checkout"); };
  const store = {
    async markOrderPaid() { return true; },
    async getOrder() { return { paymentStatus: "paid", paymentReference: "late-ref", orderStatus: "payment_review" }; },
    updateOrderStatus: forbidden, reserveOrderStock: forbidden, clearCart: forbidden,
    getOrderItemsWithProducts: forbidden, addLoyaltyPoints: forbidden,
    getProduct: forbidden, getVendor: forbidden,
    async getAdminUsers() { return [{ id: "admin" }]; },
    async createNotification() { notices++; },
  };
  const complete = createVerifiedOrderCompleter(store, forbidden, forbidden, async () => { emails++; });
  assert.equal(await complete({ id: 1, userId: "buyer" }, "late-ref"), false);
  assert.equal(notices, 1);
  assert.equal(emails, 1);
});

test("shared request limits protect every public credential and code endpoint", () => {
  const source = readFileSync("server/auth.ts", "utf8");
  for (const path of ["register", "login", "send-login-otp", "login-with-otp", "verify-email", "resend-verification", "forgot-password", "reset-password"]) {
    assert.ok(source.includes(`app.post("/api/${path}", requestRateLimit(`), path);
  }
});

test("paid order mail separates vendor totals and continues when customer delivery fails", async t => {
  t.after(() => mock.restoreAll());
  const messages: any[] = [];
  mock.method(ReplitConnectors.prototype, "proxy", async (_provider: string, _path: string, options: any) => {
    const message = JSON.parse(options.body);
    messages.push(message);
    return new Response(JSON.stringify({ id: "fixture-mail" }), {
      status: (Array.isArray(message.to) ? message.to[0] : message.to) === "buyer@example.test" ? 503 : 200,
    });
  });
  mock.method(storage, "getOrder", async () => ({
    id: 44, userId: "buyer", paymentStatus: "paid", paymentReference: "fixture-ref", totalAmount: "3801",
  } as any));
  mock.method(storage, "getUser", async (id: string) => ({ id, email: `${id}@example.test` } as any));
  mock.method(storage, "getOrderItemsWithProducts", async () => [
    { productId: 1, priceAtTime: "1500", quantity: 1 },
    { productId: 2, priceAtTime: "2000", quantity: 1 },
    { productId: 3, priceAtTime: "300", quantity: 1 },
  ] as any);
  mock.method(storage, "getProduct", async (id: number) => ({ vendorId: id === 2 ? 2 : 1 } as any));
  mock.method(storage, "getVendor", async (id: number) => ({ userId: `vendor-${id}` } as any));
  await notifyOrderPayment(44);
  assert.equal(messages.length, 3);
  assert.ok(messages[1].html.includes("1,800.00"));
  assert.ok(!messages[1].html.includes("2,000.00"));
  assert.ok(messages[2].html.includes("2,000.00"));
  assert.ok(!messages[2].html.includes("1,800.00"));
  assert.deepEqual(messages.map(item => Array.isArray(item.to) ? item.to[0] : item.to), ["buyer@example.test", "vendor-1@example.test", "vendor-2@example.test"]);
});

test("PostgreSQL closure guards ownership and confirmed money, retaining late paid records for review", async t => {
  // Only a connection-local temporary table is changed. No existing order,
  // customer, vendor, product, stock or payment-provider state is modified.
  await db.transaction(async tx => {
    const { sql } = await import("drizzle-orm");
    await tx.execute(sql`CREATE TEMP TABLE orders (LIKE public.orders INCLUDING DEFAULTS) ON COMMIT DROP`);
    const created = new Date(Date.now() - UNPAID_CHECKOUT_LIFETIME_MS - 1);
    await tx.insert(orders).values([{
      id: 910001, userId: "rollback-only", totalAmount: "8501", shippingAddress: {},
      paymentStatus: "pending", orderStatus: "pending", paymentReference: "late-ref", createdAt: created,
    }, {
      id: 910002, userId: "rollback-only", totalAmount: "8501", shippingAddress: {},
      paymentStatus: "pending", orderStatus: "pending", paymentReference: "paid-ref", createdAt: created,
    }]);
    mock.method(db, "update", ((table: any) => tx.update(table)) as any);
    t.after(() => mock.restoreAll());
    try {
      assert.equal(await closeUnpaidCheckout(910001, "wrong-owner", "cancelled"), undefined);
      assert.equal(await storage.markOrderPaid(910001, "wrong-reference"), false);
      assert.ok(await closeUnpaidCheckout(910001, "rollback-only", "expired", new Date()));
      assert.equal(await storage.markOrderPaid(910001, "late-ref"), true);
      assert.equal(await storage.markOrderPaid(910002, "paid-ref"), true);
      assert.equal(await closeUnpaidCheckout(910002, "rollback-only", "cancelled"), undefined);
      const rows = await tx.select().from(orders);
      assert.equal(rows.find(item => item.id === 910001)?.orderStatus, "payment_review");
      assert.equal(rows.find(item => item.id === 910001)?.paymentStatus, "paid");
      assert.equal(rows.find(item => item.id === 910002)?.orderStatus, "pending");
    } finally { mock.restoreAll(); }
  });
});
