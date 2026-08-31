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
