---
name: Vendor settlement accounting
description: Durable rules for marketplace commission, vendor balances, and payout safety.
---

AfrolandX commission is 8% of merchandise value only. Shipping is pass-through and must never enter commission or vendor earnings calculations. Vendor statements use immutable sale, refund, and chargeback entries rather than recalculating balances from current product or order data.

**Why:** Product prices can change after purchase, orders can contain several vendors, and refunds or chargebacks may happen after a settlement. A signed ledger preserves the original economics and makes each reversal auditable.

**How to apply:** Create one sale entry per vendor only after verified payment, release it after delivery, allocate reversals proportionally by vendor merchandise value, reverse the associated commission, and settle only positive available entries to a verified Paystack recipient. Store only masked bank details locally.