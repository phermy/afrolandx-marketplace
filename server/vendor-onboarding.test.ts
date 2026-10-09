import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db, pool } from "./db";
import { normalizeCacNumber, cacNumbersMayMatch, vendorApplicationInput, evidenceNeeds, secondApprovalProblem } from "../shared/vendor-onboarding";
import { ensureVendorOnboardingTables, ensureOnboardingState, recordFirstVendorReview, recordSecondVendorApproval,
  invalidateOnboarding, duplicateCacIds, onboardingFacts, vendorMonitoringSignals } from "./vendor-onboarding-state";
import { pageMetadata } from "../shared/page-metadata";

test("CAC syntax accepts supported positive prefixes and canonicalizes formatting", () => {
  for (const [raw, normalized] of [["rc 00123456","RC123456"],["BN-1234567","BN1234567"],["IT1234","IT1234"],["LLP 25","LLP25"],["LP-12","LP12"]]) {
    assert.equal(normalizeCacNumber(raw), normalized);
  }
  for (const raw of ["123456", "RC000", "RC-12X", "RC1<script>", "RC1234567890123", "", null]) assert.equal(normalizeCacNumber(raw), null);
  assert.ok(cacNumbersMayMatch("RC-00123", "rc 123"));
  assert.ok(cacNumbersMayMatch("RC123", "00123"), "ambiguous legacy numbers are flagged");
  assert.equal(cacNumbersMayMatch("BN123","RC123"), false);
  assert.equal(cacNumbersMayMatch("RC123", "RC124"), false);
});
test("drafts require business identity and evidence requirements cover both documents", () => {
  assert.throws(() => vendorApplicationInput.parse({ businessName: "Business" }));
  assert.deepEqual(evidenceNeeds([]), ["cac_certificate","identity_authority"]);
  assert.deepEqual(evidenceNeeds(["cac_certificate"]), ["identity_authority"]);
  assert.deepEqual(evidenceNeeds(["cac_certificate","identity_authority"]), []);
  assert.equal(pageMetadata("/vendor/apply").status, 200);
  assert.equal(pageMetadata("/vendor/apply").indexable, false);
});
test("approval needs two independent reviewers, submission, evidence and a stable duplicate review", () => {
  const valid = { actorId: "second", ownerId: "owner", firstReviewerId: "first", submitted: true, missingEvidence: [], duplicatesChanged: false };
  assert.equal(secondApprovalProblem(valid), null);
  for (const change of [{actorId:"owner"}, {actorId:"first"}, {firstReviewerId:null}, {submitted:false},
    {missingEvidence:["identity_authority"]}, {duplicatesChanged:true}]) assert.ok(secondApprovalProblem({...valid,...change}));
});
test("real database review stages reject bypasses and edits invalidate prior approvals", async () => {
  await ensureVendorOnboardingTables();
  const rollback = new Error("test rollback");
  try {
    await db.transaction(async tx => {
      const owner = `onboarding-owner-${crypto.randomUUID()}`;
      const first = `onboarding-reviewer-${crypto.randomUUID()}`;
      const second = `onboarding-reviewer-${crypto.randomUUID()}`;
      for (const [id, role] of [[owner,"customer"],[first,"admin"],[second,"admin"]]) {
        await tx.execute(sql`INSERT INTO users(id,email,email_verified,roles) VALUES(${id},${`${id}@example.invalid`},true,${JSON.stringify([role])}::jsonb)`);
      }
      const suffix = String(crypto.randomInt(100000000, 999999999));
      const created = await tx.execute(sql`INSERT INTO vendors(user_id,business_name,cac_number,status)
        VALUES(${owner},'Review test',${`RC${suffix}`},'pending') RETURNING id`);
      const vendor = { id: Number(created.rows[0].id), userId: owner, cacNumber: `RC${suffix}` };
      assert.deepEqual(await vendorMonitoringSignals(tx, vendor.id), { orders30d: 0, lateOrders: 0, refunds30d: 0, disputes30d: 0 });
      await ensureOnboardingState(tx, vendor.id);
      await assert.rejects(recordFirstVendorReview(tx,vendor,owner,true), /own vendor/);
      await assert.rejects(recordFirstVendorReview(tx,vendor,first,true), /both required/);
      for (const kind of ["cac_certificate","identity_authority"]) {
        await tx.execute(sql`INSERT INTO vendor_application_evidence(vendor_id,kind,original_name,mime_type,content,bytes)
          VALUES(${vendor.id},${kind},'test.pdf','application/pdf',${Buffer.from("%PDF-1.7 test")},13)`);
      }
      await tx.execute(sql`UPDATE vendor_onboarding_state SET submitted_at=NOW() WHERE vendor_id=${vendor.id}`);
      await recordFirstVendorReview(tx,vendor,first,true);
      await assert.rejects(recordSecondVendorApproval(tx,vendor,first), /different verified Admin/);
      await recordSecondVendorApproval(tx,vendor,second);
      let facts = await onboardingFacts(tx,vendor.id);
      assert.equal(facts.state.first_reviewer_id,first);
      assert.equal(facts.state.second_reviewer_id,second);
      assert.ok(facts.state.next_review_at);
      assert.ok(!JSON.stringify(facts.evidence).includes("content"), "metadata never includes private bytes");
      await invalidateOnboarding(tx,vendor.id);
      facts = await onboardingFacts(tx,vendor.id);
      assert.equal(facts.state.first_reviewer_id,null); assert.equal(facts.state.second_reviewer_id,null);
      assert.equal(facts.state.submitted_at,null);
      assert.equal(facts.missing.length,0);
      await tx.execute(sql`UPDATE vendor_onboarding_state SET submitted_at=NOW() WHERE vendor_id=${vendor.id}`);
      const otherOwner = `onboarding-owner-${crypto.randomUUID()}`;
      await tx.execute(sql`INSERT INTO users(id,email,roles) VALUES(${otherOwner},${`${otherOwner}@example.invalid`},'["customer"]'::jsonb)`);
      const other = await tx.execute(sql`INSERT INTO vendors(user_id,business_name,cac_number) VALUES(${otherOwner},'Matching test',${`rc ${suffix}`}) RETURNING id`);
      assert.ok((await duplicateCacIds(tx,vendor)).includes(Number(other.rows[0].id)));
      await assert.rejects(recordFirstVendorReview(tx,vendor,first,true), /resolution/);
      await recordFirstVendorReview(tx,vendor,first,true,"Reviewed supporting records for the related business application.");
      await tx.execute(sql`UPDATE vendors SET cac_number=${`RC${Number(suffix)+1}`} WHERE id=${Number(other.rows[0].id)}`);
      await assert.rejects(recordSecondVendorApproval(tx,vendor,second), /changed since/);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
});
test.after(async () => { await pool.end(); });
