---
name: Superadmin delegation safety
description: Security boundary for delegated superadmins and workflows that change account roles indirectly
---

Role mutations through business approvals must follow the same authorization boundary as direct role controls: check the acting superadmin's current verified status under row locks in the transaction that changes the target's roles. Protect the designated owner by identity, not just by whatever roles the account currently holds, and guard alternate deletion flows too.

**Why:** A role can be revoked between a preliminary permission check and a later approval write. Role-only owner guards also fail before startup seeding or if an alternate deletion path checks only the current role array.

**How to apply:** When adding an approval, account removal, or other workflow with role side effects, inspect both the direct and indirect paths. Keep owner and self-protection at the mutation point and make status and role changes atomic where they belong together.