---
name: Vendor settlement accounting
description: Durable rules for marketplace commission, vendor balances, and payout safety.
---

AfrolandX commission is 8% of merchandise value only. Shipping is pass-through and must never enter commission or vendor earnings calculations. Vendor statements use immutable sale, refund, and chargeback entries rather than recalculating balances from current product or order data.

**Why:** Product prices can change after purchase, orders can contain several vendors, and refunds or chargebacks may happen after a settlement. A signed ledger preserves the original economics and makes each reversal auditable.

Provider money-movement outcomes are never assumed from a timeout, rate limit, or 5xx response. Refund claims and settlement entries stay locked until a signed webhook or explicit provider reconciliation confirms success, failure, or reversal. Provider references must be persisted before submission.

**Why:** A provider may commit a refund or transfer before the application receives a response. Releasing local balances after an ambiguous response can duplicate refunds or payouts.

**How to apply:** Create one sale entry per vendor only after verified payment, release it after delivery, allocate reversals proportionally by vendor merchandise value, reverse the associated commission, and settle only positive available entries to a verified Paystack recipient. Store only masked bank details locally. Reserve refunds before provider submission, finalize ledger reversals only after provider confirmation, and keep ambiguous operations unavailable for automatic retry.