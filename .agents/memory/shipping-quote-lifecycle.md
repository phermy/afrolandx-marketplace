---
name: Shipping quote payment lifecycle
description: Policy for quote expiry, single use, and Paystack initialization failures.
---

Every configured shipping carrier requires a quote. Buyers may pay the merchandise subtotal while that quote is pending, then pay the confirmed shipping balance separately before fulfillment. Quotes remain tied to the buyer's exact cart and destination. Expiry is the deadline to begin the relevant Paystack payment, not a deadline for a callback already in flight. The server-calculated NGN amounts remain authoritative.

**Why:** Buyers should not wait for manual carrier confirmation before securing their goods, but vendors must not begin fulfillment before shipping is paid. Redirects can be lost, duplicate payment attempts can invalidate valid charges, and cancellation can race with payment; signed webhooks and atomic state transitions prevent stranded payments.

**How to apply:** Do not add fixed-price carrier checkout paths. Merchandise and shipping payments must use exact server amounts, references, metadata, and both callback and signed-webhook completion. Reuse an active shipping checkout, serialize it against cancellation, and gate every fulfillment/production path on shipping being included or paid.