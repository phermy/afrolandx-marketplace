---
name: Resend sender domain
description: External Resend prerequisite for Afrolandx authentication email delivery
---

The sender domain configured for transactional authentication email must be verified in Resend before delivery tests or production troubleshooting. Resend can accept the connection and still reject every message when the domain is unverified.

**Why:** A live auth-flow check initially found the configured domain present but unverified; Resend rejected sends with a provider validation error rather than delivering them.

**How to apply:** Check the sender domain status in Resend before testing registration, sign-in-code, or password-reset mail. Keep the Afrolandx sender address; do not mask a configuration issue by switching to a provider test sender.