import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, pool } from "./db";
import { storage } from "./storage";
import { categories, users, vendors, products, orders, orderItems, logisticsPartners, logisticsPartnerMembers, shipments, shipmentQuotes, shipmentEvents, shipmentAgencyPayments, logisticsEmailOutbox, notifications, vendorLedgerEntries } from "../shared/schema";
import { ensureOrderShipments, splitShipment, assignShipment, submitShipmentQuote, reviewShipmentQuote, acceptShipmentBooking, recordAgencyPayment, updateShipmentStatus, reportShipmentIssue } from "./logistics-service";
import { listShipments } from "./logistics-queries";
import { getLogisticsAccess } from "./logistics-access";
import { createSaleLedger } from "./finance";

test("shipping operations persist scoped assignments, funding gates, package splits, and delivery accounting", async t => {
  if (process.env.NODE_ENV === "production") throw new Error("Shipping tests cannot run in production.");
  const suffix = randomUUID();
  const identities = ["admin", "buyer", "seller1", "seller2", "partner1", "partner2", "outsider", "unverified", "superadmin"].map(role => `shipping-${role}-${suffix}`);
  const [admin, buyer, seller1, seller2, partner1, partner2, outsider, unverified] = identities;
  const vendorIds: number[] = [], productIds: number[] = [], orderIds: number[] = [], partnerIds: number[] = [];
  let categoryId: number | undefined;
  const pickup = { contactName: "Vendor contact", phone: "+2348012345678", address1: "12 Pickup Road", city: "Lagos", state: "Lagos", postalCode: "100001", country: "Nigeria" };
  const ready = { status: "ready_for_pickup", note: "Package prepared for pickup", pickupAddress: pickup, weightKg: 1.5, dimensions: "20 x 15 x 10 cm" };
  try {
    await db.insert(users).values(identities.map((id, index) => ({
      id, email: `${id}@example.test`, firstName: "Shipping test", emailVerified: id !== unverified,
      roles: index === 8 ? ["admin", "superadmin"] : index === 0 || id === unverified ? ["admin"] : index === 2 || index === 3 ? ["vendor", "customer"] : ["customer"],
    })));
    assert.equal((await getLogisticsAccess(admin)).admin, true);
    assert.equal((await getLogisticsAccess(identities[8])).admin, true);
    assert.equal((await getLogisticsAccess(buyer)).admin, false);
    await assert.rejects(getLogisticsAccess(unverified), /verified/);
    const [category] = await db.insert(categories).values({ name: "Shipping test", slug: `shipping-${suffix}` }).returning();
    categoryId = category.id;
    const shops = await db.insert(vendors).values([
      { userId: seller1, businessName: "Shipping shop one", status: "approved" }, { userId: seller2, businessName: "Shipping shop two", status: "approved" },
    ]).returning();
    vendorIds.push(...shops.map(shop => shop.id));
    const catalog = await db.insert(products).values(shops.map((shop, index) => ({ vendorId: shop.id, categoryId, name: `Shipping item ${index}`, description: "Test product", price: "100", status: "approved" }))).returning();
    productIds.push(...catalog.map(product => product.id));
    const agencies = await db.insert(logisticsPartners).values([
      { name: "Shipping test agency one", contactEmail: `${partner1}@example.test` }, { name: "Shipping test agency two", contactEmail: `${partner2}@example.test` },
    ]).returning();
    partnerIds.push(...agencies.map(agency => agency.id));
    await db.insert(logisticsPartnerMembers).values([
      { partnerId: partnerIds[0], email: `${partner1}@example.test`, userId: partner1, invitedBy: admin, acceptedAt: new Date() },
      { partnerId: partnerIds[1], email: `${partner2}@example.test`, userId: partner2, invitedBy: admin, acceptedAt: new Date() },
      { partnerId: partnerIds[0], email: `${outsider}@example.test`, invitedBy: admin },
    ]);
    const createdOrders = await db.insert(orders).values([
      { userId: buyer, totalAmount: "700", paymentStatus: "paid", shippingAmount: "100", shippingFinalAmount: "100", shippingPaymentStatus: "included", orderStatus: "processing", shippingAddress: { ...pickup, firstName: "Buyer", address1: "Buyer destination" } },
      { userId: buyer, totalAmount: "101", paymentStatus: "paid", shippingEstimatedAmount: "1", shippingPaymentStatus: "awaiting_quote", orderStatus: "awaiting_shipping_quote", shippingAddress: pickup },
      { userId: buyer, totalAmount: "100", paymentStatus: "pending", shippingAddress: pickup },
      { userId: buyer, totalAmount: "100", paymentStatus: "paid", orderStatus: "shipped", shippingAddress: pickup },
    ]).returning();
    orderIds.push(...createdOrders.map(order => order.id));
    await db.insert(orderItems).values([
      { orderId: orderIds[0], productId: productIds[0], quantity: 3, priceAtTime: "100" }, { orderId: orderIds[0], productId: productIds[1], quantity: 3, priceAtTime: "100" },
      ...orderIds.slice(1).map(orderId => ({ orderId, productId: productIds[0], quantity: 1, priceAtTime: "100" })),
    ]);
    let first = 0, second = 0, split = 0, waiting = 0;
    await t.test("paid completion creates one package per vendor and duplicate creation is idempotent", async () => {
      const packages = await ensureOrderShipments(orderIds[0]);
      assert.equal(packages.length, 2);
      first = packages.find(item => item.vendorId === vendorIds[0])!.id;
      second = packages.find(item => item.vendorId === vendorIds[1])!.id;
      const repeated = await Promise.all([ensureOrderShipments(orderIds[0]), ensureOrderShipments(orderIds[0])]);
      assert.ok(repeated.every(items => items.length === 2));
      await assert.rejects(ensureOrderShipments(orderIds[2]), /paid/);
      assert.equal((await ensureOrderShipments(orderIds[3])).length, 0);
      await assert.rejects(ensureOrderShipments(orderIds[3], admin), /older orders/);
      await assert.rejects(ensureOrderShipments(orderIds[0], unverified), /verified/);
    });
    await t.test("package splits preserve unit totals, reject other vendors, and are retry safe", async () => {
      const payload = { requestKey: randomUUID(), items: [{ productId: productIds[0], quantity: 1 }], reason: "Pack one item separately" };
      await assert.rejects(splitShipment(seller2, first, payload), /cannot operate/);
      const created = await splitShipment(seller1, first, payload);
      split = created.id;
      assert.equal((await splitShipment(seller1, first, payload)).id, split);
      await assert.rejects(splitShipment(seller1, first, { ...payload, items: [{ productId: productIds[0], quantity: 2 }] }), /different package/);
      const packages = await ensureOrderShipments(orderIds[0]);
      assert.equal(packages.length, 3);
      assert.equal(packages.filter(item => item.vendorId === vendorIds[0]).reduce((sum, item) => sum + (item.items as any[]).reduce((units, line) => units + line.quantity, 0), 0), 3);
    });
    await t.test("invited but unaccepted accounts cannot see assigned shipments", async () => {
      assert.equal((await getLogisticsAccess(outsider)).invitations.length, 1);
      assert.deepEqual((await listShipments(outsider)).shipments, []);
      await assert.rejects(updateShipmentStatus(seller2, first, ready), /cannot operate/);
      await assert.rejects(updateShipmentStatus(seller1, first, { ...ready, trackingNumber: "Vendor claim" }), /not carrier tracking/);
      await updateShipmentStatus(seller1, first, ready);
      await updateShipmentStatus(seller2, second, ready);
      await updateShipmentStatus(seller1, split, ready);
      await assignShipment(admin, first, partnerIds[0], "First agency handles pickup");
      await assignShipment(admin, second, partnerIds[1], "Second agency handles pickup");
      await assignShipment(admin, split, partnerIds[0], "First agency handles second package");
      assert.deepEqual((await listShipments(partner1)).shipments.filter(item => orderIds.includes(item.orderId)).map(item => item.id).sort(), [first, split].sort());
      await assert.rejects(submitShipmentQuote(partner2, first, { amount: 25, estimatedDelivery: "Two days" }), /assigned shipping partner/);
    });
    await t.test("agency payments and customer funds cannot be bypassed", async () => {
      const [packageWaiting] = await ensureOrderShipments(orderIds[1]);
      waiting = packageWaiting.id;
      await updateShipmentStatus(seller1, waiting, ready); // Preparation remains allowed while final shipping is pending.
      await assignShipment(admin, waiting, partnerIds[0], "Waiting for final customer shipping");
      const quote = await submitShipmentQuote(partner1, waiting, { amount: 25, estimatedDelivery: "Two days" });
      await reviewShipmentQuote(admin, quote.id, "approved", "Agency cost reviewed");
      await assert.rejects(acceptShipmentBooking(partner1, waiting, "WAITING-BOOKING"), /final customer shipping/);
      const quoteFirst = await submitShipmentQuote(partner1, first, { amount: 25, estimatedDelivery: "Two days" });
      await assert.rejects(reviewShipmentQuote(partner1, quoteFirst.id, "approved", "I approve my own quote"), /Admin access/);
      await reviewShipmentQuote(admin, quoteFirst.id, "approved", "Confirmed agency cost");
      await assert.rejects(reviewShipmentQuote(admin, quoteFirst.id, "approved", "Duplicate review"), /already reviewed/);
      await assert.rejects(recordAgencyPayment(admin, first, { amount: 25, invoiceReference: "INV-FIRST", paymentReference: `first-${suffix}`, paidAt: new Date().toISOString(), note: "" }), /Accept the approved/);
      await acceptShipmentBooking(partner1, first, "BOOKING-FIRST");
      assert.equal(await storage.cancelOrderIfNoActiveShippingPayment(orderIds[0]), false);
      assert.equal(await storage.markOrderShipped(orderIds[0], "processing", "OLD-BYPASS"), false);
      await assert.rejects(assignShipment(admin, first, partnerIds[1], "Attempt to replace booking"), /cannot be reassigned/);
      await updateShipmentStatus(partner1, first, { status: "pickup_scheduled", note: "Pickup arranged with vendor", pickupScheduledAt: new Date(Date.now() + 3600000).toISOString() });
      await assert.rejects(updateShipmentStatus(partner1, first, { status: "collected", note: "Package collected", trackingNumber: "TRACK-FIRST" }), /recorded agency payment/);
      await assert.rejects(recordAgencyPayment(admin, first, { amount: 24, invoiceReference: "INV-FIRST", paymentReference: `first-${suffix}`, paidAt: new Date().toISOString(), note: "" }), /exactly match/);
      const payment = { amount: 25, invoiceReference: "INV-FIRST", paymentReference: `first-${suffix}`, paidAt: new Date().toISOString(), note: "Manual bank payment" };
      const records = await Promise.all([recordAgencyPayment(admin, first, payment), recordAgencyPayment(admin, first, payment)]);
      assert.equal(records[0].id, records[1].id);
      await assert.rejects(recordAgencyPayment(admin, first, { ...payment, paymentReference: `replacement-${suffix}` }), /immutable/);
    });
    await t.test("revoked or inactive partners lose operational access immediately", async () => {
      await db.update(logisticsPartnerMembers).set({ active: false }).where(and(eq(logisticsPartnerMembers.partnerId, partnerIds[0]), eq(logisticsPartnerMembers.userId, partner1)));
      assert.deepEqual((await listShipments(partner1)).shipments, []);
      await assert.rejects(updateShipmentStatus(partner1, first, { status: "collected", note: "Pickup confirmed", trackingNumber: "TRACK-FIRST" }), /assigned shipping partner/);
      await db.update(logisticsPartnerMembers).set({ active: true }).where(and(eq(logisticsPartnerMembers.partnerId, partnerIds[0]), eq(logisticsPartnerMembers.userId, partner1)));
      await db.update(logisticsPartners).set({ active: false }).where(eq(logisticsPartners.id, partnerIds[0]));
      await assert.rejects(updateShipmentStatus(partner1, first, { status: "collected", note: "Pickup confirmed", trackingNumber: "TRACK-FIRST" }), /inactive/);
      await db.update(logisticsPartners).set({ active: true }).where(eq(logisticsPartners.id, partnerIds[0]));
    });
    await t.test("shipment delivery releases only the delivered vendor's merchandise after all their packages arrive", async () => {
      await createSaleLedger(orderIds[0]);
      const deliver = async (shipmentId: number, actor: string) => {
        await updateShipmentStatus(actor, shipmentId, { status: "collected", note: "Package collected", trackingNumber: `TRACK-${shipmentId}` });
        await updateShipmentStatus(actor, shipmentId, { status: "in_transit", note: "Package in carrier network" });
        await updateShipmentStatus(actor, shipmentId, { status: "out_for_delivery", note: "Final delivery attempt" });
        await assert.rejects(updateShipmentStatus(actor, shipmentId, { status: "delivered", note: "Package delivered" }), /evidence/);
        await updateShipmentStatus(actor, shipmentId, { status: "delivered", note: "Package delivered", deliveryEvidence: `Carrier proof ${shipmentId}` });
      };
      await deliver(first, partner1);
      let ledger = await db.select().from(vendorLedgerEntries).where(eq(vendorLedgerEntries.orderId, orderIds[0]));
      assert.ok(ledger.every(entry => entry.status === "pending"));
      for (const [shipmentId, actor] of [[split, partner1], [second, partner2]] as const) {
        const quote = await submitShipmentQuote(actor, shipmentId, { amount: 25, estimatedDelivery: "Two days" });
        await reviewShipmentQuote(admin, quote.id, "approved", "Confirmed package rate");
        await acceptShipmentBooking(actor, shipmentId, `BOOKING-${shipmentId}`);
        await recordAgencyPayment(admin, shipmentId, { amount: 25, invoiceReference: `INVOICE-${shipmentId}`, paymentReference: `payment-${shipmentId}-${suffix}`, paidAt: new Date().toISOString(), note: "Manual transfer recorded" });
        await updateShipmentStatus(actor, shipmentId, { status: "pickup_scheduled", note: "Pickup confirmed with vendor", pickupScheduledAt: new Date().toISOString() });
        await deliver(shipmentId, actor);
        if (shipmentId === split) {
          ledger = await db.select().from(vendorLedgerEntries).where(eq(vendorLedgerEntries.orderId, orderIds[0]));
          assert.equal(ledger.find(entry => entry.vendorId === vendorIds[0])!.status, "available");
          assert.equal(ledger.find(entry => entry.vendorId === vendorIds[1])!.status, "pending");
          assert.notEqual((await storage.getOrder(orderIds[0]))!.orderStatus, "delivered");
        }
      }
      assert.equal((await storage.getOrder(orderIds[0]))!.orderStatus, "delivered");
      ledger = await db.select().from(vendorLedgerEntries).where(eq(vendorLedgerEntries.orderId, orderIds[0]));
      assert.ok(ledger.every(entry => entry.status === "available" && entry.netAmount === "276.00")); // 8% of merchandise only, never shipping.
      await updateShipmentStatus(partner1, first, { status: "delivered", note: "Duplicate confirmation", deliveryEvidence: `Carrier proof ${first}` });
      await assert.rejects(updateShipmentStatus(admin, first, { status: "in_transit", note: "Undo completed delivery", correction: true, reason: "Mistaken completed carrier scan" }), /cannot be undone/);
    });
    await t.test("buyers see their timelines without agency finance or pickup addresses and can report post-delivery issues", async () => {
      await assert.rejects(reportShipmentIssue(outsider, first, "This is not my purchase"), /Only the buyer/);
      await reportShipmentIssue(buyer, first, "The delivered package has an issue");
      const view = (await listShipments(buyer)).shipments.find(item => item.id === first)!;
      assert.equal(view.pickupAddress, null);
      assert.equal(view.agencyPayment, undefined);
      assert.equal(view.quotes, undefined);
      assert.ok(view.events.some(event => event.type === "issue"));
      assert.ok(view.events.every(event => !event.actorName));
      const adminView = (await listShipments(admin, orderIds[0])).shipments.find(item => item.id === first)!;
      assert.ok(adminView.events.every(event => event.actorName));
      assert.ok(adminView.agencyPayment);
      await assert.rejects(assignShipment(unverified, waiting, partnerIds[1], "Unverified admin attempt"), /verified/);
    });
  } finally {
    const managed = orderIds.length ? await db.select({ id: shipments.id }).from(shipments).where(inArray(shipments.orderId, orderIds)) : [];
    const shipmentIds = managed.map(item => item.id);
    const emailConditions = [
      ...orderIds.flatMap(orderId => [sql`${logisticsEmailOutbox.message} LIKE ${`Order #${orderId}:%`}`, sql`${logisticsEmailOutbox.message} LIKE ${`%order #${orderId} %`}`]),
      ...shipmentIds.map(shipmentId => sql`${logisticsEmailOutbox.message} LIKE ${`Shipment #${shipmentId} %`}`),
    ];
    if (emailConditions.length) await db.delete(logisticsEmailOutbox).where(or(...emailConditions));
    if (orderIds.length) await db.delete(notifications).where(inArray(notifications.orderId, orderIds));
    if (shipmentIds.length) {
      await db.delete(shipmentAgencyPayments).where(inArray(shipmentAgencyPayments.shipmentId, shipmentIds));
      await db.delete(shipmentQuotes).where(inArray(shipmentQuotes.shipmentId, shipmentIds));
      await db.delete(shipmentEvents).where(inArray(shipmentEvents.shipmentId, shipmentIds));
      await db.delete(shipments).where(inArray(shipments.id, shipmentIds));
    }
    if (orderIds.length) {
      await db.delete(vendorLedgerEntries).where(inArray(vendorLedgerEntries.orderId, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
    if (partnerIds.length) {
      await db.delete(logisticsPartnerMembers).where(inArray(logisticsPartnerMembers.partnerId, partnerIds));
      await db.delete(logisticsPartners).where(inArray(logisticsPartners.id, partnerIds));
    }
    if (productIds.length) await db.delete(products).where(inArray(products.id, productIds));
    if (vendorIds.length) await db.delete(vendors).where(inArray(vendors.id, vendorIds));
    if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(users).where(inArray(users.id, identities));
    await pool.end();
  }
});
