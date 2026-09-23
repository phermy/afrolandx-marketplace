---
name: Inbound mail routing
description: Distinguishes working outbound Resend delivery from recipient-specific Titan inbound failures.
---

Outbound email through Resend can deliver successfully to external providers. Some mail addressed to afrolandx.com previously received SMTP 554 5.7.1 “Relay access denied”. On 2026-09-23 the user confirmed support receives messages in Titan, including a feedback-notification test from the development workspace. An earlier report that info also received test messages was explicitly corrected by the user: info is not receiving. Do not generalize the support result to every address on the domain.

**Why:** Resend domain verification configures outbound sending but does not create mailboxes. Titan's published reject-code guidance says 554 5.7.1 relay access denied can mean the *recipient address* does not exist. Treating accepted Resend submissions as inbox delivery hid the separate recipient problem.

**How to apply:** When testing authentication email, use a confirmed working inbox; inspect info and any other failing Titan recipient as a mailbox or alias individually. The public site advertises info as a contact address, while outgoing app email uses support as the reply address. Keep root-domain Titan MX and the verified Resend sender configuration intact. A Resend accepted response is not proof of inbox arrival.

**Rule:** A successful email test from the development workspace does not show what the published site sends until the site is republished after the code change.
**Why:** The live feedback form kept sending to its old recipient after a later workspace change; the most recent publish preceded that change.
**How to apply:** Compare publish timing with workspace changes before diagnosing a second email path or editing working routing again.