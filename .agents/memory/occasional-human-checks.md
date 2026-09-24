---
name: Occasional human checks
description: User preference and rationale for periodic human verification across Afrolandx.
---

The user chose occasional human verification while using the site rather than a check limited to registration or sign-in. Keep the challenge server verified, but let people continue reading public pages if they postpone it; require verification for state-changing actions when due.

**Why:** A fake checkbox does not deter bots, while a mandatory check on every page visit interrupts browsing. Payment-provider callbacks and sign-out must remain available independently of a visitor's challenge state.

**How to apply:** When adding new state-changing routes or changing authentication and payment flows, preserve the distinction between browser actions and external service callbacks. Do not silently switch to login-only verification.