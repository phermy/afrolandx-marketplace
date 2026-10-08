export class PaymentConfirmationError extends Error {
  constructor(message: string, public readonly pending: boolean) { super(message); }
}

export async function fetchPaymentConfirmation(orderId: string, reference: string, request: typeof fetch = fetch) {
  if (!/^[1-9]\d*$/.test(orderId) || !Number.isSafeInteger(Number(orderId)) || !reference) {
    throw new PaymentConfirmationError("Invalid confirmation link", false);
  }
  const response = await request(`/api/orders/${encodeURIComponent(orderId)}`, { credentials: "include" });
  if (!response.ok) throw new PaymentConfirmationError("Order confirmation unavailable", response.status >= 500);
  const order = await response.json();
  if (order.paymentReference !== reference) throw new PaymentConfirmationError("Payment reference does not match this order", false);
  if (order.paymentStatus !== "paid") {
    throw new PaymentConfirmationError("Payment confirmation is still pending", order.paymentStatus === "pending");
  }
  return order;
}
