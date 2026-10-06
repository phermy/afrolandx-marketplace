import assert from "node:assert/strict";
import test from "node:test";
import { canReviewVendorApplication, vendorApplicationForReviewer } from "./vendor-application-access";
import { CAC_REVIEW_MARKER } from "./cac-review";
import { DESIGNATED_OWNER_EMAIL } from "./admin-role-bootstrap";

const admin = { id: "reviewer", emailVerified: true, roles: ["customer", "admin"] };
const superadmin = { id: "lead", emailVerified: true, roles: ["admin", "superadmin"] };
const staffApplicant = { id: "other-admin", email: "other@example.test", emailVerified: true, roles: ["customer", "admin"] };
const staffBusiness = {
  id: 12, userId: "other-admin", businessName: "Staff-owned makers", description: "Woven goods",
  status: "pending", verificationStatus: "verified", cacNumber: "RC-123",
  verificationNotes: `${CAC_REVIEW_MARKER}\nReviewed by private-staff-id`,
  contactName: "Private staff contact", phone: "Private staff phone",
  createdAt: new Date(),
};

test("verified Admins can review another ordinary Admin's business, but not their profile or a Superadmin's business", () => {
  assert.equal(canReviewVendorApplication(admin, staffApplicant), true);
  assert.equal(canReviewVendorApplication(admin, { ...staffApplicant, roles: ["admin", "superadmin"] }), false);
  assert.equal(canReviewVendorApplication(admin, { ...staffApplicant, email: DESIGNATED_OWNER_EMAIL }), false);
  assert.equal(canReviewVendorApplication({ ...admin, emailVerified: false }, staffApplicant), false);
  assert.equal(canReviewVendorApplication({ ...admin, closedAt: new Date() }, staffApplicant), false);
  assert.equal(canReviewVendorApplication(superadmin, staffApplicant), true);

  const view = vendorApplicationForReviewer(staffBusiness as any, staffApplicant, admin);
  assert.equal(view.staffOwned, true);
  assert.equal(view.cacReviewComplete, true);
  assert.equal(view.applicantEmailVerified, true);
  assert.equal(view.businessName, "Staff-owned makers");
  for (const secret of ["userId", "user", "verificationNotes", "contactName", "phone", "email", "roles"]) {
    assert.equal(Object.hasOwn(view, secret), false, `${secret} must not be in the Admin's business view`);
  }
  assert.equal(vendorApplicationForReviewer(staffBusiness as any, staffApplicant, superadmin).staffOwned, false);
});
