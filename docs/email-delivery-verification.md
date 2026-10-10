# Authentication email delivery verification

## Scope

This check validates the Afrolandx authentication flows against an externally hosted test inbox. It covers registration verification, email-code login, and password reset. It does not claim that mailboxes hosted on `afrolandx.com` receive mail: that domain has a separate inbound MX/relay-routing issue and remains an operational follow-up.

## Reproducible check

Use a fresh externally hosted inbox or provider-supported plus-address. Do not commit the address or any one-time code.

```bash
AUTH_E2E_EMAIL='fresh-test-inbox@example.com' npm run test:auth-email-e2e
```

The script uses the existing Resend connection and the running app. It waits for each matching message to reach Resend's `delivered` event, consumes the code through the application API, verifies one-time-use behavior, and checks that password reset invalidates the previous session.

The controlled send-failure safety check does not call Resend:

```bash
npm run test:auth-email-safety
```

It forces verification-email delivery to fail inside the registration handler and asserts that the response reports the failed delivery without issuing a session cookie or invoking login.

## Successful verification

The end-to-end run completed on 2026-08-29 using an externally hosted Gmail test inbox:

- Resend reported `verified` for `afrolandx.com`.
- Verification, sign-in-code, and password-reset messages were delivered from `Afrolandx <noreply@afrolandx.com>`.
- Registration did not create an authenticated session before verification.
- Verification and email-code login accepted their delivered codes.
- Reusing the consumed sign-in code returned HTTP 400.
- Password reset accepted its delivered code, invalidated the prior session, rejected the original password, and allowed password login with a distinct new password.
- A controlled registration delivery failure returned `emailVerificationSent: false` without issuing a session cookie or invoking login.

Resend's `delivered` event confirms handoff to the recipient provider. Inbox placement for `@afrolandx.com` recipients still depends on that domain's mailbox provider and MX configuration.