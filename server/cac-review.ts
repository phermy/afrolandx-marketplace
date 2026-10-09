import { z } from "zod";
import { cacBusinessNamesMatch } from "@shared/cac-review";

export const CAC_PUBLIC_SEARCH_URL = "https://icrp.cac.gov.ng/public-search/";
export const CAC_REVIEW_MARKER = "CAC_PUBLIC_SEARCH_REVIEW_V1";

export function hasManualCacReview(notes: string | null): boolean {
  return Boolean(notes?.includes(`${CAC_REVIEW_MARKER}\n`));
}

export const cacReviewSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("verified"),
    cacVerified: z.literal(true),
    identityVerified: z.literal(true),
    businessVerified: z.literal(true),
    cacRegisteredName: z.string().trim().min(2).max(160),
    cacRegistryStatus: z.literal("active"),
    relationshipConfirmed: z.boolean().default(false),
    relationshipEvidence: z.string().trim().max(1000).default(""),
    notes: z.string().trim().max(1500).default(""),
    duplicateResolutionNotes: z.string().trim().max(2000).default(""),
  }),
  z.object({
    decision: z.literal("rejected"),
    notes: z.string().trim().min(10).max(1500),
  }),
]);

export type CacReview = z.infer<typeof cacReviewSchema>;

export function cacReviewNotes(
  vendor: { cacNumber: string | null; businessName: string },
  review: CacReview,
  reviewerId: string,
  reviewedAt: Date,
): string {
  if (review.decision === "rejected") {
    return `Verification rejected on ${reviewedAt.toISOString()} by ${reviewerId}.\nReason: ${review.notes}`;
  }
  if (!vendor.cacNumber?.trim()) throw new Error("A CAC registration number is required");
  const namesMatch = cacBusinessNamesMatch(review.cacRegisteredName, vendor.businessName);
  if (!namesMatch && (!review.relationshipConfirmed || review.relationshipEvidence.length < 20)) {
    throw new Error("The CAC registered name differs from the vendor name. Confirm and describe evidence linking the two businesses.");
  }
  return [
    CAC_REVIEW_MARKER,
    `Manual CAC Public Search review on ${reviewedAt.toISOString()} by ${reviewerId}.`,
    `Registration number checked: ${vendor.cacNumber.trim()}`,
    `CAC registered name: ${review.cacRegisteredName}`,
    "CAC listing status: Active",
    `Vendor business name at review: ${vendor.businessName}`,
    namesMatch ? "Names matched." : `Name difference supported by: ${review.relationshipEvidence}`,
    review.notes ? `Additional notes: ${review.notes}` : "",
  ].filter(Boolean).join("\n");
}