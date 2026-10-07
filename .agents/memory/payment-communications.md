---
name: Payment communications
description: Standing scope for finance email routing and recipient privacy
---

Use the dedicated payments mailbox for all payment-related emails: sender, reply/support contact, and internal alerts. Keep authentication, general support, and non-financial shipping emails on their existing addresses.

**Why:** The user explicitly chose both sender/support contact and internal alerts when configuring the payments mailbox.

**How to apply:** Apply this scope to new checkout, shipping charge, refund, vendor payout, and agency-payment flows. Customer receipts and Paystack payer identities must still belong to the actual customer, not the business mailbox. Sending mail must not change an already accepted financial outcome. Provider acceptance is not confirmation that the mailbox received it.
