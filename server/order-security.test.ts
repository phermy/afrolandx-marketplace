import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  calculateCheckoutTotal,
  calculateCheckoutSubtotal,
  calculateEstimatedShippingAmount,
  CheckoutValidationError,
  createCartFingerprint,
  findOwnedCartItem,
  isValidPaystackWebhookSignature,
  paymentVerificationError,
  recommendShippingCarriers,
  shippingPaymentVerificationError,
  getShippingQuote,
} from "./order-security";

const cart = [
  {
    id: 7,
    userId: "buyer-1",
    productId: 12,
    quantity: 2,
    selectedSize: "M",
    product: {
      name: "Aso Oke Set",
      price: "60500.00",
      stock: 5,
      sizes: ["S", "M", "L"],
      status: "approved",
    },
  },
];

test("cart item ownership never crosses users", () => {
  assert.equal(findOwnedCartItem(cart, "buyer-1", 7)?.id, 7);
  assert.equal(findOwnedCartItem(cart, "another-buyer", 7), undefined);
});

test("checkout computes the server-side NGN subtotal", () => {
  assert.equal(calculateCheckoutSubtotal(cart), 121000);
});

test("test shipping charges exactly one naira as a server-priced deposit, not a dispatch-ready carrier rate", () => {
  assert.equal(calculateEstimatedShippingAmount(121000, "test shipping"), 1);
  assert.equal(calculateEstimatedShippingAmount(100, "Test shipping"), 1);
  assert.equal(getShippingQuote("test shipping")?.quoteRequired, true);
  assert.equal(getShippingQuote("test shipping")?.price, null);
  assert.throws(() => calculateCheckoutTotal(cart, "test shipping"), CheckoutValidationError);
  assert.equal(recommendShippingCarriers({ country: "Nigeria" }).ranked.some(option => option.carrier === "Test shipping"), false);
});

test("checkout rejects insufficient stock and invalid sizes", () => {
  assert.throws(
    () => calculateCheckoutSubtotal([{ ...cart[0], quantity: 6 }]),
    new CheckoutValidationError("Aso Oke Set does not have enough stock"),
  );
  assert.throws(
    () => calculateCheckoutSubtotal([{ ...cart[0], selectedSize: "XXL" }]),
    new CheckoutValidationError("Select a valid size for Aso Oke Set"),
  );
});

test("checkout rejects invalid shipping methods and unavailable products", () => {
  assert.throws(
    () => calculateCheckoutTotal(cart, "local-pickup"),
    new CheckoutValidationError("Invalid shipping method"),
  );
  assert.throws(
    () => calculateCheckoutSubtotal([{
      ...cart[0],
      product: { ...cart[0].product, status: "pending" },
    }]),
    new CheckoutValidationError("A cart item is no longer available"),
  );
});

test("every shipping company requires a confirmed quote before payment", () => {
  for (const carrier of ["UPS", "FedEx", "DHL", "CargoNaija", "Terminal Africa", "Haulam", "African Import Export Solutions", "Hezelinks"]) {
    assert.throws(
      () => calculateCheckoutTotal(cart, carrier),
      new CheckoutValidationError(`${carrier} shipping requires a confirmed shipping quote before payment`),
    );
  }
});

test("testing checkout generates a server-controlled NGN shipping estimate for every carrier", () => {
  const subtotal = calculateCheckoutSubtotal(cart);
  for (const carrier of ["UPS", "FedEx", "DHL", "CargoNaija", "Terminal Africa", "Haulam", "African Import Export Solutions", "Hezelinks"]) {
    const estimate = calculateEstimatedShippingAmount(subtotal, carrier);
    assert.ok(estimate >= 7500 && estimate <= 50000);
    assert.equal(estimate % 500, 0);
  }
  assert.throws(() => calculateEstimatedShippingAmount(subtotal, "Unknown"), new CheckoutValidationError("Invalid shipping method"));
});

test("shipping recommendations are deterministic, explainable, and never claim live rates", () => {
  const first = recommendShippingCarriers({ country: "Nigeria", totalWeight: 18, subtotal: 300000 });
  const second = recommendShippingCarriers({ country: "Nigeria", totalWeight: 18, subtotal: 300000 });

  assert.deepEqual(first, second);
  assert.equal(first.liveRates, false);
  assert.equal(first.basis, "static_catalog_rules");
  assert.equal(first.ranked.length, 8);
  assert.ok(first.ranked[0].reasons.length > 0);
  assert.ok(first.ranked.every((item, index) => index === 0 || first.ranked[index - 1].score >= item.score));
});

test("confirmed quote cart fingerprints are stable and change with cart contents", () => {
  const fingerprint = createCartFingerprint(cart);
  assert.equal(fingerprint, createCartFingerprint([...cart]));
  assert.notEqual(fingerprint, createCartFingerprint([{ ...cart[0], quantity: 1 }]));
  assert.notEqual(fingerprint, createCartFingerprint([{ ...cart[0], selectedSize: "L" }]));
  assert.notEqual(
    fingerprint,
    createCartFingerprint([{ ...cart[0], product: { ...cart[0].product, price: "61500.00" } }]),
  );
});

const order = {
  id: 42,
  userId: "buyer-1",
  totalAmount: "136000.00",
  paymentReference: "order_42_abc",
};

function verification(overrides: Record<string, unknown> = {}) {
  return {
    status: true,
    data: {
      status: "success",
      reference: "order_42_abc",
      amount: 13600000,
      currency: "NGN",
      metadata: { orderId: 42, userId: "buyer-1" },
      ...overrides,
    },
  };
}

test("payment verification accepts an exact reference, amount, currency, and metadata", () => {
  assert.equal(paymentVerificationError(order, verification(), "order_42_abc"), null);
});

test("payment verification rejects mismatched amount, currency, metadata, and reference", () => {
  assert.equal(paymentVerificationError(order, verification({ amount: 13500000 }), "order_42_abc"), "Payment amount mismatch");
  assert.equal(paymentVerificationError(order, verification({ currency: "USD" }), "order_42_abc"), "Payment currency mismatch");
  assert.equal(paymentVerificationError(order, verification({ metadata: { orderId: 99, userId: "buyer-1" } }), "order_42_abc"), "Payment metadata mismatch");
  assert.equal(paymentVerificationError(order, verification({ reference: "other-reference" }), "order_42_abc"), "Payment reference mismatch");
  assert.equal(paymentVerificationError(order, verification(), "other-reference"), "Payment reference mismatch");
  assert.equal(paymentVerificationError(order, verification({ metadata: { orderId: 42, userId: "another-buyer" } }), "order_42_abc"), "Payment metadata mismatch");
});

test("shipping payment verification requires the exact quote amount and shipping metadata", () => {
  const shippingOrder = {
    id: 42,
    userId: "buyer-1",
    shippingAmount: "15000.00",
    shippingPaymentReference: "shipping_42_abc",
  };
  const shippingVerification = (overrides: Record<string, unknown> = {}) => ({
    status: true,
    data: {
      status: "success",
      reference: "shipping_42_abc",
      amount: 1500000,
      currency: "NGN",
      metadata: { orderId: 42, userId: "buyer-1", paymentType: "shipping" },
      ...overrides,
    },
  });

  assert.equal(shippingPaymentVerificationError(shippingOrder, shippingVerification(), "shipping_42_abc"), null);
  assert.equal(shippingPaymentVerificationError(shippingOrder, shippingVerification({ amount: 1490000 }), "shipping_42_abc"), "Shipping payment amount mismatch");
  assert.equal(shippingPaymentVerificationError(shippingOrder, shippingVerification({ metadata: { orderId: 42, userId: "buyer-1" } }), "shipping_42_abc"), "Shipping payment metadata mismatch");
});

test("Paystack webhook signatures require the exact raw body and secret", () => {
  const rawBody = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "order_42_abc" } }));
  const secret = "test-paystack-secret";
  const signature = createHmac("sha512", secret).update(rawBody).digest("hex");

  assert.equal(isValidPaystackWebhookSignature(rawBody, signature, secret), true);
  assert.equal(isValidPaystackWebhookSignature(rawBody, undefined, secret), false);
  assert.equal(isValidPaystackWebhookSignature(rawBody, `${signature}00`, secret), false);
  assert.equal(isValidPaystackWebhookSignature(Buffer.from(`${rawBody.toString()} `), signature, secret), false);
});
