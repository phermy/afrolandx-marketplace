import assert from "node:assert/strict";
import test from "node:test";
import { PaystackRequestError, PaystackService } from "./paystack";

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

test("Paystack network failures are marked ambiguous to prevent unsafe retries", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error("socket timed out");
    };
    await assert.rejects(
      () => new PaystackService("test-secret").initiateTransfer(
        92000,
        "RCP_test",
        "settlement_42_abc",
        "Vendor settlement",
      ),
      (error: unknown) => error instanceof PaystackRequestError && error.ambiguous,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Paystack server errors are marked ambiguous to prevent duplicate money movement", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(
      JSON.stringify({ status: false, message: "Gateway unavailable" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
    await assert.rejects(
      () => new PaystackService("test-secret").createRefund(
        "order_42_abc",
        2500,
        "AfrolandX refund_42_123_abcde",
      ),
      (error: unknown) => error instanceof PaystackRequestError && error.ambiguous,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Paystack transfer verification uses the persisted transfer reference", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  try {
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        status: true,
        data: { status: "success", reference: "settlement_42_abc" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const transfer = await new PaystackService("test-secret").verifyTransfer("settlement_42_abc");
    assert.equal(transfer.status, "success");
    assert.match(requestedUrl, /transfer\/verify\/settlement_42_abc$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Paystack refund recovery can match the AfrolandX adjustment reference", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      status: true,
      data: [
        { amount: 250000, currency: "NGN", status: "processed", merchant_note: "Another refund" },
        { amount: 250000, currency: "NGN", status: "pending", merchant_note: "AfrolandX refund_42_123_abcde: approved" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
    const refund = await new PaystackService("test-secret").findRefund(
      "order_42_abc",
      2500,
      "refund_42_123_abcde",
    );
    assert.equal(refund?.status, "pending");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Paystack transfer OTP finalization submits the transfer code and six-digit OTP", async () => {
  const originalFetch = globalThis.fetch;
  let request: RequestInit | undefined;
  try {
    globalThis.fetch = async (_input, init) => {
      request = init;
      return new Response(JSON.stringify({
        status: true,
        data: { status: "success", transfer_code: "TRF_test" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const transfer = await new PaystackService("test-secret").finalizeTransfer("TRF_test", "123456");
    assert.equal(transfer.status, "success");
    assert.deepEqual(JSON.parse(String(request?.body)), {
      transfer_code: "TRF_test",
      otp: "123456",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
