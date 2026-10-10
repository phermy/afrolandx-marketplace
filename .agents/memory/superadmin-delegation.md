---
name: Superadmin delegation safety
description: Superadmin-only management visibility, limited Admin support scope, and indirect role changes
---

Direct role controls require a verified Superadmin. Vendor approval is the user's explicit exception: a verified Admin may approve a reviewed vendor, including a business owned by another ordinary Admin, and add only the vendor role, preserving every existing role. Check the actor's current authorization under row locks in the transaction that changes the target's roles. Protect the designated owner by identity, not just by whatever roles the account currently holds, and guard alternate deletion flows too.

**Why:** A role can be revoked between a preliminary permission check and a later approval write. Role-only owner guards also fail before startup seeding or if an alternate deletion path checks only the current role array.

**How to apply:** When adding an approval, account removal, or other workflow with role side effects, inspect both the direct and indirect paths. Keep owner and self-protection at the mutation point and make status and role changes atomic where they belong together. Ordinary Admins cannot approve a Superadmin-owned business or use vendor approval as general role management; they may review an ordinary Admin-owned *business application* without accessing the owner's staff profile.

**Why for the exception:** The user explicitly confirmed that Admins should also approve other Admin-owned vendors. Keep email verification and documented CAC review required; this is limited to vendor-business approval, not Superadmin businesses or staff-profile access.

Full platform management is for verified Superadmins only. Ordinary Admins see customer and vendor support issues and have full shipping-operations access, but do not see other administrators' accounts or activity in User Management. Treat accounts with Admin or Superadmin roles as staff even when they also have customer or vendor roles. Ordinary Admins cannot inspect these profiles through direct links or use full platform, finance administration, role-management, or account-deletion controls.

**Why:** The user explicitly asked that only Superadmins see the full management dashboard and that Admins not see what other Admins do in User Management.

**How to apply:** Keep customer/vendor support and reviewed vendor approvals available to Admins, including other ordinary Admin-owned business applications. Show only necessary business data and verification booleans for such applications; never expose the owner's staff profile, private contact, past reviewer notes, or general role controls. Enforce staff privacy and full-management restrictions on the server, not just by hiding navigation. Keep protected owner identity safeguards even if their role array has not been seeded.

All verified, active Admins have full shipping-operations access, including agency management, partner invitations, all shipment assignments, quote review, bookings, tracking, package splits, and records of agency payments. Shipping customer quotes are operational records even when the buyer is a staff member; expose only necessary contact and delivery information, not their private staff profile.

**Why:** The user explicitly asked to "allow admin full to shippings operations" and to let Admins review vendor requests and approve them.

**How to apply:** Recheck current verified roles at operational reads and locked writes. Do not require Superadmin for shipping, or expand unrelated finance and role permissions. Retain documented CAC review and verified applicant email for vendor approvals.

All verified Admins may review and approve every submitted vendor product, including products whose vendor owner also has staff roles. That permits product and public business details, not access to the vendor owner's private staff profile.

**Why:** The user explicitly asked for all Admins to approve all products submitted by vendors and to click through customer/vendor contact information, purchase history and products sold. Staff-profile privacy and Superadmin-only full management remain separate restrictions.

**How to apply:** Apply listing-quality and approved/verified-vendor requirements consistently to every reviewer. Keep unapproved products hidden publicly; use authenticated staff previews rather than opening pending products to shoppers. Show the actual reason when a listing fails approval instead of a generic error.