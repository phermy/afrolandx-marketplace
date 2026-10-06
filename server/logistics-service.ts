import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { orders, orderItems, products, shipments, shipmentEvents, shipmentQuotes, shipmentAgencyPayments, vendors, logisticsPartners, vendorLedgerEntries, users } from "../shared/schema";
import { shipmentUpdateSchema, partnerQuoteSchema, splitShipmentSchema, type ShipmentItem, type ShipmentStatus } from "../shared/logistics";
import { lockLogisticsActor, lockPartnerMembership, type LogisticsTx } from "./logistics-access";
import { assertAgencyPaymentAmount, assertBuyerShippingSettled, assertShipmentTransition, LogisticsError, type LogisticsSource } from "./logistics-policy";
import { notifyShipment } from "./logistics-notifications";

type Shipment = typeof shipments.$inferSelect;
export async function ensureOrderShipments(orderId: number, actorId?: string) {
  return db.transaction(async tx => {
    if (actorId) await lockLogisticsActor(tx, actorId, true);
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`);
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!order) throw new LogisticsError("Order not found.", 404);
    if (order.paymentStatus !== "paid" || order.orderStatus === "cancelled") throw new LogisticsError("Only a paid, active order can create shipments.");
    if (["shipped", "delivered"].includes(order.orderStatus || "")) {
      const existing = await tx.select().from(shipments).where(eq(shipments.orderId, orderId));
      if (actorId && !existing.length) throw new LogisticsError("Already dispatched older orders keep their existing tracking. Import orders before dispatch.");
      return existing;
    }
    const lines = await tx.select({ productId: products.id, name: products.name, vendorId: products.vendorId, quantity: orderItems.quantity })
      .from(orderItems).innerJoin(products, eq(products.id, orderItems.productId)).where(eq(orderItems.orderId, orderId));
    const byVendor = new Map<number, ShipmentItem[]>();
    for (const item of lines) {
      const list = byVendor.get(item.vendorId) || [];
      list.push({ productId: item.productId, name: item.name, quantity: item.quantity });
      byVendor.set(item.vendorId, list);
    }
    for (const [vendorId, items] of Array.from(byVendor.entries())) {
      const [existing] = await tx.select({ id: shipments.id }).from(shipments).where(and(eq(shipments.orderId, orderId), eq(shipments.vendorId, vendorId))).limit(1);
      if (existing) continue;
      const historical = ["shipped", "delivered"].includes(order.orderStatus || "");
      const status = order.orderStatus === "delivered" ? "delivered" : historical ? "in_transit" : "preparing";
      const [created] = await tx.insert(shipments).values({
        orderId, vendorId, items, deliveryAddress: order.shippingAddress,
        status, ...(historical ? { trackingNumber: order.trackingNumber } : {}),
      }).returning();
      if (!created) continue;
      await tx.insert(shipmentEvents).values({
        shipmentId: created.id, status, type: "created", source: "system",
        note: historical ? "Imported the existing order status. Earlier carrier events and delivery evidence were not recorded in this timeline." : "Payment confirmed. A separate shipment was created for this vendor's products.",
      });
      await notifyShipment(tx, created, "Shipment created", `Shipment #${created.id} for order #${orderId} is available in Afrolandx. ${historical ? "Its earlier order status was imported." : "The vendor can prepare the package while shipping is arranged."}`);
    }
    return tx.select().from(shipments).where(eq(shipments.orderId, orderId));
  });
}

async function lockShipment(tx: LogisticsTx, shipmentId: number) {
  const [initial] = await tx.select({ orderId: shipments.orderId }).from(shipments).where(eq(shipments.id, shipmentId));
  if (!initial) throw new LogisticsError("Shipment not found.", 404);
  await tx.execute(sql`SELECT id FROM orders WHERE id = ${initial.orderId} FOR UPDATE`);
  await tx.execute(sql`SELECT id FROM shipments WHERE id = ${shipmentId} FOR UPDATE`);
  const [shipment] = await tx.select().from(shipments).where(eq(shipments.id, shipmentId));
  const [order] = await tx.select().from(orders).where(eq(orders.id, initial.orderId));
  return { shipment, order };
}
async function shipmentSource(tx: LogisticsTx, actorId: string, shipment: Shipment, admin: boolean, allowVendor = false): Promise<LogisticsSource> {
  if (admin) return "admin";
  if (allowVendor) {
    const [vendor] = await tx.select({ id: vendors.id }).from(vendors).innerJoin(users, eq(users.id, vendors.userId))
      .where(and(eq(vendors.id, shipment.vendorId), eq(vendors.userId, actorId), eq(vendors.status, "approved"), sql`${users.roles} @> '["vendor"]'::jsonb`));
    if (vendor) return "vendor";
  }
  if (shipment.partnerId !== null) {
    await lockPartnerMembership(tx, actorId, shipment.partnerId);
    return "partner";
  }
  throw new LogisticsError("You cannot operate this shipment.", 403);
}
async function recordEvent(tx: LogisticsTx, shipment: Shipment, actorId: string, source: LogisticsSource, type: string, note: string, evidence?: string) {
  await tx.insert(shipmentEvents).values({ shipmentId: shipment.id, status: shipment.status, actorId, source, type, note, deliveryEvidence: evidence });
  await notifyShipment(tx, shipment, `Shipment #${shipment.id} update`, `Order #${shipment.orderId}: ${note}`);
}
export async function assignShipment(actorId: string, shipmentId: number, partnerId: number, reason: string) {
  return db.transaction(async tx => {
    await lockLogisticsActor(tx, actorId, true);
    const { shipment, order } = await lockShipment(tx, shipmentId);
    if (order.paymentStatus !== "paid" || order.orderStatus === "cancelled") throw new LogisticsError("This order cannot be assigned.");
    if (shipment.bookingAcceptedAt || ["collected", "in_transit", "out_for_delivery", "delivered", "returned"].includes(shipment.status)) {
      throw new LogisticsError("A booked or dispatched shipment cannot be reassigned. Resolve the existing booking first.");
    }
    const [payment] = await tx.select().from(shipmentAgencyPayments).where(eq(shipmentAgencyPayments.shipmentId, shipment.id));
    if (payment) throw new LogisticsError("A paid partner cannot be replaced.");
    await tx.execute(sql`SELECT id FROM logistics_partners WHERE id = ${partnerId} FOR SHARE`);
    const [partner] = await tx.select().from(logisticsPartners).where(and(eq(logisticsPartners.id, partnerId), eq(logisticsPartners.active, true)));
    if (!partner) throw new LogisticsError("Choose an active shipping partner.");
    if (shipment.partnerId === partnerId) return shipment;
    if (shipment.partnerId) await notifyShipment(tx, shipment, "Shipment assignment removed", `Shipment #${shipment.id} has been reassigned by Afrolandx. Do not collect it.`);
    const [updated] = await tx.update(shipments).set({
      partnerId, assignmentRevision: shipment.assignmentRevision + 1, approvedQuoteId: null,
      pickupScheduledAt: null, status: shipment.readyAt ? "ready_for_pickup" : "preparing", updatedAt: new Date(),
    }).where(eq(shipments.id, shipment.id)).returning();
    await recordEvent(tx, updated, actorId, "admin", "assignment", `Assigned to ${partner.name}. ${reason}`);
    return updated;
  });
}
export async function submitShipmentQuote(actorId: string, shipmentId: number, body: unknown) {
  const input = partnerQuoteSchema.parse(body);
  return db.transaction(async tx => {
    const { admin } = await lockLogisticsActor(tx, actorId);
    const { shipment, order } = await lockShipment(tx, shipmentId);
    const source = await shipmentSource(tx, actorId, shipment, admin);
    if (!shipment.partnerId || !shipment.readyAt || shipment.bookingAcceptedAt || order.orderStatus === "cancelled") throw new LogisticsError("Quotes require an assigned, ready, unbooked shipment with actual package details.");
    const [quote] = await tx.insert(shipmentQuotes).values({
      shipmentId, partnerId: shipment.partnerId, assignmentRevision: shipment.assignmentRevision,
      amount: input.amount.toFixed(2), estimatedDelivery: input.estimatedDelivery, notes: input.notes, submittedBy: actorId,
    }).returning();
    await recordEvent(tx, shipment, actorId, source, "quote", "A partner cost quote was submitted for admin review.");
    return quote;
  });
}
export async function reviewShipmentQuote(actorId: string, quoteId: number, decision: "approved" | "rejected", reason: string) {
  return db.transaction(async tx => {
    await lockLogisticsActor(tx, actorId, true);
    const [initial] = await tx.select().from(shipmentQuotes).where(eq(shipmentQuotes.id, quoteId));
    if (!initial) throw new LogisticsError("Quote not found.", 404);
    const { shipment } = await lockShipment(tx, initial.shipmentId);
    const [quote] = await tx.select().from(shipmentQuotes).where(eq(shipmentQuotes.id, quoteId));
    if (shipment.bookingAcceptedAt || quote.status !== "submitted" || quote.partnerId !== shipment.partnerId || quote.assignmentRevision !== shipment.assignmentRevision) {
      throw new LogisticsError("This quote was already reviewed or belongs to an old assignment.");
    }
    if (decision === "approved") {
      await tx.update(shipmentQuotes).set({ status: "rejected", reviewNote: "Superseded by the approved quote.", reviewedBy: actorId })
        .where(and(eq(shipmentQuotes.shipmentId, shipment.id), eq(shipmentQuotes.status, "approved")));
      await tx.update(shipments).set({ approvedQuoteId: quoteId, updatedAt: new Date() }).where(eq(shipments.id, shipment.id));
    }
    const [updated] = await tx.update(shipmentQuotes).set({ status: decision, reviewedBy: actorId, reviewNote: reason }).where(eq(shipmentQuotes.id, quoteId)).returning();
    await recordEvent(tx, shipment, actorId, "admin", "quote_review", `Partner cost quote ${decision}. ${reason}`);
    return updated;
  });
}
export async function acceptShipmentBooking(actorId: string, shipmentId: number, bookingReference: string) {
  return db.transaction(async tx => {
    const { admin } = await lockLogisticsActor(tx, actorId);
    const { shipment, order } = await lockShipment(tx, shipmentId);
    const source = await shipmentSource(tx, actorId, shipment, admin);
    assertBuyerShippingSettled(order);
    if (!shipment.partnerId || !shipment.approvedQuoteId) throw new LogisticsError("Approve a partner cost quote before booking.");
    if (shipment.bookingAcceptedAt) {
      if (shipment.bookingReference === bookingReference) return shipment;
      throw new LogisticsError("This booking was already accepted.");
    }
    const [updated] = await tx.update(shipments).set({ bookingReference, bookingAcceptedAt: new Date(), updatedAt: new Date() }).where(eq(shipments.id, shipment.id)).returning();
    await recordEvent(tx, updated, actorId, source, "booking", `Shipping booking accepted. Reference: ${bookingReference}. ${source === "admin" ? "Recorded manually by Afrolandx." : "Confirmed by the assigned shipping partner."}`);
    return updated;
  });
}
export async function recordAgencyPayment(actorId: string, shipmentId: number, input: { amount: number; invoiceReference: string; paymentReference: string; paidAt: string; note: string }) {
  return db.transaction(async tx => {
    await lockLogisticsActor(tx, actorId, true);
    const { shipment, order } = await lockShipment(tx, shipmentId);
    assertBuyerShippingSettled(order);
    if (!shipment.partnerId || !shipment.approvedQuoteId || !shipment.bookingAcceptedAt) throw new LogisticsError("Accept the approved shipping booking before recording agency payment.");
    const [quote] = await tx.select().from(shipmentQuotes).where(eq(shipmentQuotes.id, shipment.approvedQuoteId));
    if (!quote || quote.status !== "approved") throw new LogisticsError("An approved partner cost quote is required.");
    assertAgencyPaymentAmount(quote.amount, input.amount);
    const [existing] = await tx.select().from(shipmentAgencyPayments).where(eq(shipmentAgencyPayments.shipmentId, shipmentId));
    if (existing) {
      if (existing.paymentReference === input.paymentReference && existing.amount === input.amount.toFixed(2) && existing.invoiceReference === input.invoiceReference) return existing;
      throw new LogisticsError("An immutable payment record already exists for this shipment.");
    }
    const [payment] = await tx.insert(shipmentAgencyPayments).values({
      shipmentId, partnerId: shipment.partnerId, amount: input.amount.toFixed(2), invoiceReference: input.invoiceReference,
      paymentReference: input.paymentReference, paidAt: new Date(input.paidAt), recordedBy: actorId, note: input.note,
    }).returning();
    await recordEvent(tx, shipment, actorId, "admin", "agency_payment", "Afrolandx recorded payment of the approved partner invoice. This record does not initiate a bank transfer.");
    return payment;
  });
}
export async function updateShipmentStatus(actorId: string, shipmentId: number, body: unknown) {
  const input = shipmentUpdateSchema.parse(body);
  const result = await db.transaction(async tx => {
    const { admin } = await lockLogisticsActor(tx, actorId);
    const { shipment, order } = await lockShipment(tx, shipmentId);
    const source = await shipmentSource(tx, actorId, shipment, admin, input.status === "ready_for_pickup");
    if (order.paymentStatus !== "paid" || order.orderStatus === "cancelled") throw new LogisticsError("This order cannot be fulfilled.");
    if (shipment.status === "delivered" && input.status === "delivered" && shipment.deliveryEvidence === input.deliveryEvidence && !input.correction) {
      const siblings = await tx.select().from(shipments).where(eq(shipments.orderId, order.id));
      await releaseDeliveredVendor(tx, shipment, siblings);
      return { shipment, allDelivered: siblings.every(item => item.status === "delivered"), orderId: order.id };
    }
    assertShipmentTransition(shipment.status as ShipmentStatus, input.status, source, input.correction, input.reason);
    if (source === "vendor" && (input.pickupScheduledAt || input.trackingNumber || input.trackingUrl || input.deliveryEvidence)) {
      throw new LogisticsError("The vendor can supply package details, not carrier tracking or delivery confirmations.", 403);
    }
    if (input.pickupScheduledAt && input.status !== "pickup_scheduled") throw new LogisticsError("Record pickup dates when scheduling collection.", 400);
    if (input.status === "ready_for_pickup" && (!input.pickupAddress || !input.weightKg || !input.dimensions)) {
      throw new LogisticsError("Provide the pickup address, actual package weight, and dimensions before marking ready.");
    }
    if (input.status === "ready_for_pickup" && shipment.readyAt && (shipment.approvedQuoteId || shipment.bookingAcceptedAt)) {
      throw new LogisticsError("Approved or booked package details are locked. Contact Afrolandx before changing them.");
    }
    if (input.status === "pickup_scheduled" && (!shipment.readyAt || !shipment.bookingAcceptedAt || !input.pickupScheduledAt)) {
      throw new LogisticsError("Mark the package ready, accept the booking, and provide the pickup date.");
    }
    const transportStatuses = ["collected", "in_transit", "out_for_delivery", "delivered", "returned"];
    if (transportStatuses.includes(input.status)) {
      assertBuyerShippingSettled(order);
      const [payment] = await tx.select().from(shipmentAgencyPayments).where(eq(shipmentAgencyPayments.shipmentId, shipmentId));
      if (!shipment.bookingAcceptedAt || !shipment.readyAt || !payment || !shipment.pickupScheduledAt) {
        throw new LogisticsError("An accepted booking, ready package, scheduled pickup, and recorded agency payment are required before collection.");
      }
      if (input.status !== "collected" && !shipment.collectedAt) throw new LogisticsError("Confirm collection before updating transport progress.");
      if (!input.trackingNumber && !shipment.trackingNumber) throw new LogisticsError("A tracking number is required before collection.");
    }
    if (input.status === "delivered" && !input.deliveryEvidence) throw new LogisticsError("Delivery evidence or a carrier delivery reference is required.");
    if (shipment.collectedAt && ["preparing", "ready_for_pickup", "pickup_scheduled"].includes(input.status)) {
      throw new LogisticsError("A collected package cannot be reset to a precollection state.");
    }
    const [updated] = await tx.update(shipments).set({
      status: input.status, updatedAt: new Date(),
      ...(input.status === "ready_for_pickup" ? { pickupAddress: input.pickupAddress, weightKg: input.weightKg!.toFixed(3), dimensions: input.dimensions, readyAt: shipment.readyAt || new Date() } : {}),
      ...(input.status === "collected" ? { collectedAt: shipment.collectedAt || new Date() } : {}),
      ...(input.trackingNumber && source !== "vendor" ? { trackingNumber: input.trackingNumber } : {}),
      ...(input.trackingUrl && source !== "vendor" ? { trackingUrl: input.trackingUrl } : {}),
      ...(input.pickupScheduledAt ? { pickupScheduledAt: new Date(input.pickupScheduledAt) } : {}),
      ...(input.status === "delivered" ? { deliveryEvidence: input.deliveryEvidence } : {}),
    }).where(eq(shipments.id, shipmentId)).returning();
    if (input.status === "ready_for_pickup" && shipment.readyAt) {
      await tx.update(shipmentQuotes).set({ status: "rejected", reviewedBy: actorId, reviewNote: "Package details changed; a fresh quote is required." })
        .where(and(eq(shipmentQuotes.shipmentId, shipmentId), eq(shipmentQuotes.status, "submitted")));
    }
    await recordEvent(tx, updated, actorId, source, input.correction ? "correction" : "status",
      input.correction ? `Admin correction: ${input.reason}. ${input.note}` : input.note, input.deliveryEvidence);
    const siblings = await tx.select().from(shipments).where(eq(shipments.orderId, order.id));
    await releaseDeliveredVendor(tx, updated, siblings);
    const allDelivered = siblings.length > 0 && siblings.every(item => item.status === "delivered");
    if (allDelivered) await tx.update(orders).set({ orderStatus: "delivered", updatedAt: new Date() }).where(eq(orders.id, order.id));
    else if (order.orderStatus !== "delivered" && siblings.every(item => item.collectedAt || item.status === "delivered")) {
      await tx.update(orders).set({ orderStatus: "shipped", trackingNumber: siblings.find(item => item.trackingNumber)?.trackingNumber, updatedAt: new Date() }).where(eq(orders.id, order.id));
    } else if (order.orderStatus === "pending" && input.status === "ready_for_pickup") {
      await tx.update(orders).set({ orderStatus: "processing", updatedAt: new Date() }).where(eq(orders.id, order.id));
    }
    return { shipment: updated, allDelivered, orderId: order.id };
  });
  return result.shipment;
}
async function releaseDeliveredVendor(tx: LogisticsTx, shipment: Shipment, siblings: Shipment[]) {
  const vendorPackages = siblings.filter(item => item.vendorId === shipment.vendorId);
  if (vendorPackages.length && vendorPackages.every(item => item.status === "delivered")) {
    await tx.update(vendorLedgerEntries).set({ status: "available", availableAt: new Date() })
      .where(and(eq(vendorLedgerEntries.orderId, shipment.orderId), eq(vendorLedgerEntries.vendorId, shipment.vendorId), eq(vendorLedgerEntries.status, "pending")));
  }
}
export async function splitShipment(actorId: string, shipmentId: number, body: unknown) {
  const input = splitShipmentSchema.parse(body);
  const sortedItems = input.items.slice().sort((a, b) => a.productId - b.productId);
  if (new Set(sortedItems.map(item => item.productId)).size !== sortedItems.length) throw new LogisticsError("Select each product only once.", 400);
  return db.transaction(async tx => {
    const { admin } = await lockLogisticsActor(tx, actorId);
    const { shipment, order } = await lockShipment(tx, shipmentId);
    const source = await shipmentSource(tx, actorId, shipment, admin, true);
    if (source !== "admin" && source !== "vendor") throw new LogisticsError("Only the vendor or an admin can split packages.", 403);
    const [retry] = await tx.select().from(shipments).where(eq(shipments.splitRequestKey, input.requestKey));
    if (retry) {
      const retryItems = (retry.items as ShipmentItem[]).map(item => ({ productId: item.productId, quantity: item.quantity })).sort((a, b) => a.productId - b.productId);
      if (retry.splitFromId !== shipmentId || JSON.stringify(retryItems) !== JSON.stringify(sortedItems)) throw new LogisticsError("This retry key belongs to a different package split.");
      return retry;
    }
    if (shipment.status !== "preparing" || shipment.readyAt || shipment.bookingAcceptedAt || order.orderStatus === "cancelled") {
      throw new LogisticsError("Split packages before marking them ready or accepting a booking.");
    }
    const original = shipment.items as ShipmentItem[];
    const moved: ShipmentItem[] = [];
    const remaining = original.map(item => {
      const selected = sortedItems.find(candidate => candidate.productId === item.productId);
      const quantity = selected?.quantity || 0;
      if (quantity > item.quantity) throw new LogisticsError("A split cannot contain more units than this package.");
      if (quantity) moved.push({ ...item, quantity });
      return { ...item, quantity: item.quantity - quantity };
    }).filter(item => item.quantity > 0);
    if (moved.length !== sortedItems.length || !remaining.length) throw new LogisticsError("Choose valid units to move and leave at least one unit in the original package.");
    await tx.update(shipments).set({ items: remaining, approvedQuoteId: null, updatedAt: new Date() }).where(eq(shipments.id, shipment.id));
    await tx.update(shipmentQuotes).set({ status: "rejected", reviewedBy: actorId, reviewNote: "Package contents changed after splitting." })
      .where(and(eq(shipmentQuotes.shipmentId, shipment.id), sql`${shipmentQuotes.status} IN ('submitted', 'approved')`));
    const [created] = await tx.insert(shipments).values({
      orderId: shipment.orderId, vendorId: shipment.vendorId, items: moved, deliveryAddress: shipment.deliveryAddress,
      initialPackage: false, splitRequestKey: input.requestKey, splitFromId: shipment.id,
    }).returning();
    await recordEvent(tx, shipment, actorId, source, "split", `Moved selected units to package #${created.id}. Existing cost quotes were invalidated. ${input.reason}`);
    await recordEvent(tx, created, actorId, source, "created", `Package split from shipment #${shipment.id}. ${input.reason}`);
    return created;
  });
}
export async function reportShipmentIssue(actorId: string, shipmentId: number, message: string) {
  return db.transaction(async tx => {
    await lockLogisticsActor(tx, actorId);
    const { shipment, order } = await lockShipment(tx, shipmentId);
    if (order.userId !== actorId) throw new LogisticsError("Only the buyer can report an issue with this shipment.", 403);
    await recordEvent(tx, shipment, actorId, "customer", "issue", `Customer reported a delivery problem: ${message}`);
    return { message: "Your delivery issue was recorded and the shipping team was notified." };
  });
}
