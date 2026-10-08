import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "./db";
import { orders } from "../shared/schema";
import { UNPAID_CHECKOUT_LIFETIME_MS } from "../shared/checkout-lifecycle";
import { notifyOrderClosure } from "./payment-emails";
import { getPaystackService } from "./paystack";
import { paymentVerificationError } from "./order-security";

export async function unpaidCheckoutCanClose(
  order: any,
  confirmPaid: (order: any, reference: string) => Promise<unknown>,
  verify?: (reference: string) => Promise<any>,
): Promise<boolean> {
  if (!order.paymentReference) return true;
  try {
    const payment = await (verify || (reference => getPaystackService().verifyTransaction(reference)))(order.paymentReference);
    if (payment?.status && payment.data?.status === "success") {
      if (!paymentVerificationError(order, payment, order.paymentReference)) {
        await confirmPaid(order, order.paymentReference);
      }
      return false;
    }
    // Unknown, pending or processing money is never treated as unpaid.
    return payment?.status === true && ["failed", "abandoned"].includes(payment.data?.status);
  } catch {
    console.error("Checkout payment status could not be verified; the order was retained.");
    return false;
  }
}

// Conditional updates serialize with payment confirmation. Never delete an
// order, release paid inventory, refund, or transfer funds from this worker.
export async function closeUnpaidCheckout(id: number, userId: string, status: "cancelled" | "expired", cutoff?: Date) {
  const [closed] = await db.update(orders).set({ orderStatus: status, updatedAt: new Date() })
    .where(and(
      eq(orders.id, id), eq(orders.userId, userId),
      eq(orders.paymentStatus, "pending"),
      inArray(orders.orderStatus, ["pending", "awaiting_shipping_quote"]),
      cutoff ? lte(orders.createdAt, cutoff) : undefined,
    )).returning();
  return closed;
}

export function startUnpaidCheckoutExpiry(confirmPaid: (order: any, reference: string) => Promise<unknown>) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const cutoff = new Date(Date.now() - UNPAID_CHECKOUT_LIFETIME_MS);
      const candidates = await db.select().from(orders)
        .where(and(eq(orders.paymentStatus, "pending"),
          inArray(orders.orderStatus, ["pending", "awaiting_shipping_quote"]),
          lte(orders.createdAt, cutoff))).limit(25);
      for (const order of candidates) {
        if (!await unpaidCheckoutCanClose(order, confirmPaid)) continue;
        if (await closeUnpaidCheckout(order.id, order.userId, "expired", cutoff)) {
          await notifyOrderClosure(order.id, "expired");
        }
      }
    } catch {
      console.error("Unpaid checkout expiry could not complete; records retained for retry.");
    } finally { running = false; }
  }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
