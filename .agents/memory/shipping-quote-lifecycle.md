---
name: Shipping quote payment lifecycle
description: Policy for quote expiry, single use, and Paystack initialization failures.
---

Every configured shipping carrier requires a confirmed quote before payment, including UPS, FedEx, and DHL. Quotes are single-use and tied to the buyer's exact cart and destination. Expiry is the deadline to successfully begin Paystack payment, not a deadline for a callback that is already in flight. Once payment initialization succeeds, the order's server-calculated NGN total remains authoritative.

**Why:** Rechecking quote expiry after a valid payment session starts can reject delayed callbacks, while allowing reuse can create multiple payable orders. A provider initialization failure must not consume the quote or leave an incomplete order.

**How to apply:** Do not add fixed-price carrier checkout paths. Any checkout change must reserve a confirmed quote and create the complete order atomically, consume it only after Paystack returns a checkout session, and restore it if initialization fails.