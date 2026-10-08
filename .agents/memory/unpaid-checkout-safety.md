---
name: Unpaid checkout safety
description: Why checkout closure requires provider verification and holds late payments for review.
---

Use a 24-hour window for unpaid checkout expiry. Keep order records and the buyer's cart; verify Paystack before treating a referenced transaction as unpaid. An unavailable, ambiguous or processing provider response is not evidence of nonpayment.

**Why:** Payment notifications can arrive late. A locally pending order may already have been paid, and closing it without checking could interrupt a legitimate purchase.

**How to apply:** Confirm exact reference, NGN amount and order ownership before processing a successful provider transaction. Only conclusively unpaid attempts may expire or be cancelled. A valid charge arriving after closure must remain recorded and held for review, without automatic fulfillment, vendor earnings, cart clearing or refund.

Ordinary status changes must not reopen closed checkouts or clear payment review holds.

**Why:** Reopening a closed order can bypass inventory reservation and settlement accounting. A late payment needs an explicit financial resolution, not an unrestricted status edit.

**How to apply:** Keep future staff review tools separate from ordinary order status controls and require a safe, auditable reconciliation or refund decision.
