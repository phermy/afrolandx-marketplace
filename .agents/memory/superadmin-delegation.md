---
name: Superadmin delegation safety
description: Security boundary for delegated superadmins and workflows that change account roles indirectly
---

Direct role controls require a verified Superadmin. Vendor approval is the user's explicit exception: a verified Admin may approve a reviewed vendor and add only the vendor role, preserving every existing role. Check the actor's current authorization under row locks in the transaction that changes the target's roles. Protect the designated owner by identity, not just by whatever roles the account currently holds, and guard alternate deletion flows too.

**Why:** A role can be revoked between a preliminary permission check and a later approval write. Role-only owner guards also fail before startup seeding or if an alternate deletion path checks only the current role array.

**How to apply:** When adding an approval, account removal, or other workflow with role side effects, inspect both the direct and indirect paths. Keep owner and self-protection at the mutation point and make status and role changes atomic where they belong together. Ordinary Admins cannot use vendor approval on another administrator's account or turn this exception into general role management.

**Why for the exception:** The user explicitly asked that Admins be allowed to approve vendors. Keep email verification and documented CAC review required.