import assert from "node:assert/strict";
import test from "node:test";
import { assertAgencyPaymentAmount, assertBuyerShippingSettled, assertShipmentTransition } from "./logistics-policy";
import { shipmentUpdateSchema, partnerQuoteSchema } from "../shared/logistics";

test("vendors can mark ready but never claim carrier collection or delivery", () => {
  assert.doesNotThrow(() => assertShipmentTransition("preparing", "ready_for_pickup", "vendor", false));
  assert.throws(() => assertShipmentTransition("pickup_scheduled", "collected", "vendor", false));
  assert.throws(() => assertShipmentTransition("out_for_delivery", "delivered", "vendor", false));
  assert.throws(() => assertShipmentTransition("preparing", "ready_for_pickup", "partner", false));
});
test("partner progression and admin corrections have separate controls", () => {
  assert.doesNotThrow(() => assertShipmentTransition("collected", "in_transit", "partner", false));
  assert.throws(() => assertShipmentTransition("preparing", "delivered", "partner", false));
  assert.throws(() => assertShipmentTransition("in_transit", "collected", "partner", true, "A reason is provided"));
  assert.throws(() => assertShipmentTransition("in_transit", "collected", "admin", true, "Short"));
  assert.doesNotThrow(() => assertShipmentTransition("in_transit", "collected", "admin", true, "Correcting a mistaken scan"));
  assert.throws(() => assertShipmentTransition("delivered", "in_transit", "admin", true, "Correcting a mistaken scan"));
});
test("a testing deposit or unpaid final shipping cannot unlock dispatch", () => {
  const paid = { paymentStatus: "paid", shippingPaymentStatus: "included", orderStatus: "processing" };
  assert.doesNotThrow(() => assertBuyerShippingSettled(paid));
  assert.throws(() => assertBuyerShippingSettled({ ...paid, shippingEstimatedAmount: "1", shippingFinalAmount: null }));
  assert.throws(() => assertBuyerShippingSettled({ ...paid, shippingPaymentStatus: "awaiting_quote" }));
  assert.throws(() => assertBuyerShippingSettled({ ...paid, orderStatus: "cancelled" }));
});
test("agency records require exact NGN amounts and safe tracking values", () => {
  assert.doesNotThrow(() => assertAgencyPaymentAmount("1000.50", 1000.5));
  assert.throws(() => assertAgencyPaymentAmount("1000.50", 1000.51));
  assert.equal(partnerQuoteSchema.safeParse({ amount: 1.001, estimatedDelivery: "Two days" }).success, false);
  assert.equal(shipmentUpdateSchema.safeParse({ status: "in_transit", note: "Carrier update", trackingUrl: "javascript:alert(1)" }).success, false);
  assert.equal(shipmentUpdateSchema.safeParse({ status: "in_transit", note: "Carrier update", trackingUrl: "https://carrier.example/track/123" }).success, true);
});
