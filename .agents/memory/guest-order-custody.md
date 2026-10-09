---
name: Guest order custody
description: Why guest buyers retain anonymous custodial identities and immutable payment ownership
---

Guest checkout must remain unauthenticated. Anonymous buyer records preserve order custody, not account permissions. Creating an account after payment must still require normal email verification and matching checkout contact ownership.

**Why:** Existing orders and financial histories depend on a non-null buyer identity. Anonymous custodial identities preserve those relationships without a broad financial migration or automatic signup verification.

**How to apply:** Do not authenticate or verify a guest identity. Claim only paid orders for a verified matching account with proof of guest custody. Preserve the payment's original owner when account ownership changes so later provider verification and replay handling remain valid.
