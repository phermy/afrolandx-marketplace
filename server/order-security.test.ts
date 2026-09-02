import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  calculateCheckoutTotal,
  CheckoutValidationError,
  findOwnedCartItem,
  isValidPaystackWebhookSignature,
  paymentVerificationError,
} from "./order-security";

const cart = [
  {
    id: 7,
    userId: "buyer-1",
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

test("checkout computes the server-side NGN subtotal and shipping", () => {
  const result = calculateCheckoutTotal(cart, "UPS");

  assert.equal(result.subtotal, 121000);
  assert.equal(result.shippingAmount, 15000);
  assert.equal(result.totalAmount, 136000);
  assert.equal(result.shippingMethod, "ups");
  assert.equal(result.shippingQuote.price, 15000);
});

test("checkout rejects insufficient stock and invalid sizes", () => {
  assert.throws(
    () => calculateCheckoutTotal([{ ...cart[0], quantity: 6 }], "UPS"),
    new CheckoutValidationError("Aso Oke Set does not have enough stock"),
  );
  assert.throws(
    () => calculateCheckoutTotal([{ ...cart[0], selectedSize: "XXL" }], "UPS"),
    new CheckoutValidationError("Select a valid size for Aso Oke Set"),
  );
});

test("checkout rejects invalid shipping methods and unavailable products", () => {
  assert.throws(
    () => calculateCheckoutTotal(cart, "local-pickup"),
    new CheckoutValidationError("Invalid shipping method"),
  );
  assert.throws(
    () => calculateCheckoutTotal([{
      ...cart[0],
      product: { ...cart[0].product, status: "pending" },
    }], "UPS"),
    new CheckoutValidationError("A cart item is no longer available"),
  );
});

test("checkout does not charge an unconfirmed partner shipping rate", () => {
  assert.throws(
    () => calculateCheckoutTotal(cart, "CargoNaija"),
    new CheckoutValidationError("CargoNaija shipping requires a confirmed shipping quote before payment"),
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

test("Paystack webhook signatures require the exact raw body and secret", () => {
  const rawBody = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "order_42_abc" } }));
  const secret = "test-paystack-secret";
  const signature = createHmac("sha512", secret).update(rawBody).digest("hex");

  assert.equal(isValidPaystackWebhookSignature(rawBody, signature, secret), true);
  assert.equal(isValidPaystackWebhookSignature(rawBody, undefined, secret), false);
  assert.equal(isValidPaystackWebhookSignature(rawBody, `${signature}00`, secret), false);
  assert.equal(isValidPaystackWebhookSignature(Buffer.from(`${rawBody.toString()} `), signature, secret), false);
});
