---
name: Live vendor testing
description: Consent and account-state boundaries for testing real vendor pages without changing business records
---

Do not approve, reactivate, or change account roles merely to make a vendor test possible. Verify the target environment's account status first, and use a currently approved vendor with an inbox the user authorizes.

**Why:** These launch checks must not alter existing QA or business records. An account supplied for testing can be suspended in production even when the user expects an approved vendor.

**How to apply:** For approved-vendor testing, stop before signing in if the account is suspended or missing. Obtain another approved account rather than weakening the approval gate. Before using an existing account, explain that normal sign-in replaces its current active session. Keep sign-in codes and session cookies out of logs, and block browser API mutations during layout checks.
