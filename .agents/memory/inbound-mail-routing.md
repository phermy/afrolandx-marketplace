---
name: Inbound mail routing
description: Distinguishes working outbound Resend delivery from broken inbound mail routing for the afrolandx.com domain.
---

Outbound email through Resend is working and can deliver successfully to external providers. Mail sent to addresses hosted on the afrolandx.com domain is rejected by the receiving server with an SMTP 554 5.7.1 “Relay access denied” response.

**Why:** Resend domain verification configures outbound sending but does not create mailboxes or configure inbound MX routing. Treating accepted Resend submissions as inbox delivery hid the separate receiving-domain problem.

**How to apply:** When testing authentication email, use an external working inbox until the domain’s mailbox provider and MX routing are repaired. Do not change the app’s Resend sender configuration to address this inbound rejection.