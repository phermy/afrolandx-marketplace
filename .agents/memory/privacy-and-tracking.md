---
name: Privacy and optional tracking
description: Consent requirement before adding analytics and password safety availability tradeoff
---

Plan a consent banner before adding analytics. Do not treat removing an injected
tracking script after execution as prior consent.

**Why:** The user explicitly asked to plan a consent banner before adding analytics.

**How to apply:** Verify the actual publishing-time injection mechanism and block
optional scripts, storage and events until consent before enabling tracking. Existing
event-call helpers do not by themselves establish that a tracking service is enabled.

Breached-password checks apply when setting a password, not as a new restriction on
every legacy sign-in. If the lookup is unavailable, return a retryable error rather
than silently accepting an unchecked new password.

**Why:** Rejecting breached passwords requires the check to succeed; changing legacy
sign-in rules would unnecessarily change access for existing accounts.

**How to apply:** Preserve email verification and guest custody gates independently
of password-check or email-provider availability.
