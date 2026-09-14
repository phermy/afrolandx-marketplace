import assert from "node:assert/strict";
import test from "node:test";
import { createVerifiedOrderCompleter } from "./order-processing";

test("duplicate callbacks and webhooks award points, clear carts, and decrement stock once", async () => {
  let pending = true;
  let markPaidCalls = 0;
  let stockReserved = false;
  let clearCartCalls = 0;
  const stockCalls: Array<{ id: number; quantity: number }> = [];
  const pointsCalls: unknown[][] = [];
  const notifications: unknown[] = [];
  const statusUpdates: string[] = [];

  const storage = {
    async markOrderPaid() {
      markPaidCalls++;
      if (!pending) return false;
      pending = false;
      return true;
    },
    async updateOrderStatus(_id: number, status: string) {
      if (!statusUpdates.includes(status)) statusUpdates.push(status);
    },
    async getOrder() {
      return { paymentStatus: pending ? "pending" : "paid", paymentReference: "order_42_abc" };
    },
    async clearCart() {
      clearCartCalls++;
    },
    async getOrderItemsWithProducts() {
      return [
        { productId: 10, quantity: 2 },
        { productId: 11, quantity: 1 },
      ];
    },
    async reserveOrderStock() {
      if (stockReserved) return true;
      stockReserved = true;
      stockCalls.push({ id: 10, quantity: 2 }, { id: 11, quantity: 1 });
      return true;
    },
    async addLoyaltyPoints(...args: unknown[]) {
      pointsCalls.push(args);
    },
    async getProduct(id: number) {
      return { vendorId: id === 10 ? 100 : 101 };
    },
    async getVendor(id: number) {
      return { userId: `vendor-${id}`, status: 'approved' };
    },
    async getAdminUsers() {
      return [{ id: "admin-1" }];
    },
    async createNotification(notification: unknown) {
      notifications.push(notification);
    },
  };

  const complete = createVerifiedOrderCompleter(storage);
  const order = { id: 42, userId: "buyer-1", totalAmount: "136000.00", shippingPaymentStatus: "included" };
  const results = await Promise.all([
    complete(order, "order_42_abc"),
    complete(order, "order_42_abc"),
  ]);

  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(markPaidCalls, 2);
  assert.equal(clearCartCalls, 1);
  assert.deepEqual(stockCalls, [
    { id: 10, quantity: 2 },
    { id: 11, quantity: 1 },
  ]);
  assert.equal(pointsCalls.length, 1);
  assert.deepEqual(pointsCalls[0], [
    "buyer-1", 136, "purchase", "Points for Order #42", 42, "order",
  ]);
  assert.equal(notifications.length, 3);
  assert.deepEqual(statusUpdates, ["processing"]);
});
