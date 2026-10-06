import type { RequestHandler } from "express";
import { storage } from "./storage";
import { canReviewVendorApplication, vendorApplicationForReviewer } from "./vendor-application-access";
import { hasSupportManagementAccess } from "../shared/admin-access";
import { hasManualCacReview } from "./cac-review";
import { approveVendorWithRole, RoleManagementError } from "./superadmin-role-management";

type VendorStore = Pick<typeof storage, "getUser" | "getVendor" | "updateVendorStatus">;

export function createVendorStatusHandler(store: VendorStore, approve: typeof approveVendorWithRole): RequestHandler {
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
        return void res.json({ message: "Vendor status updated", vendor: vendorApplicationForReviewer(updatedVendor, applicant, actor!) });
      }
      await store.updateVendorStatus(vendorId, status);
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

export const vendorStatusHandler = createVendorStatusHandler(storage, approveVendorWithRole);
