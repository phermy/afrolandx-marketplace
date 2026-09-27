---
name: Account closure semantics
description: User-approved meaning of deleting accounts that have business records
---

For vendor, customer, or admin accounts with linked records, "delete user" means close account access, not erase transactions or business history. Keep a distinct permanent-deletion path only for truly unused accounts.

**Why:** The user explicitly chose blocking access while retaining orders, payouts, catalog history, and other linked records; deleting them could corrupt fulfillment and accounting.

**How to apply:** Future account-management changes should treat closed accounts as unable to sign in or gain new privileges, preserve historical references, and keep vendor listings unavailable for new purchases. Protect the acting Superadmin and designated owner.