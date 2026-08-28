---
name: Auth availability vs verification
description: Security boundary to preserve when transactional email is unavailable
---

Email delivery failures must leave new accounts unverified and unauthenticated. Do not weaken the email-verification gate or auto-login a new account as a workaround for a provider outage.

**Why:** A delivery-repair follow-up once replaced verification with password-only signup, which turned an external availability issue into an authentication security regression.

**How to apply:** Keep registration outcomes truthful, clear unusable OTP challenges after failed delivery, and treat provider repair as separate operational work.