---
name: Superadmin delegation safety
description: Superadmin-only management visibility, limited Admin support scope, and indirect role changes
---

Direct role controls require a verified Superadmin. Vendor approval is the user's explicit exception: a verified Admin may approve a reviewed vendor and add only the vendor role, preserving every existing role. Check the actor's current authorization under row locks in the transaction that changes the target's roles. Protect the designated owner by identity, not just by whatever roles the account currently holds, and guard alternate deletion flows too.

**Why:** A role can be revoked between a preliminary permission check and a later approval write. Role-only owner guards also fail before startup seeding or if an alternate deletion path checks only the current role array.

**How to apply:** When adding an approval, account removal, or other workflow with role side effects, inspect both the direct and indirect paths. Keep owner and self-protection at the mutation point and make status and role changes atomic where they belong together. Ordinary Admins cannot use vendor approval on another administrator's account or turn this exception into general role management.

**Why for the exception:** The user explicitly asked that Admins be allowed to approve vendors. Keep email verification and documented CAC review required.

Full management is for verified Superadmins only. Ordinary Admins see customer and vendor support issues only, not other administrators' accounts or activity in User Management. Treat accounts with Admin or Superadmin roles as staff even when they also have customer or vendor roles. Ordinary Admins cannot inspect these profiles through direct links or use full platform, finance, agency-management, role-management, or account-deletion controls.

**Why:** The user explicitly asked that only Superadmins see the full management dashboard and that Admins not see what other Admins do in User Management.

**How to apply:** Keep customer/vendor support and reviewed non-staff vendor approvals available to Admins. Enforce staff privacy and full-management restrictions on the server, not just by hiding navigation. Keep protected owner identity safeguards even if their role array has not been seeded.