import type { Express, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { vendors } from "../shared/schema";
import { vendorApplicationInput, EVIDENCE_KINDS, normalizeCacNumber } from "../shared/vendor-onboarding";
import { canReviewVendorApplication, vendorApplicationForReviewer } from "./vendor-application-access";
import { hasSupportManagementAccess } from "../shared/admin-access";
import { ensureVendorOnboardingTables, ensureOnboardingState, onboardingFacts, duplicateCacIds,
  invalidateOnboarding, lockCacReview, OnboardingError, vendorMonitoringSignals } from "./vendor-onboarding-state";
import { requestRateLimit } from "./request-rate-limit";

const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 1 } }).single("file");
const numericId = (value: unknown) => typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : 0;
function fail(res: Response, error: unknown) {
  if (error instanceof OnboardingError) return res.status(error.status).json({ message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0]?.message || "Check your application details." });
  if ((error as any)?.code === "23505") return res.status(409).json({ message: "Your application changed. Refresh before trying again." });
  console.error("Vendor onboarding operation failed.");
  return res.status(500).json({ message: "The application could not be updated. Please retry." });
}
async function verifiedActor(req: Request) {
  const user = await storage.getUser((req.user as any)?.id);
  if (!user || !user.emailVerified || user.closedAt) throw new OnboardingError("Verify your email before continuing.", 403);
  return user;
}
async function applicantVendor(req: Request) {
  const user = await verifiedActor(req);
  const vendor = await storage.getVendorByUserId(user.id);
  if (!vendor) throw new OnboardingError("Save your business details before uploading evidence.", 404);
  return vendor;
}
function assertEditable(vendor: any) {
  if (["approved", "suspended"].includes(vendor.status)) throw new OnboardingError("Contact support to change an approved or suspended business application.");
}
async function reviewerVendor(req: Request, vendorId: number) {
  const actor = await verifiedActor(req);
  if (!hasSupportManagementAccess(actor)) throw new OnboardingError("Verified Admin access is required.", 403);
  const vendor = vendorId ? await storage.getVendor(vendorId) : undefined;
  const applicant = vendor ? await storage.getUser(vendor.userId) : undefined;
  if (!vendor || !applicant || !canReviewVendorApplication(actor, applicant)) throw new OnboardingError("Vendor not found.", 404);
  return { actor, vendor, applicant };
}
async function applicationDetail(vendor: any, reviewing?: { actor: any; applicant: any }) {
  if (!vendor) return { vendor: null, evidence: [], review: null, duplicatesCount: 0, needs: ["business_details", ...EVIDENCE_KINDS] };
  const { state, evidence, missing } = await onboardingFacts(db, vendor.id);
  const duplicates = await duplicateCacIds(db, vendor);
  const names = state ? (await db.execute(sql`SELECT id,concat_ws(' ',first_name,last_name) AS name FROM users
    WHERE id IN (${state.first_reviewer_id as string || ""},${state.second_reviewer_id as string || ""})`)).rows : [];
  const name = (id: unknown) => names.find(row => row.id === id)?.name || null;
  const visibleVendor = reviewing ? vendorApplicationForReviewer(vendor, reviewing.applicant, reviewing.actor) : vendor;
  const visibleDuplicates = [];
  if (reviewing) {
    for (const id of duplicates) {
      const match = await storage.getVendor(id);
      const applicant = match ? await storage.getUser(match.userId) : undefined;
      if (match && canReviewVendorApplication(reviewing.actor, applicant)) {
        visibleDuplicates.push({ id: match.id, businessName: match.businessName, status: match.status });
      }
    }
  }
  const monitoringReviews = reviewing && !visibleVendor.staffOwned ? (await db.execute(sql`
    SELECT r.id,r.notes,r.created_at AS "createdAt",concat_ws(' ',u.first_name,u.last_name) AS "reviewerName"
    FROM vendor_monitoring_reviews r JOIN users u ON u.id=r.reviewer_id
    WHERE r.vendor_id=${vendor.id} ORDER BY r.created_at DESC LIMIT 20
  `)).rows : [];
  return {
    vendor: visibleVendor,
    evidence,
    review: state ? { revision: state.revision, submittedAt: state.submitted_at,
      firstReviewerId: state.first_reviewer_id, firstReviewerName: name(state.first_reviewer_id), firstReviewedAt: state.first_reviewed_at,
      secondReviewerId: state.second_reviewer_id, secondReviewerName: name(state.second_reviewer_id), secondReviewedAt: state.second_reviewed_at,
      nextReviewAt: state.next_review_at, lastMonitoredAt: state.last_monitored_at } : null,
    duplicatesCount: duplicates.length,
    ...(reviewing ? { duplicates: visibleDuplicates, monitoringReviews } : {}),
    needs: [...(!normalizeCacNumber(vendor.cacNumber) ? ["valid_cac_number"] : []), ...missing],
  };
}
export async function registerVendorOnboardingRoutes(app: Express) {
  await ensureVendorOnboardingTables();
  app.get("/api/vendor-application", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try { const actor = await verifiedActor(req); res.json(await applicationDetail(await storage.getVendorByUserId(actor.id))); }
    catch (error) { fail(res, error); }
  });
  app.post("/api/vendor-application", isAuthenticated, requestRateLimit("vendor-draft", 30, 900), async (req, res) => {
    try {
      const actor = await verifiedActor(req);
      const input = vendorApplicationInput.parse(req.body);
      const saved = await db.transaction(async tx => {
        let [vendor] = await tx.select().from(vendors).where(eq(vendors.userId, actor.id)).for("update");
        if (vendor) assertEditable(vendor);
        await lockCacReview(tx, input.cacNumber);
        if (vendor) {
          const changed = Object.entries(input).some(([key, value]) => (vendor as any)[key] !== value);
          if (changed) {
            await invalidateOnboarding(tx, vendor.id);
            [vendor] = await tx.update(vendors).set({ ...input, status: "pending", updatedAt: new Date() }).where(eq(vendors.id, vendor.id)).returning();
          }
        } else {
          [vendor] = await tx.insert(vendors).values({ ...input, userId: actor.id, status: "pending" }).returning();
          await ensureOnboardingState(tx, vendor.id);
        }
        return vendor;
      });
      await storage.addUserRole(actor.id, "vendor");
      res.json(await applicationDetail(saved));
    } catch (error) { fail(res, error); }
  });
  app.post("/api/vendor-application/evidence", isAuthenticated, requestRateLimit("vendor-evidence", 20, 900), async (req, res) => {
    try { assertEditable(await applicantVendor(req)); } catch (error) { fail(res, error); return; }
    evidenceUpload(req, res, async uploadError => {
      if (uploadError) return void res.status(uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message: "Upload one PDF, JPEG or PNG of no more than 2 MB." });
      try {
        const kind = z.enum(EVIDENCE_KINDS).parse(req.body.kind);
        if (!req.file?.buffer.length) throw new OnboardingError("Choose an evidence document.", 400);
        let content = req.file.buffer, mimeType: string;
        const pdf = content.subarray(0, 5).toString() === "%PDF-";
        if (pdf) mimeType = "application/pdf";
        else {
          const jpeg = content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
          const png = content.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
          if (!jpeg && !png) throw new OnboardingError("Only genuine PDF, JPEG and PNG files are accepted.", 400);
          try { content = await sharp(content, { limitInputPixels: 16_000_000 }).rotate().jpeg({ quality: 92 }).toBuffer(); }
          catch { throw new OnboardingError("This image is invalid or too large to process safely.", 400); }
          mimeType = "image/jpeg";
        }
        if (content.length > 2 * 1024 * 1024) throw new OnboardingError("The processed document exceeds 2 MB.", 413);
        const originalName = req.file.originalname.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 150) || "evidence";
        const vendor = await applicantVendor(req);
        await db.transaction(async tx => {
          const [locked] = await tx.select().from(vendors).where(eq(vendors.id, vendor.id)).for("update");
          assertEditable(locked);
          await tx.execute(sql`INSERT INTO vendor_application_evidence(vendor_id,kind,original_name,mime_type,content,bytes)
            VALUES(${vendor.id},${kind},${originalName},${mimeType},${content},${content.length})
            ON CONFLICT(vendor_id,kind) DO UPDATE SET original_name=EXCLUDED.original_name,mime_type=EXCLUDED.mime_type,
              content=EXCLUDED.content,bytes=EXCLUDED.bytes,uploaded_at=NOW()`);
          await invalidateOnboarding(tx, vendor.id);
        });
        res.json(await applicationDetail(await storage.getVendor(vendor.id)));
      } catch (error) { fail(res, error); }
    });
  });
  app.delete("/api/vendor-application/evidence/:id", isAuthenticated, async (req, res) => {
    try {
      const vendor = await applicantVendor(req), id = numericId(req.params.id);
      await db.transaction(async tx => {
        const [locked] = await tx.select().from(vendors).where(eq(vendors.id, vendor.id)).for("update");
        assertEditable(locked);
        const result = await tx.execute(sql`DELETE FROM vendor_application_evidence WHERE id=${id} AND vendor_id=${vendor.id} RETURNING id`);
        if (!result.rows.length) throw new OnboardingError("Evidence not found.", 404);
        await invalidateOnboarding(tx, vendor.id);
      });
      res.json(await applicationDetail(await storage.getVendor(vendor.id)));
    } catch (error) { fail(res, error); }
  });
  app.get("/api/vendor-application/evidence/:id/download", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const actor = await verifiedActor(req), id = numericId(req.params.id);
      // Authorize metadata before loading sensitive bytes into the response.
      const meta = (await db.execute(sql`SELECT id,vendor_id FROM vendor_application_evidence WHERE id=${id}`)).rows[0];
      const vendor = meta ? await storage.getVendor(Number(meta.vendor_id)) : undefined;
      const applicant = vendor ? await storage.getUser(vendor.userId) : undefined;
      if (!vendor || !applicant || (vendor.userId !== actor.id && !canReviewVendorApplication(actor, applicant))) throw new OnboardingError("Evidence not found.", 404);
      const file = (await db.execute(sql`SELECT original_name,mime_type,content FROM vendor_application_evidence WHERE id=${id} AND vendor_id=${vendor.id}`)).rows[0];
      if (!file) throw new OnboardingError("Evidence not found.", 404);
      res.set("Content-Security-Policy", "default-src 'none'; sandbox");
      res.set("Content-Disposition", `attachment; filename="${String(file.original_name).replace(/[^a-zA-Z0-9._ -]/g, "_")}"`);
      res.type("application/octet-stream").send(file.content);
    } catch (error) { fail(res, error); }
  });
  app.post("/api/vendor-application/submit", isAuthenticated, requestRateLimit("vendor-submit", 10, 900), async (req, res) => {
    try {
      const vendor = await applicantVendor(req);
      await db.transaction(async tx => {
        const [locked] = await tx.select().from(vendors).where(eq(vendors.id, vendor.id)).for("update");
        assertEditable(locked);
        vendorApplicationInput.parse(locked);
        await ensureOnboardingState(tx, vendor.id);
        const { missing } = await onboardingFacts(tx, vendor.id);
        if (missing.length) throw new OnboardingError("Upload the CAC certificate and proof of authority before submitting.");
        await tx.execute(sql`UPDATE vendor_onboarding_state SET submitted_at=COALESCE(submitted_at,NOW()) WHERE vendor_id=${vendor.id}`);
        await tx.execute(sql`UPDATE vendors SET verification_status=CASE WHEN verification_status='verified' THEN 'verified' ELSE 'submitted' END,
          status='pending',updated_at=NOW() WHERE id=${vendor.id}`);
      });
      res.json(await applicationDetail(await storage.getVendor(vendor.id)));
    } catch (error) { fail(res, error); }
  });
  app.get("/api/admin/vendors/:id/onboarding", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try { const context = await reviewerVendor(req, numericId(req.params.id)); res.json(await applicationDetail(context.vendor, context)); }
    catch (error) { fail(res, error); }
  });
  app.get("/api/admin/vendor-monitoring", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const actor = await verifiedActor(req);
      if (!hasSupportManagementAccess(actor)) throw new OnboardingError("Verified Admin access is required.", 403);
      const all = await storage.getAllVendors();
      const monitored = [];
      for (const vendor of all.filter(vendor => ["approved","suspended"].includes(vendor.status || ""))) {
        const applicant = await storage.getUser(vendor.userId);
        if (!canReviewVendorApplication(actor, applicant)) continue;
        const { state, missing } = await onboardingFacts(db, vendor.id);
        const counts = await vendorMonitoringSignals(db, vendor.id);
        monitored.push({ id: vendor.id, businessName: vendor.businessName, status: vendor.status,
          reviewDue: !state?.next_review_at || new Date(String(state.next_review_at)) <= new Date(),
          missingEvidence: missing.length > 0, duplicatesCount: (await duplicateCacIds(db, vendor)).length,
          nextReviewAt: state?.next_review_at || null, lastMonitoredAt: state?.last_monitored_at || null, ...counts });
      }
      res.json({ vendors: monitored });
    } catch (error) { fail(res, error); }
  });
  app.post("/api/admin/vendors/:id/monitoring", isAuthenticated, async (req, res) => {
    try {
      const context = await reviewerVendor(req, numericId(req.params.id));
      const { notes } = z.object({ notes: z.string().trim().min(20).max(2000) }).parse(req.body);
      if (!["approved","suspended"].includes(context.vendor.status || "")) throw new OnboardingError("Only approved or suspended vendors are monitored here.");
      await db.transaction(async tx => {
        await tx.execute(sql`SELECT id FROM vendors WHERE id=${context.vendor.id} FOR UPDATE`);
        await ensureOnboardingState(tx, context.vendor.id);
        await tx.execute(sql`INSERT INTO vendor_monitoring_reviews(vendor_id,reviewer_id,notes) VALUES(${context.vendor.id},${context.actor.id},${notes})`);
        await tx.execute(sql`UPDATE vendor_onboarding_state SET last_monitored_at=NOW(),next_review_at=NOW()+INTERVAL '90 days' WHERE vendor_id=${context.vendor.id}`);
      });
      res.json({ message: "Monitoring review recorded. The next review is due in 90 days." });
    } catch (error) { fail(res, error); }
  });
}
