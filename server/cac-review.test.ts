import assert from "node:assert/strict";
import test from "node:test";
import { cacBusinessNamesMatch } from "../shared/cac-review";
import { cacReviewNotes, cacReviewSchema, hasManualCacReview } from "./cac-review";

const vendor = { cacNumber: "RC 123456", businessName: "Amina Textiles" };
const validReview = {
  decision: "verified" as const,
  cacVerified: true,
  identityVerified: true,
  businessVerified: true,
  cacRegisteredName: "AMINA TEXTILES LIMITED",
  cacRegistryStatus: "active" as const,
  notes: "Checked the official listing.",
};

test("compares registered business names without allowing unrelated names", () => {
  assert.equal(cacBusinessNamesMatch("Amina Textiles Limited", "AMINA TEXTILES"), true);
  assert.equal(cacBusinessNamesMatch("Other Textiles", "Amina Textiles"), false);
  assert.equal(cacBusinessNamesMatch("Limited Edition", "Edition"), false);
  assert.equal(cacBusinessNamesMatch("", "Amina Textiles"), false);
});

test("verification requires an active listing and all independent checks", () => {
  assert.equal(cacReviewSchema.safeParse(validReview).success, true);
  assert.equal(cacReviewSchema.safeParse({ ...validReview, cacRegistryStatus: "not-found" }).success, false);
  assert.equal(cacReviewSchema.safeParse({ ...validReview, cacVerified: false }).success, false);
  assert.equal(cacReviewSchema.safeParse({ ...validReview, businessVerified: false }).success, false);
});

test("a different registered name needs documented evidence of the link", () => {
  const review = cacReviewSchema.parse({ ...validReview, cacRegisteredName: "Other Company Ltd" });
  assert.throws(() => cacReviewNotes(vendor, review, "admin", new Date("2026-09-26")), /linking the two/);
  const supported = cacReviewSchema.parse({
    ...validReview,
    cacRegisteredName: "Other Company Ltd",
    relationshipConfirmed: true,
    relationshipEvidence: "Incorporation documents show this entity owns the Amina Textiles shop.",
  });
  assert.match(cacReviewNotes(vendor, supported, "admin", new Date("2026-09-26")), /Name difference supported by:/);
});

test("the reviewed number, legal name, status, and reviewer are recorded", () => {
  const notes = cacReviewNotes(vendor, cacReviewSchema.parse(validReview), "admin", new Date("2026-09-26"));
  assert.match(notes, /Registration number checked: RC 123456/);
  assert.match(notes, /CAC registered name: AMINA TEXTILES LIMITED/);
  assert.match(notes, /CAC listing status: Active/);
  assert.match(notes, /by admin/);
  assert.equal(hasManualCacReview(notes), true);
  assert.equal(hasManualCacReview("I checked the CAC registration"), false);
});

test("rejection requires a reason and does not require false verification checks", () => {
  assert.equal(cacReviewSchema.safeParse({ decision: "rejected", notes: "wrong" }).success, false);
  const rejected = cacReviewSchema.parse({ decision: "rejected", notes: "The number belongs to another business." });
  assert.match(cacReviewNotes(vendor, rejected, "admin", new Date("2026-09-26")), /Verification rejected/);
});