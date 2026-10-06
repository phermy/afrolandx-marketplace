import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "./db";
import { logisticsEmailOutbox, logisticsPartnerMembers, logisticsPartners, orders, shipmentAgencyPayments, shipmentEvents, shipmentQuotes, shipments, users, vendors } from "../shared/schema";
import type { LogisticsPartnerView, ShipmentView, ShipmentsResponse } from "../shared/logistics";
import { getLogisticsAccess } from "./logistics-access";

export async function listLogisticsPartners(): Promise<LogisticsPartnerView[]> {
  const partners = await db.select().from(logisticsPartners).orderBy(desc(logisticsPartners.id));
  const members = await db.select().from(logisticsPartnerMembers);
  return partners.map(partner => ({
    ...partner,
    members: members.filter(member => member.partnerId === partner.id).map(member => ({ id: member.id, email: member.email, active: member.active, accepted: Boolean(member.userId) })),
  }));
}
export async function listShipments(userId: string, orderId?: number): Promise<ShipmentsResponse> {
  const access = await getLogisticsAccess(userId);
  const permissions = [eq(orders.userId, userId)];
  if (access.vendorId) permissions.push(eq(shipments.vendorId, access.vendorId));
  if (access.partnerIds.length) permissions.push(inArray(shipments.partnerId, access.partnerIds));
  const records = await db.select({
    shipment: shipments, order: orders, vendorName: vendors.businessName, partnerName: logisticsPartners.name,
  }).from(shipments).innerJoin(orders, eq(orders.id, shipments.orderId))
    .innerJoin(vendors, eq(vendors.id, shipments.vendorId))
    .leftJoin(logisticsPartners, eq(logisticsPartners.id, shipments.partnerId))
    .where(and(access.admin ? undefined : or(...permissions), orderId ? eq(orders.id, orderId) : undefined))
    .orderBy(desc(shipments.createdAt), desc(shipments.id));
  const ids = records.map(record => record.shipment.id);
  const [events, quotes, payments] = ids.length ? await Promise.all([
    db.select().from(shipmentEvents).where(inArray(shipmentEvents.shipmentId, ids)).orderBy(shipmentEvents.id),
    db.select().from(shipmentQuotes).where(inArray(shipmentQuotes.shipmentId, ids)).orderBy(desc(shipmentQuotes.id)),
    db.select().from(shipmentAgencyPayments).where(inArray(shipmentAgencyPayments.shipmentId, ids)),
  ]) : [[], [], []];
  const actorIds = Array.from(new Set(events.map(event => event.actorId).filter((value): value is string => Boolean(value))));
  const actors = access.admin && actorIds.length ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray(users.id, actorIds)) : [];
  const views: ShipmentView[] = records.map(({ shipment, order, vendorName, partnerName }) => {
    const operational = access.admin || (shipment.partnerId !== null && access.partnerIds.includes(shipment.partnerId));
    const payment = payments.find(record => record.shipmentId === shipment.id);
    return {
      id: shipment.id, orderId: shipment.orderId, vendorId: shipment.vendorId, vendorName,
      partnerId: shipment.partnerId, partnerName, status: shipment.status as ShipmentView["status"],
      items: shipment.items as ShipmentView["items"],
      pickupAddress: operational || access.vendorId === shipment.vendorId ? shipment.pickupAddress as ShipmentView["pickupAddress"] : null,
      deliveryAddress: order.userId === userId || operational || access.vendorId === shipment.vendorId ? shipment.deliveryAddress as Record<string, string> : {},
      weightKg: shipment.weightKg, dimensions: shipment.dimensions, trackingNumber: shipment.trackingNumber, trackingUrl: shipment.trackingUrl,
      pickupScheduledAt: shipment.pickupScheduledAt?.toISOString() || null,
      bookingReference: shipment.bookingReference, bookingAcceptedAt: shipment.bookingAcceptedAt?.toISOString() || null,
      readyAt: shipment.readyAt?.toISOString() || null, deliveryEvidence: shipment.deliveryEvidence,
      createdAt: shipment.createdAt.toISOString(), buyerShippingStatus: order.shippingPaymentStatus,
      buyerShippingAmount: order.shippingFinalAmount || order.shippingAmount, customerQuoteRequestId: order.shippingQuoteRequestId,
      ...(operational ? {
        approvedQuoteId: shipment.approvedQuoteId,
        quotes: quotes.filter(quote => quote.shipmentId === shipment.id && (access.admin || quote.partnerId === shipment.partnerId && quote.assignmentRevision === shipment.assignmentRevision))
          .map(quote => ({ id: quote.id, amount: quote.amount, status: quote.status, estimatedDelivery: quote.estimatedDelivery, notes: quote.notes, createdAt: quote.createdAt.toISOString(), reviewNote: quote.reviewNote })),
        agencyPayment: payment ? { amount: payment.amount, invoiceReference: payment.invoiceReference, paymentReference: payment.paymentReference, paidAt: payment.paidAt.toISOString(), note: payment.note } : null,
      } : {}),
      events: events.filter(event => event.shipmentId === shipment.id && (operational || !["quote", "quote_review", "agency_payment"].includes(event.type)))
        .map(event => {
          const actor = actors.find(user => user.id === event.actorId);
          return { id: event.id, type: event.type, status: event.status, note: event.note, source: event.source as ShipmentView["events"][number]["source"], deliveryEvidence: event.deliveryEvidence, createdAt: event.createdAt.toISOString(),
            ...(access.admin ? { actorName: actor ? [actor.firstName, actor.lastName].filter(Boolean).join(" ") || "Account holder" : "System" } : {}) };
        }),
    };
  });
  const eligible = access.admin && !orderId ? await db.select({ id: orders.id, createdAt: orders.createdAt, firstName: users.firstName, lastName: users.lastName })
    .from(orders).innerJoin(users, eq(users.id, orders.userId))
    .where(and(eq(orders.paymentStatus, "paid"), sql`NOT EXISTS (SELECT 1 FROM shipments WHERE order_id = ${orders.id})`, sql`${orders.orderStatus} NOT IN ('cancelled', 'shipped', 'delivered')`))
    .orderBy(desc(orders.createdAt)) : [];
  const [failures] = access.admin ? await db.select({ count: sql<number>`count(*)::int` }).from(logisticsEmailOutbox)
    .where(and(isNull(logisticsEmailOutbox.deliveredAt), sql`${logisticsEmailOutbox.attempts} > 0`)) : [];
  return { shipments: views, eligibleOrders: eligible.map(order => ({ id: order.id, createdAt: order.createdAt?.toISOString() || "", buyerName: [order.firstName, order.lastName].filter(Boolean).join(" ") || "Customer" })), ...(access.admin ? { notificationFailures: failures?.count || 0 } : {}) };
}
