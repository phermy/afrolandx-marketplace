type OrderAmounts = {
  totalAmount: string | number;
  shippingPaymentStatus?: string | null;
  shippingAmount?: string | number | null;
  shippingEstimatedAmount?: string | number | null;
  shippingFinalAmount?: string | number | null;
  shippingRefundAmount?: string | number | null;
  shippingRefundStatus?: string | null;
};

const money = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
};

// totalAmount is the original checkout charge, including any shipping deposit.
// shippingAmount is a separate balance only when a final quote has been set.
export function orderPaidTotal(order: OrderAmounts): number {
  const additionalShipping = order.shippingPaymentStatus === "paid"
    && order.shippingFinalAmount != null
    ? money(order.shippingAmount)
    : 0;
  const refundedShipping = ["processed", "success", "successful"].includes(order.shippingRefundStatus || "")
    ? money(order.shippingRefundAmount)
    : 0;
  return Math.max(0, money(order.totalAmount) + additionalShipping - refundedShipping) / 100;
}
