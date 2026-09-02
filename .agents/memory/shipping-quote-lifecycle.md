---
name: Shipping quote payment lifecycle
description: Policy for quote expiry, single use, and Paystack initialization failures.
---

Every configured carrier requires a final quote, but testing checkout may charge merchandise plus a server-generated shipping estimate immediately. The order stays held until the final quote is reconciled: collect only a positive balance or queue an exact refund for an overestimate. Quotes remain tied to the buyer's exact cart and destination.

**Why:** Buyers need to test payment without waiting for manual carrier confirmation, while payment differences must never overcharge them or let fulfillment start early. Quote decisions, payment attempts, cancellation, and refund retries can race, so cross-row locking and durable reconciliation are required.

**How to apply:** Keep estimates server-controlled and stored separately from final price, balance, and refund state. Use the shared quote-ID advisory lock for admin decisions and shipping-payment claims. Recover uncertain refunds by querying Paystack before retrying, and gate all fulfillment until reconciliation completes.