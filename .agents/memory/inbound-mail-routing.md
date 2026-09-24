---
name: Inbound mail routing
description: Distinguishes working outbound Resend delivery from recipient-specific Titan inbound failures.
---

Outbound email through Resend can deliver successfully to external providers. Some mail addressed to afrolandx.com previously received SMTP 554 5.7.1 “Relay access denied”. On 2026-09-23 the user confirmed support receives messages in Titan, including a feedback-notification test from the development workspace. The user then reported info was not receiving, but confirmed receipt after a new direct Resend test to info was marked delivered. Both addresses have inbox-level confirmation as of that test; do not generalize these results to other addresses or the published site's email flows.

**Why:** Resend domain verification configures outbound sending but does not create mailboxes. Titan's published reject-code guidance says 554 5.7.1 relay access denied can mean the *recipient address* does not exist. Treating accepted Resend submissions as inbox delivery hid the separate recipient problem.

**How to apply:** When testing authentication email, use a confirmed working inbox; inspect any newly failing Titan recipient as a mailbox or alias individually. The public site advertises info as a contact address, while outgoing app email uses support as the reply address. Keep root-domain Titan MX and the verified Resend sender configuration intact. A Resend accepted or delivered response alone is not proof of inbox arrival; ask for recipient confirmation.

**Rule:** A successful email test from the development workspace does not show what the published site sends until the site is republished after the code change.
**Why:** The live feedback form kept sending to its old recipient after a later workspace change; the most recent publish preceded that change.
**How to apply:** Compare publish timing with workspace changes before diagnosing a second email path or editing working routing again.

**Rule:** Give Titan-only diagnostics and configuration requests as a concise handoff to the Titan administrator, rather than asking the requester to manage that account.
**Why:** The requester explicitly said they are not the person managing Titan.
**How to apply:** For missing external deliveries, ask the administrator for the outbound SMTP delivery trace and DKIM verification status; do not request account credentials or suggest speculative DNS changes.