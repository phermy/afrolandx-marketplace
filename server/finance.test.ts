import test from "node:test";
import assert from "node:assert/strict";
import { calculateCommission } from "./finance";

test("commission is 8% of merchandise and rounds to currency precision", () => {
  assert.deepEqual(calculateCommission(100000), { gross: 100000, commission: 8000, net: 92000 });
  assert.deepEqual(calculateCommission(12.34), { gross: 12.34, commission: 0.99, net: 11.35 });
});

test("shipping is absent from the merchandise commission calculation", () => {
  const merchandise = calculateCommission(50000);
  assert.equal(merchandise.commission, 4000);
  assert.equal(merchandise.net, 46000);
});