import assert from "node:assert/strict";
import test from "node:test";
import { insertProductSchema, returnPolicySchema } from "@shared/schema";

test("return policies only accept AfrolandX-approved classifications", () => {
  for (const value of ["standard_returns", "final_sale", "custom_made", "hygiene_sensitive"]) {
    assert.equal(returnPolicySchema.parse(value), value);
  }

  assert.equal(returnPolicySchema.safeParse("Vendor decides").success, false);
  assert.equal(returnPolicySchema.safeParse("").success, false);
});

test("new products default to standard returns when no classification is supplied", () => {
  const product = insertProductSchema.parse({
    vendorId: 1,
    categoryId: 1,
    name: "Handwoven textile",
    description: "Made by hand",
    price: "10000",
    stock: 1,
  });

  assert.equal(product.returnPolicy, "standard_returns");
});