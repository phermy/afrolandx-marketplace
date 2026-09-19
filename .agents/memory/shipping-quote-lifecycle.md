---
name: Shipping quote payment lifecycle
description: Policy for quote expiry, single use, and Paystack initialization failures.
---

Every configured carrier requires a final quote, but testing checkout may charge merchandise plus a server-generated shipping estimate immediately. The order stays held until the final quote is reconciled: collect only a positive balance or queue an exact refund for an overestimate. Quotes remain tied to the buyer's exact cart and destination.

**Why:** Buyers need to test payment without waiting for manual carrier confirmation, while payment differences must never overcharge them or let fulfillment start early. Quote decisions, payment attempts, cancellation, and refund retries can race, so cross-row locking and durable reconciliation are required.

**How to apply:** Keep estimates server-controlled and stored separately from final price, balance, and refund state. A successful main payment moves the order to active preparation immediately; block dispatch, not preparation, until final shipping reconciliation. Use the shared quote-ID advisory lock for admin decisions and shipping-payment claims, and recover uncertain refunds by querying Paystack before retrying.

Checkout initialization is idempotent across both the database and Paystack. Persist an explicit initialization state and never initialize the same checkout request or payment reference twice; reconcile the original reference with Paystack instead.

**Why:** Provider acceptance can race database persistence, browser retries, callbacks, and cleanup. Retrying initialization risks duplicate charges, while unlocked cleanup can delete an order that became paid concurrently.

**How to apply:** Create orders and items atomically. Return paid orders as idempotent success, verify initializing/uncertain references before deciding what to do, and lock pending orders before failure cleanup removes their items or releases a reserved quote.