---
name: Shipping checkout requirements
description: Aggregator checkout requirements replacing manual shipping estimates and deposits.
---

New checkout must use shipping aggregator API rates, delivery dates, labels and tracking instead of manual quotes. Compare Shipbubble and Terminal Africa, use one as primary and keep the other as backup. Show 2 to 3 genuine shipping options with a price and expected date, and charge one complete total with no deposit.

**Why:** The user replaced the earlier temporary testing-deposit model with marketplace aggregator checkout and asked to remove the test shipping option and “Testing mode” banner from shopper view.

**How to apply:** Bind final server-priced rates to the exact cart, destination and package details. Do not relabel a manual estimate as an API rate or a final total. Preserve historical quote, balance and refund records; the new direction does not authorize deleting old obligations. A carrier response must establish the complete payable amount before payment.

Checkout must stay pay-first with no cash on delivery. For UK, US and Canada, require DDP with duties paid up front. Offer guest checkout with account creation after payment, and show the full total from the first checkout view. Vendors must see only paid orders, with shipping status on their Orders tab. Require a tracking number before an order can be marked shipped.

**Why:** These are the user's explicit checkout and shipping requirements.

**How to apply:** Derive the complete total on the server and verify payment before fulfillment. Never label a service DDP without provider confirmation of prepaid duties. Show that a final total is unavailable while required address or rate data is missing, rather than displaying a merchandise subtotal as the full total. Preserve approval and authentication boundaries while implementing guest ownership and optional post-payment account creation.