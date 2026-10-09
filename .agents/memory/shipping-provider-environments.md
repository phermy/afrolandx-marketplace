---
name: Shipping provider environments
description: Keep carrier sandbox credentials and prices isolated from customer payments
---

Never switch a customer checkout to a shipping provider's sandbox when live authentication fails. Sandbox authentication does not establish live shipping access.

**Why:** Terminal Africa accepted a test credential on sandbox while rejecting it on live. Using sandbox rates as a fallback would let customers pay for services that have not been confirmed in the real carrier environment.

**How to apply:** Verify live access through a read-only authenticated endpoint before enabling a backup provider. Use sandbox only for explicitly isolated tests, never customer rates, labels, bookings or tracking. If live access fails, keep that provider unavailable and preserve the working primary provider.

Do not repeat secure-key replacement forms indefinitely after authentication fails. Confirm the correct dashboard field and check an account-specific endpoint, then report the remaining authentication block without assuming the user copied the wrong key.

**Why:** Multiple credential replacements and a screenshot of the correct live secret-key field did not explain repeated unauthorized responses.

**How to apply:** Keep diagnostics read-only and avoid displaying credentials or account details. A saved secret and a dashboard showing live keys do not prove the provider accepts live API requests.
