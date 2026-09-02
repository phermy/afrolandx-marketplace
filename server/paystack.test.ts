import assert from "node:assert/strict";
import test from "node:test";
import { PaystackService } from "./paystack";

test("Paystack initialization sends the server total in NGN kobo", async () => {
  const originalFetch = globalThis.fetch;
  let request: RequestInit | undefined;
  try {
    globalThis.fetch = async (_input, init) => {
      request = init;
      return new Response(JSON.stringify({
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: "https://paystack.test/authorize",
          access_code: "access-code",
          reference: "order_42_abc",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const result = await new PaystackService("test-secret").initializeTransaction(
      "buyer@example.com",
      136000,
      "order_42_abc",
      { orderId: 42, userId: "buyer-1" },
      "https://shop.test/api/payment/callback",
      "NGN",
    );

    assert.equal(result.data.reference, "order_42_abc");
    assert.deepEqual(JSON.parse(String(request?.body)), {
      email: "buyer@example.com",
      amount: 13600000,
      reference: "order_42_abc",
      currency: "NGN",
      metadata: { orderId: 42, userId: "buyer-1" },
      callback_url: "https://shop.test/api/payment/callback",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Paystack refund sends the exact shipping adjustment in NGN kobo", async () => {
  const originalFetch = globalThis.fetch;
  let request: RequestInit | undefined;
  try {
    globalThis.fetch = async (_input, init) => {
      request = init;
      return new Response(JSON.stringify({
        status: true,
        message: "Refund has been queued for processing",
        data: { status: "pending" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const result = await new PaystackService("test-secret").createRefund(
      "order_42_abc",
      2500,
      "Shipping estimate adjustment for order #42",
    );

    assert.equal(result.status, true);
    assert.deepEqual(JSON.parse(String(request?.body)), {
      transaction: "order_42_abc",
      amount: 250000,
      currency: "NGN",
      merchant_note: "Shipping estimate adjustment for order #42",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Paystack refund recovery finds an existing exact NGN adjustment", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      status: true,
      data: [
        { amount: 100000, currency: "NGN", status: "processed" },
        { amount: 250000, currency: "NGN", status: "pending" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });

    const refund = await new PaystackService("test-secret").findRefund("order_42_abc", 2500);
    assert.equal(refund?.status, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
