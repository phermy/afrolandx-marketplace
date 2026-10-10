import { eq } from "drizzle-orm";
import { db } from "./db";
import { orderFinancialAdjustments, vendorSettlements } from "../shared/schema";
import { storage } from "./storage";
import { sendPaymentEmail } from "./email";

const ngn = (amount: string | number | null | undefined) =>
  `NGN ${Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Email failure must never turn an accepted payment, refund, or transfer into
// a failed financial operation. Replays use a stable provider idempotency key.
async function notify(operation: () => Promise<void>) {
  try { await operation(); }
  catch { console.error("Payment email delivery failed. The financial transaction is unchanged."); }
}

export async function notifyOrderPayment(orderId: number, kind: "order" | "shipping" | "shipping-refund" = "order") {
  await notify(async () => {
    const order = await storage.getOrder(orderId);
    if (!order) return;
    const user = await storage.getUser(order.userId);
    const refund = kind === "shipping-refund";
    const shipping = kind === "shipping";
    const status = refund ? order.shippingRefundStatus : shipping ? order.shippingPaymentStatus : order.paymentStatus;
    if (!status || (!refund && status !== "paid")) return;
    const reference = shipping ? order.shippingPaymentReference : order.paymentReference;
    const amount = refund ? order.shippingRefundAmount : shipping ? order.shippingFinalAmount : order.totalAmount;
    const title = refund ? "Shipping refund update" : shipping ? "Shipping payment confirmed" : "Payment confirmed";
    await sendPaymentEmail(user?.email, `${title} — order #${orderId}`,
      `Order: #${orderId}\nAmount: ${ngn(amount)}\nStatus: ${status}\nPayment reference: ${reference || "See your order"}`,
      `${kind}:${orderId}:${reference}:${status}:${amount}`);
  });
}

export async function notifyFinancialAdjustment(reference: string) {
  await notify(async () => {
    const [adjustment] = await db.select().from(orderFinancialAdjustments).where(eq(orderFinancialAdjustments.providerReference, reference));
    if (!adjustment) return;
    const order = await storage.getOrder(adjustment.orderId);
    const user = order ? await storage.getUser(order.userId) : undefined;
    await sendPaymentEmail(user?.email, `${adjustment.kind === "refund" ? "Refund" : "Chargeback"} update — order #${adjustment.orderId}`,
      `Order: #${adjustment.orderId}\nAmount: ${ngn(adjustment.amount)}\nStatus: ${adjustment.status}\nReference: ${reference}`,
      `adjustment:${reference}:${adjustment.status}`);
  });
}

export async function notifyVendorSettlement(settlementId: number) {
  await notify(async () => {
    const [settlement] = await db.select().from(vendorSettlements).where(eq(vendorSettlements.id, settlementId));
    if (!settlement) return;
    const vendor = await storage.getVendor(settlement.vendorId);
    const user = vendor ? await storage.getUser(vendor.userId) : undefined;
    await sendPaymentEmail(user?.email, `Vendor payout update — settlement #${settlementId}`,
      `Settlement: #${settlementId}\nAmount: ${ngn(settlement.netAmount)}\nStatus: ${settlement.status}\nReference: ${settlement.providerReference || "Not yet assigned"}`,
      `settlement:${settlementId}:${settlement.providerReference}:${settlement.status}`);
  });
}

export async function notifyAgencyPayment(payment: { id: number; shipmentId: number; amount: string; paymentReference: string }) {
  await notify(() => sendPaymentEmail(null, `Agency payment recorded — shipment #${payment.shipmentId}`,
    `Shipment: #${payment.shipmentId}\nAmount: ${ngn(payment.amount)}\nReference: ${payment.paymentReference}\nThis confirms a recorded agency invoice payment; it does not initiate a new transfer.`,
    `agency:${payment.id}:${payment.paymentReference}`));
}
