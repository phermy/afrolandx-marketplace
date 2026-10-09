import { z } from "zod";
import { normalizeAccountPhone } from "./account-registration";

/** Syntax only: this is not a CAC registry lookup or verification. */
export function normalizeCacNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(RC|BN|IT|LLP|LP)\s*-?\s*(\d{1,12})$/i.exec(value.trim());
  if (!match || /^0+$/.test(match[2])) return null;
  return `${match[1].toUpperCase()}${match[2].replace(/^0+/, "")}`;
}
export const cacNumberInput = z.string().transform((value, ctx) => {
  const number = normalizeCacNumber(value);
  if (!number) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use a CAC prefix (RC, BN, IT, LP or LLP) followed by a positive registration number, for example RC1234567." });
    return z.NEVER;
  }
  return number;
});
/** Bare historical numbers are ambiguous and must be flagged, not assigned a prefix. */
export function cacNumbersMayMatch(a: unknown, b: unknown): boolean {
  const first = normalizeCacNumber(a), second = normalizeCacNumber(b);
  if (first && second) return first === second;
  const bare = (value: unknown) => typeof value === "string" && /^\d{1,12}$/.test(value.trim())
    ? value.trim().replace(/^0+/, "") : null;
  if (first && bare(b)) return first.replace(/^[A-Z]+/, "") === bare(b);
  if (second && bare(a)) return second.replace(/^[A-Z]+/, "") === bare(a);
  return Boolean(bare(a) && bare(a) === bare(b));
}
export const vendorApplicationInput = z.object({
  contactName: z.string().trim().min(2).max(120),
  businessName: z.string().trim().min(2).max(160),
  phone: z.string().transform((value, ctx) => {
    const phone = normalizeAccountPhone(value);
    if (!phone) { ctx.addIssue({ code: "custom", message: "Enter a valid phone number." }); return z.NEVER; }
    return phone;
  }),
  cacNumber: cacNumberInput,
  description: z.string().trim().min(10).max(2000),
});
export const EVIDENCE_KINDS = ["cac_certificate", "identity_authority"] as const;
export function evidenceNeeds(kinds: string[]): string[] {
  return EVIDENCE_KINDS.filter(kind => !kinds.includes(kind));
}
export function secondApprovalProblem(input: {
  actorId: string; ownerId: string; firstReviewerId: string | null;
  submitted: boolean; missingEvidence: string[]; duplicatesChanged: boolean;
}): string | null {
  if (input.actorId === input.ownerId) return "You cannot approve your own vendor application.";
  if (!input.submitted || input.missingEvidence.length) return "Submit the application with both required evidence documents before approval.";
  if (!input.firstReviewerId) return "The first documented CAC review is required.";
  if (input.firstReviewerId === input.actorId) return "A different verified Admin must give the second approval.";
  if (input.duplicatesChanged) return "Matching CAC applications changed since the first review. Repeat the first review.";
  return null;
}
