import type { Vendor } from "../shared/schema";
import type { ManagementAccount } from "../shared/admin-access";
import { hasFullManagementAccess, hasSupportManagementAccess, isAdministratorAccount, isCustomerOrVendorAccount } from "../shared/admin-access";
import { isDesignatedOwnerEmail } from "./admin-role-bootstrap";
import { hasManualCacReview } from "./cac-review";

type Applicant = ManagementAccount & { email?: string | null };

// Vendor applications are business records, not permission to read the
// owner's staff profile or modify their other roles.
export function canReviewVendorApplication(actor: ManagementAccount | null | undefined, applicant: Applicant | null | undefined): boolean {
  if (!hasSupportManagementAccess(actor) || !applicant) return false;
  if (hasFullManagementAccess(actor)) return true;
  if (isDesignatedOwnerEmail(applicant.email)) return false;
  if (Array.isArray(applicant.roles) && applicant.roles.includes("superadmin")) return false;
  return isCustomerOrVendorAccount(applicant) || isAdministratorAccount(applicant);
}

export function vendorApplicationForReviewer(vendor: Vendor, applicant: Applicant, actor: ManagementAccount) {
  const cacReviewComplete = hasManualCacReview(vendor.verificationNotes);
  if (hasFullManagementAccess(actor) || !isAdministratorAccount(applicant)) {
    return { ...vendor, cacReviewComplete, applicantEmailVerified: Boolean(applicant.emailVerified), staffOwned: false };
  }
  // Only business data and verification booleans go to another Admin.
  return {
    id: vendor.id, businessName: vendor.businessName, description: vendor.description,
    status: vendor.status, verificationStatus: vendor.verificationStatus,
    cacNumber: vendor.cacNumber, createdAt: vendor.createdAt,
    cacReviewComplete, applicantEmailVerified: Boolean(applicant.emailVerified), staffOwned: true,
  };
}
