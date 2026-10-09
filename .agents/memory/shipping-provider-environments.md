---
name: Shipping provider environments
description: Keep carrier sandbox credentials and prices isolated from customer payments
---

Never switch a customer checkout to a shipping provider's sandbox when live authentication fails. Sandbox authentication does not establish live shipping access.

**Why:** Terminal Africa accepted a test credential on sandbox while rejecting it on live. Using sandbox rates as a fallback would let customers pay for services that have not been confirmed in the real carrier environment.

**How to apply:** Verify live access through a read-only authenticated endpoint before enabling a backup provider. Use sandbox only for explicitly isolated tests, never customer rates, labels, bookings or tracking. If live access fails, keep that provider unavailable and preserve the working primary provider.

Do not repeat secure-key replacement forms indefinitely after authentication fails. Confirm the correct dashboard field and check an account-specific endpoint, then report the remaining authentication block without assuming the user copied the wrong key.

**Why:** Terminal Africa can return HTTP 401 for an account verification gate, not just an invalid key. Its explicit response can be "Complete KYC verification to access the API."

**How to apply:** Inspect a safely redacted provider error message before diagnosing a 401 or requesting another key. Keep diagnostics read-only and avoid displaying credentials or account details. A saved secret and a dashboard showing live keys do not prove the provider accepts live API requests. Provider account verification must be completed directly with the provider, not by changing marketplace vendor approval gates.
