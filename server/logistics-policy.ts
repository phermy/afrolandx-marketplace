import { shipmentTransitions, type ShipmentStatus } from "../shared/logistics";

export class LogisticsError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export type LogisticsSource = "admin" | "partner" | "vendor" | "customer" | "system";
export function assertShipmentTransition(
  current: ShipmentStatus, next: ShipmentStatus, source: LogisticsSource,
  correction: boolean, reason?: string,
) {
  if (source === "vendor") {
    if (next !== "ready_for_pickup" || !["preparing", "ready_for_pickup"].includes(current) || correction) {
      throw new LogisticsError("Vendors can mark their own packages ready, but cannot confirm collection or delivery.", 403);
    }
    return;
  }
  if (source !== "admin" && source !== "partner") throw new LogisticsError("Shipment updates are not permitted.", 403);
  if (source === "partner" && next === "ready_for_pickup") throw new LogisticsError("The vendor must confirm package readiness.", 403);
  if (correction) {
    if (source !== "admin" || !reason || reason.trim().length < 10) {
      throw new LogisticsError("An admin correction requires a reason of at least 10 characters.", 403);
    }
    if (["delivered", "returned"].includes(current) || next === "preparing") {
      throw new LogisticsError("Completed shipment records cannot be undone here. Handle financial disputes separately.");
    }
    return;
  }
  if (!shipmentTransitions[current]?.includes(next)) throw new LogisticsError(`Cannot move a shipment from ${current} to ${next}.`);
}
export function assertBuyerShippingSettled(order: { paymentStatus: string | null; orderStatus: string | null; shippingPaymentStatus: string; shippingEstimatedAmount?: string | null; shippingFinalAmount?: string | null }) {
  if (order.paymentStatus !== "paid" || !["included", "paid"].includes(order.shippingPaymentStatus) ||
    (order.shippingEstimatedAmount && !order.shippingFinalAmount) ||
    ["cancelled", "payment_failed", "awaiting_shipping_quote"].includes(order.orderStatus || "")) {
    throw new LogisticsError("Confirm the final customer shipping price and payment before accepting a booking or dispatching.");
  }
}
export function assertAgencyPaymentAmount(approvedAmount: string, recordedAmount: number) {
  if (Math.round(Number(approvedAmount) * 100) !== Math.round(recordedAmount * 100)) {
    throw new LogisticsError("The agency payment must exactly match the approved partner quote.");
  }
}
