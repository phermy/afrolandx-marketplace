export const UNPAID_CHECKOUT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function unpaidCheckoutExpired(order: {
  paymentStatus?: string | null;
  createdAt?: string | Date | null;
}, now = Date.now()): boolean {
  if (order.paymentStatus !== "pending" || !order.createdAt) return false;
  const created = new Date(order.createdAt).getTime();
  return Number.isFinite(created) && created + UNPAID_CHECKOUT_LIFETIME_MS <= now;
}

export function checkoutTotal(subtotal: number, shipping: number): number {
  if (![subtotal, shipping].every(value => Number.isFinite(value) && value >= 0)) {
    throw new Error("Checkout amounts must be finite and nonnegative");
  }
  const kobo = Math.round(subtotal * 100) + Math.round(shipping * 100);
  if (!Number.isSafeInteger(kobo)) throw new Error("Checkout amount exceeds the supported range");
  return kobo / 100;
}
