---
name: Vendor settlement accounting
description: Durable rules for marketplace commission, vendor balances, and payout safety.
---

AfrolandX commission is 8% of merchandise value only. Shipping is pass-through and must never enter commission or vendor earnings calculations. Vendor statements use immutable sale, refund, and chargeback entries rather than recalculating balances from current product or order data.

**Why:** Product prices can change after purchase, orders can contain several vendors, and refunds or chargebacks may happen after a settlement. A signed ledger preserves the original economics and makes each reversal auditable.

Provider money-movement outcomes are never assumed from a timeout, rate limit, or 5xx response. Refund claims and settlement entries stay locked until a signed webhook or explicit provider reconciliation confirms success, failure, or reversal. Provider references must be persisted before submission.

**Why:** A provider may commit a refund or transfer before the application receives a response. Releasing local balances after an ambiguous response can duplicate refunds or payouts.

**How to apply:** Create one sale entry per vendor only after verified payment, release it after delivery, allocate reversals proportionally by vendor merchandise value, reverse the associated commission, and settle only positive available entries to a verified Paystack recipient. Store only masked bank details locally. Reserve refunds before provider submission, finalize ledger reversals only after provider confirmation, and keep ambiguous operations unavailable for automatic retry.

Do not hard-delete a vendor or account with sale ledger entries solely because its vendor status is rejected or its login is unverified. Account closure must preserve the financial history.

**Why:** Vendor status and login eligibility do not erase prior sale, refund, or payout obligations; deleting ledger-linked records would destroy the audit trail.

**How to apply:** Check financial links in the live environment before account deletion. For linked accounts, review outstanding balances and use a separate access-revocation and personal-data minimization workflow instead of cascading deletion.

Verified test-mode records are a narrow exception: an explicitly approved cleanup may remove test orders, their ledger entries, and catalog data together if every provider reference is confirmed in the test domain and no real-money adjustment or settlement exists.

**Why:** The website can mark successful simulated charges as paid; these records are not real payments, but deleting them still changes other buyers' test order history.

**How to apply:** Show the full impact to an admin, verify every reference and refund status with the provider, require a fresh confirmation, and fail the entire transaction if dependencies or quote integrity change. Never infer test mode from local payment status or vendor rejection alone.