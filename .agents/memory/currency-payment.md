---
name: Currency & payment model
description: Afrolandx stores and charges all prices in NGN; every paid feature must use a server-derived amount and strict Paystack verification.
---

## Rule
All product and service prices are stored in **NGN (Nigerian Naira)**. Never treat `product.price` as USD. Always charge Paystack in NGN. Never multiply cart totals by an exchange rate for payment. For every paid feature, derive the payable amount on the server and verify exact reference, amount, currency, ownership metadata, and customer identity before granting access.

**Why:** The codebase previously risked both currency-conversion overcharges and client-controlled service prices. Strict server pricing and verification prevent underpayment, cross-record activation, and access being granted after an unmatched transaction.

## How to apply
- `formatPrice` anywhere should use ₦ symbol: `` `₦${parseFloat(price).toLocaleString()}` ``
- `LocalPrice` component (useCurrency hook) should NOT be used for product prices — it treats input as USD and converts to local currency, giving wrong results for Naira prices
- Checkout `handleSubmit` sends `currency: 'NGN'` and `totalAmount` as the raw Naira sum (no multiplication)
- `server/routes.ts` `/api/orders/initialize-payment`: `chargeCurrency = 'NGN'`, `chargeAmount = parseFloat(totalAmount)` — no currency conversion
- Paystack's `initializeTransaction` multiplies by 100 for kobo internally — pass Naira amount directly
- International shipping rates are confirmed quotes in NGN. Estimates are deposits, not final carrier prices.
- Discover bookings and Premium access follow the same server-priced, exact-match verification rule as product orders.

## Payment callback flow (normal path)
1. POST `/api/orders/initialize-payment` → creates order + returns Paystack URL
2. User pays on Paystack → redirects to GET `/api/payment/callback`
3. Callback verifies payment → updates order → clears cart → reduces stock → awards loyalty points → redirects to `/order-success?order_id=...&reference=...`
4. POST `/api/orders/verify-payment` is an alternative manual verify route (not used in normal flow)
