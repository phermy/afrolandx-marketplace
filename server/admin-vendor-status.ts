import type { RequestHandler } from "express";
import { storage } from "./storage";
import { canReviewVendorApplication, vendorApplicationForReviewer } from "./vendor-application-access";
import { hasSupportManagementAccess } from "../shared/admin-access";
import { hasManualCacReview } from "./cac-review";
import { approveVendorWithRole, RoleManagementError } from "./superadmin-role-management";
import { notifyVendorStatus } from "./account-notifications";

type VendorStore = Pick<typeof storage, "getUser" | "getVendor" | "updateVendorStatus">;

export function createVendorStatusHandler(store: VendorStore, approve: typeof approveVendorWithRole, notify = async (_vendor: any, _applicant: any, _status: string, _reason?: string) => {}): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const actorId = (req.user as any)?.id;
      const actor = await store.getUser(actorId);
      if (!hasSupportManagementAccess(actor)) {
        return void res.status(403).json({ message: "Verified Admin access is required." });
      }
      const vendorId = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
      if (!Number.isSafeInteger(vendorId) || vendorId <= 0) {
        return void res.status(400).json({ message: "Invalid vendor ID." });
      }
      const status = req.body?.status;
      const rawReason = req.body?.reason ?? req.body?.rejectionReason ?? "";
      if (typeof rawReason !== "string" || rawReason.length > 2000) {
        return void res.status(400).json({ message: "Use a reason of no more than 2000 characters." });
      }
      const reason = rawReason.trim();
      if (!["pending", "approved", "rejected", "suspended"].includes(status)) {
        return void res.status(400).json({ message: "Invalid vendor status." });
      }
      const vendor = await store.getVendor(vendorId);
      const applicant = vendor ? await store.getUser(vendor.userId) : undefined;
      if (!vendor || !applicant || !canReviewVendorApplication(actor, applicant)) {
        return void res.status(404).json({ message: "Vendor not found." });
      }
      if (status === "approved") {
        if (vendor.verificationStatus !== "verified" || !hasManualCacReview(vendor.verificationNotes)) {
          return void res.status(409).json({ message: "Complete a documented review using CAC Public Search before approval." });
        }
        // Rechecks current roles, email verification and CAC evidence under
        // row locks; this is not a general-purpose role-management permission.
        const updatedVendor = await approve(actorId, vendorId);
        await notify(vendor, applicant, status, reason).catch(() => console.error("Vendor decision email could not be queued."));
        return void res.json({ message: "Vendor status updated", vendor: vendorApplicationForReviewer(updatedVendor, applicant, actor!) });
      }
      await store.updateVendorStatus(vendorId, status);
      await notify(vendor, applicant, status, reason).catch(() => console.error("Vendor decision email could not be queued."));
      const updated = await store.getVendor(vendorId);
      res.json({ message: "Vendor status updated", vendor: updated ? vendorApplicationForReviewer(updated, applicant, actor!) : null });
    } catch (error) {
      if (error instanceof RoleManagementError) {
        return void res.status(error.status).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update vendor status." });
    }
  };
}

export const vendorStatusHandler = createVendorStatusHandler(storage, approveVendorWithRole, notifyVendorStatus);
