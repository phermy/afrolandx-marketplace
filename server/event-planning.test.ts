import assert from "node:assert/strict";
import { test } from "node:test";
import { eventFeeBreakdown, quoteLineSchema } from "./event-planning";

test("8% is charged only on the planner fee and the remainder balances", () => {
  const result = eventFeeBreakdown(25000);
  assert.deepEqual(result, { plannerFeeNgn: 25000, commissionNgn: 2000, plannerNetNgn: 23000 });
  assert.equal(result.commissionNgn + result.plannerNetNgn, result.plannerFeeNgn);
  assert.deepEqual(eventFeeBreakdown(101), { plannerFeeNgn: 101, commissionNgn: 8, plannerNetNgn: 93 });
  assert.throws(() => eventFeeBreakdown(NaN));
  assert.throws(() => eventFeeBreakdown(100.5));
  assert.throws(() => eventFeeBreakdown(-1));
});

test("supplier costs are bounded quote lines, not part of the commission base", () => {
  const item = quoteLineSchema.parse({
    category: "hotel", description: "Two rooms", provider: "External hotel",
    estimatedAmountNgn: 500000, bookingStatus: "requested",
  });
  assert.equal(item.estimatedAmountNgn, 500000);
  assert.equal(eventFeeBreakdown(25000).commissionNgn, 2000);
  assert.equal(quoteLineSchema.safeParse({ ...item, bookingStatus: "booked" }).success, false);
  assert.equal(quoteLineSchema.safeParse({ ...item, estimatedAmountNgn: -1 }).success, false);
});