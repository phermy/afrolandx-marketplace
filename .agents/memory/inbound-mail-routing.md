---
name: Inbound mail routing
description: Distinguishes working outbound Resend delivery from recipient-specific Titan inbound failures.
---

Outbound email through Resend can deliver successfully to external providers. Some mail addressed to afrolandx.com previously received SMTP 554 5.7.1 “Relay access denied”. On 2026-09-23 the user confirmed that both the support and info mailboxes receive mail in Titan, including new Resend test messages delivered to each address. The user also confirmed receipt of a feedback-notification test sent through the application's email sender to the support mailbox. Do not generalize earlier failures to every address on the domain.

**Why:** Resend domain verification configures outbound sending but does not create mailboxes. Titan's published reject-code guidance says 554 5.7.1 relay access denied can mean the *recipient address* does not exist. Treating accepted Resend submissions as inbox delivery hid the separate recipient problem.

**How to apply:** When testing authentication email, use a confirmed working inbox; inspect any failing Titan recipient as a mailbox or alias individually. Keep root-domain Titan MX and the verified Resend sender configuration intact. A Resend accepted response is not proof of inbox arrival.