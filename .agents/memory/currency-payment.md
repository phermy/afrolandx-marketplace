---
name: Currency & payment model
description: Afrolandx stores all prices in NGN (Naira). Payment via Paystack always in NGN. Detailed fixes applied.
---

## Rule
All product prices are stored in **NGN (Nigerian Naira)**. Never treat `product.price` as USD. Always charge Paystack in NGN. Never multiply cart totals by an exchange rate for payment.

**Why:** The codebase originally had broken currency handling that treated Naira prices as USD (e.g., ₦60,500 displayed as "$60,500" and multiplied by ~1800 NGN/USD rate = ₦108,900,000 overcharge).

## How to apply
- `formatPrice` anywhere should use ₦ symbol: `` `₦${parseFloat(price).toLocaleString()}` ``
- `LocalPrice` component (useCurrency hook) should NOT be used for product prices — it treats input as USD and converts to local currency, giving wrong results for Naira prices
- Checkout `handleSubmit` sends `currency: 'NGN'` and `totalAmount` as the raw Naira sum (no multiplication)
- `server/routes.ts` `/api/orders/initialize-payment`: `chargeCurrency = 'NGN'`, `chargeAmount = parseFloat(totalAmount)` — no currency conversion
- Paystack's `initializeTransaction` multiplies by 100 for kobo internally — pass Naira amount directly
- Shipping prices in `/api/shipping/quote` are in NGN: UPS ₦15,000, FedEx ₦25,000, DHL ₦40,000

## Payment callback flow (normal path)
1. POST `/api/orders/initialize-payment` → creates order + returns Paystack URL
2. User pays on Paystack → redirects to GET `/api/payment/callback`
3. Callback verifies payment → updates order → clears cart → reduces stock → awards loyalty points → redirects to `/order-success?order_id=...&reference=...`
4. POST `/api/orders/verify-payment` is an alternative manual verify route (not used in normal flow)

## Loyalty points
Awarded in GET `/api/payment/callback` (after fix): `Math.floor(parseFloat(order.totalAmount))` = 1 point per ₦1 spent.
