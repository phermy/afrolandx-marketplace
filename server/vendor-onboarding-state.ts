import { sql } from "drizzle-orm";
import { db } from "./db";
import { normalizeCacNumber, evidenceNeeds, secondApprovalProblem, cacNumbersMayMatch } from "../shared/vendor-onboarding";

export class OnboardingError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
type Executor = Pick<typeof db, "execute">;
export async function ensureVendorOnboardingTables() {
  // Narrow additive DDL only: never push or truncate unrelated application tables.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vendor_onboarding_state (
      vendor_id integer PRIMARY KEY REFERENCES vendors(id), revision integer NOT NULL DEFAULT 1,
      submitted_at timestamptz, first_reviewer_id varchar REFERENCES users(id), first_reviewed_at timestamptz,
      duplicate_fingerprint text, duplicate_resolution_notes text,
      second_reviewer_id varchar REFERENCES users(id), second_reviewed_at timestamptz,
      next_review_at timestamptz, last_monitored_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS vendor_application_evidence (
      id serial PRIMARY KEY, vendor_id integer NOT NULL REFERENCES vendors(id),
      kind varchar(32) NOT NULL CHECK (kind IN ('cac_certificate','identity_authority')),
      original_name varchar(160) NOT NULL, mime_type varchar(64) NOT NULL,
      content bytea NOT NULL, bytes integer NOT NULL CHECK(bytes > 0 AND bytes <= 2097152),
      uploaded_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS vendor_evidence_kind_unique ON vendor_application_evidence(vendor_id,kind);
    CREATE TABLE IF NOT EXISTS vendor_monitoring_reviews (
      id serial PRIMARY KEY, vendor_id integer NOT NULL REFERENCES vendors(id),
      reviewer_id varchar NOT NULL REFERENCES users(id), notes text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW()
    );
  `);
}
export async function ensureOnboardingState(tx: Executor, vendorId: number) {
  await tx.execute(sql`INSERT INTO vendor_onboarding_state(vendor_id) VALUES(${vendorId}) ON CONFLICT DO NOTHING`);
}
export async function duplicateCacIds(tx: Executor, vendor: { id: number; cacNumber: string | null }) {
  const canonical = normalizeCacNumber(vendor.cacNumber);
  if (!canonical) return [];
  // Include historical/closed applications: a suspension is not proof a number is free.
  const rows = await tx.execute(sql`SELECT id,cac_number FROM vendors WHERE id <> ${vendor.id} AND cac_number IS NOT NULL ORDER BY id`);
  return rows.rows.filter(row => cacNumbersMayMatch(row.cac_number, canonical)).map(row => Number(row.id));
}
export async function lockCacReview(tx: Executor, number: string | null) {
  const canonical = normalizeCacNumber(number);
  if (!canonical) throw new OnboardingError("A valid CAC number is required.", 400);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`vendor-cac:${canonical}`}))`);
}
export async function onboardingFacts(tx: Executor, vendorId: number) {
  const state = (await tx.execute(sql`SELECT * FROM vendor_onboarding_state WHERE vendor_id=${vendorId}`)).rows[0];
  const evidence = (await tx.execute(sql`SELECT id,kind,original_name AS "originalName",bytes,uploaded_at AS "uploadedAt" FROM vendor_application_evidence WHERE vendor_id=${vendorId} ORDER BY id`)).rows;
  return { state, evidence, missing: evidenceNeeds(evidence.map(row => String(row.kind))) };
}
export async function invalidateOnboarding(tx: Executor, vendorId: number) {
  await ensureOnboardingState(tx, vendorId);
  await tx.execute(sql`UPDATE vendor_onboarding_state SET revision=revision+1,submitted_at=NULL,
    first_reviewer_id=NULL,first_reviewed_at=NULL,duplicate_fingerprint=NULL,duplicate_resolution_notes=NULL,
    second_reviewer_id=NULL,second_reviewed_at=NULL WHERE vendor_id=${vendorId}`);
  await tx.execute(sql`UPDATE vendors SET verification_status='pending',cac_verified_at=NULL,
    identity_verified_at=NULL,business_verified_at=NULL,updated_at=NOW() WHERE id=${vendorId}`);
}
export async function vendorMonitoringSignals(tx: Executor, vendorId: number) {
  const result = await tx.execute(sql`
    WITH vendor_orders AS (SELECT DISTINCT o.* FROM orders o
      JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id
      WHERE p.vendor_id=${vendorId} AND o.payment_status='paid')
    SELECT
      (SELECT COUNT(*)::int FROM vendor_orders WHERE created_at >= NOW()-INTERVAL '30 days') AS "orders30d",
      (SELECT COUNT(*)::int FROM vendor_orders o JOIN vendor_shipping_profiles sp ON sp.vendor_id=${vendorId}
        WHERE o.order_status IN ('pending','processing') AND o.created_at < NOW()-sp.processing_days*INTERVAL '1 day') AS "lateOrders",
      (SELECT COUNT(DISTINCT a.id)::int FROM order_financial_adjustments a JOIN vendor_orders o ON o.id=a.order_id
        WHERE a.kind='refund' AND a.status='processed' AND a.created_at>=NOW()-INTERVAL '30 days') AS "refunds30d",
      (SELECT COUNT(DISTINCT a.id)::int FROM order_financial_adjustments a JOIN vendor_orders o ON o.id=a.order_id
        WHERE a.kind='chargeback' AND a.created_at>=NOW()-INTERVAL '30 days') AS "disputes30d"
  `);
  return result.rows[0];
}
export async function recordFirstVendorReview(tx: Executor, vendor: any, reviewerId: string, verified: boolean, duplicateNotes = "") {
  if (reviewerId === vendor.userId) throw new OnboardingError("You cannot review your own vendor application.", 403);
  await ensureOnboardingState(tx, vendor.id);
  if (!verified) {
    await tx.execute(sql`UPDATE vendor_onboarding_state SET first_reviewer_id=NULL,first_reviewed_at=NULL,
      second_reviewer_id=NULL,second_reviewed_at=NULL WHERE vendor_id=${vendor.id}`);
    return;
  }
  await lockCacReview(tx, vendor.cacNumber);
  const { state, missing } = await onboardingFacts(tx, vendor.id);
  if (!state?.submitted_at || missing.length) throw new OnboardingError("The applicant must submit both required evidence documents before verification.");
  const duplicates = await duplicateCacIds(tx, vendor);
  if (duplicates.length && duplicateNotes.trim().length < 20) throw new OnboardingError("Review the matching CAC applications and record at least 20 characters explaining the resolution.");
  await tx.execute(sql`UPDATE vendor_onboarding_state SET first_reviewer_id=${reviewerId},first_reviewed_at=NOW(),
    duplicate_fingerprint=${duplicates.join(",")},duplicate_resolution_notes=${duplicateNotes},
    second_reviewer_id=NULL,second_reviewed_at=NULL WHERE vendor_id=${vendor.id}`);
}
export async function recordSecondVendorApproval(tx: Executor, vendor: any, actorId: string) {
  await lockCacReview(tx, vendor.cacNumber);
  const { state, missing } = await onboardingFacts(tx, vendor.id);
  const duplicates = await duplicateCacIds(tx, vendor);
  const problem = secondApprovalProblem({ actorId, ownerId: vendor.userId,
    firstReviewerId: state?.first_reviewer_id ? String(state.first_reviewer_id) : null,
    submitted: Boolean(state?.submitted_at), missingEvidence: missing,
    duplicatesChanged: duplicates.join(",") !== state?.duplicate_fingerprint });
  if (problem) throw new OnboardingError(problem);
  const reviewers = await tx.execute(sql`SELECT email_verified,roles,closed_at FROM users WHERE id=${String(state!.first_reviewer_id)}`);
  const reviewer = reviewers.rows[0];
  if (!reviewer?.email_verified || reviewer.closed_at || !(reviewer.roles as string[])?.some(role => ["admin","superadmin"].includes(role))) {
    throw new OnboardingError("The first reviewer no longer has verified Admin access. Repeat the first review.");
  }
  await tx.execute(sql`UPDATE vendor_onboarding_state SET second_reviewer_id=${actorId},second_reviewed_at=NOW(),
    next_review_at=NOW()+INTERVAL '90 days' WHERE vendor_id=${vendor.id}`);
}
