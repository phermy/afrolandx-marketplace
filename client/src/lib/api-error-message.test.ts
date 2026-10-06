import assert from "node:assert/strict";
import { test } from "node:test";
import { getApiErrorMessage } from "./api-error-message";

test("reads a human message from a 409 JSON API error and preserves the raw error", () => {
  const error = new Error('409: {"message":"Vendor verification is required.","reason":"vendor_unverified"}');
  assert.equal(getApiErrorMessage(error), "Vendor verification is required.");
  assert.equal(error.message.startsWith("409:"), true);
});

test("reads a human message from a 404 JSON API error", () => {
  assert.equal(getApiErrorMessage(new Error('404: {"message":"Product listing not found."}')), "Product listing not found.");
});

test("uses plain text API error content", () => {
  assert.equal(getApiErrorMessage(new Error("503: Service temporarily unavailable.")), "Service temporarily unavailable.");
});

test("falls back to readable text when the response contains malformed JSON", () => {
  assert.equal(getApiErrorMessage(new Error('500: {"message":')), '{"message":');
});
