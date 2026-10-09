import type { Express } from "express";
import { z } from "zod";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { orders, shipments, shipmentEvents } from "../shared/schema";
import { checkoutAccess } from "./guest-checkout";
import { isAuthenticated } from "./auth";
import { calculateCheckoutSubtotal, createCartFingerprint } from "./order-security";
import { getPaystackService, isPaystackInitialized } from "./paystack";
import { requestRateLimit } from "./request-rate-limit";
import {
  AggregatorError, ratesForPackage, parcelDimensions, selectDeliveryOptions, shipbubble,
  createProviderLabel, type ProviderPackage, validShipbubbleSignature,
} from "./shipping-aggregator";

export const deliverySchema = z.object({
  firstName: z.string().trim().min(1).max(120), lastName: z.string().trim().max(120).default(""),
  address1: z.string().trim().min(3).max(250), address2: z.string().trim().max(250).default(""),
  city: z.string().trim().min(1).max(120), state: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(30), country: z.string().trim().min(2).max(100),
  contactEmail: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30).regex(/^\+?[\d\s()-]+$/),
});

function failure(res: any, error: unknown) {
  const status = error instanceof AggregatorError ? error.status : error instanceof z.ZodError ? 400 : 503;
  res.status(status).json({ message: error instanceof AggregatorError ? error.message :
    error instanceof z.ZodError ? "Complete your contact details and delivery address." : "Checkout is temporarily unavailable. Please retry." });
}
const addressMatch = (a: any, b: any) => JSON.stringify(deliverySchema.parse(a)) === JSON.stringify(deliverySchema.parse(b));
const shippingFingerprint = (cart:any[]) => crypto.createHash("sha256").update(JSON.stringify({
  cart:createCartFingerprint(cart), parcels:cart.map(c=>({id:c.productId,weight:c.product.weight,dimensions:c.product.dimensions,vendorId:c.product.vendorId})).sort((a,b)=>a.id-b.id),
})).digest("hex");

// Additive development/production migration; no existing records or constraints
// are modified. Profiles contain actual vendor pickup data, not warehouse data.
export async function ensureShippingProfileTable() {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS vendor_shipping_profiles (
    vendor_id integer PRIMARY KEY REFERENCES vendors(id),
    address jsonb NOT NULL, category_id integer NOT NULL,
    processing_days integer NOT NULL CHECK(processing_days BETWEEN 1 AND 6),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
}

export function registerMarketplaceCheckout(app: Express) {
  app.get("/api/vendors/me/shipping-profile", isAuthenticated, async (req: any, res) => {
    try {
      const vendor = await storage.getVendorByUserId(req.user.id);
      if (!vendor || vendor.status !== "approved") return res.status(403).json({ message: "Approved vendor access required." });
      const result = await db.execute(sql`SELECT address, category_id, processing_days FROM vendor_shipping_profiles WHERE vendor_id = ${vendor.id}`);
      res.json(result.rows[0] || null);
    } catch (error) { failure(res, error); }
  });
  app.get("/api/shipping/package-categories", isAuthenticated, async (_req, res) => {
    try { res.json(await shipbubble("/shipping/labels/categories")); }
    catch (error) { failure(res, error); }
  });
  app.put("/api/vendors/me/shipping-profile", isAuthenticated, async (req: any, res) => {
    try {
      const vendor = await storage.getVendorByUserId(req.user.id);
      if (!vendor || vendor.status !== "approved") return res.status(403).json({ message: "Approved vendor access required." });
      const input = z.object({ address: deliverySchema, categoryId: z.number().int().positive(), processingDays: z.number().int().min(1).max(6) }).parse(req.body);
      const categories = await shipbubble("/shipping/labels/categories");
      if (!categories.some((c: any) => c.category_id === input.categoryId)) throw new AggregatorError("Choose a valid shipping category.", 400);
      await db.execute(sql`INSERT INTO vendor_shipping_profiles(vendor_id,address,category_id,processing_days)
        VALUES (${vendor.id},${JSON.stringify(input.address)}::jsonb,${input.categoryId},${input.processingDays})
        ON CONFLICT(vendor_id) DO UPDATE SET address = EXCLUDED.address, category_id = EXCLUDED.category_id,
        processing_days = EXCLUDED.processing_days, updated_at = now()`);
      res.json({ saved: true });
    } catch (error) { failure(res, error); }
  });

  app.post("/api/checkout/rates", checkoutAccess, requestRateLimit("aggregator-rates", 15, 60), async (req: any, res) => {
    try {
      const receiver = deliverySchema.parse(req.body.shippingAddress);
      const cart = await storage.getCartItems(req.user.id);
      if (!cart.length) throw new AggregatorError("Your cart is empty.", 400);
      const subtotal = calculateCheckoutSubtotal(cart);
      const groups: ProviderPackage[][] = [];
      for (const vendorId of Array.from(new Set(cart.map(c => c.product.vendorId)))) {
        const vendor = await storage.getVendor(vendorId);
        if (vendor?.status !== "approved") throw new AggregatorError("A seller is unavailable. Remove their items to continue.", 409);
        const profiles = await db.execute(sql`SELECT * FROM vendor_shipping_profiles WHERE vendor_id = ${vendorId}`);
        const profile: any = profiles.rows[0];
        if (!profile) throw new AggregatorError(`${vendor.businessName} must finish their pickup address setup before these items can be shipped.`, 409);
        const items = cart.filter(c => c.product.vendorId === vendorId);
        const dimensions = items.map(c => ({ ...parcelDimensions(c.product.dimensions), quantity: c.quantity }));
        const unitItems = items.map(c => {
          const weight = Number(c.product.weight);
          if (!Number.isFinite(weight) || weight <= 0) throw new AggregatorError(`The seller must add a shipping weight for ${c.product.name}.`, 409);
          return { name: c.product.name, description: c.product.description.slice(0,250), unit_weight: weight, unit_amount: Number(c.product.price), quantity: c.quantity };
        });
        const pickup = new Date(Date.now() + Number(profile.processing_days) * 86400_000).toISOString().slice(0,10);
        groups.push(await ratesForPackage({
          vendorId, sender: deliverySchema.parse(profile.address), receiver, categoryId: profile.category_id,
          items: unitItems, pickupDate: pickup,
          dimensions: { length: Math.max(...dimensions.map(d => d.length)), width: Math.max(...dimensions.map(d => d.width)),
            height: dimensions.reduce((sum,d) => sum + d.height * d.quantity,0) },
        }));
      }
      const options = [];
      for (const option of selectDeliveryOptions(groups)) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
        const quote = await storage.createShippingQuoteRequest({
          userId: req.user.id, carrier: `Shipbubble ${option.name}`, status: "quoted",
          shippingAddress: { ...receiver, _aggregator: { provider: "shipbubble", packages: option.packages } },
          cartSnapshot: cart.map(c => ({ productId: c.productId, quantity: c.quantity, selectedSize: c.selectedSize, unitPrice: c.product.price })),
          cartFingerprint: shippingFingerprint(cart),
          totalWeight: cart.reduce((sum,c) => sum + Number(c.product.weight) * c.quantity,0).toFixed(2),
          currency: "NGN", quotedAmount: option.shippingAmount.toFixed(2), estimatedDelivery: option.deliveryDate, expiresAt,
        });
        options.push({ id: quote.id, carrier: String(quote.id), service: `${option.name} · ${option.packages.map(p=>p.carrier).join(" + ")}`,
          price: option.shippingAmount, duration: `Expected ${new Date(option.deliveryDate).toLocaleDateString("en-GB", {timeZone:"UTC",day:"numeric",month:"short",year:"numeric"})}`,
          deliveryDate: option.deliveryDate, dutiesAmount: option.dutiesAmount,
          notes: option.packages.some(p=>p.dutiesPaid) ? "Import duties paid up front. No duties due on delivery." : "",
          quoteRequired: false, quoteRequestId: quote.id, expiresAt, currency:"NGN" });
      }
      res.set("Cache-Control", "no-store").json({ quotes: options, subtotal });
    } catch (error) { failure(res, error); }
  });

  async function ownedQuote(req: any) {
    const id = z.coerce.number().int().positive().parse(req.body.shippingQuoteId);
    const quote = await storage.getShippingQuoteRequest(id);
    const cart = await storage.getCartItems(req.user.id);
    if (!quote || quote.userId !== req.user.id || quote.status !== "quoted" ||
      !quote.expiresAt || quote.expiresAt <= new Date() || quote.currency !== "NGN" ||
      !(quote.shippingAddress as any)?._aggregator || quote.cartFingerprint !== shippingFingerprint(cart) ||
      !addressMatch(quote.shippingAddress, req.body.shippingAddress)) {
      throw new AggregatorError("This delivery rate expired or your cart changed. Fetch new shipping options.", 409);
    }
    const subtotal = calculateCheckoutSubtotal(cart);
    for (const vendorId of Array.from(new Set(cart.map(c=>c.product.vendorId)))) {
      if ((await storage.getVendor(vendorId))?.status!=="approved") throw new AggregatorError("A seller is no longer available. Refresh your cart before paying.",409);
    }
    const shippingAmount = Number(quote.quotedAmount);
    const quotedPackages = (quote.shippingAddress as any)._aggregator.packages as ProviderPackage[];
    if (!Array.isArray(quotedPackages) || Math.round(quotedPackages.reduce((sum,p)=>sum+p.amount+p.duties,0)*100)!==Math.round(shippingAmount*100)) throw new AggregatorError("The provider rate changed. Fetch fresh delivery options.",409);
    const totalAmount = Math.round((subtotal + shippingAmount)*100)/100;
    if (!Number.isFinite(shippingAmount) || shippingAmount <= 0 || !Number.isFinite(totalAmount)) throw new AggregatorError("Invalid delivery rate.",409);
    return { quote, cart, subtotal, shippingAmount, totalAmount };
  }
  app.post("/api/checkout/total", checkoutAccess, async (req: any, res) => {
    try {
      const { subtotal, shippingAmount, totalAmount } = await ownedQuote(req);
      res.set("Cache-Control","no-store").json({ subtotal, shippingAmount, totalAmount, currency:"NGN", estimated:false });
    } catch (error) { failure(res,error); }
  });
  app.post("/api/checkout/pay", checkoutAccess, requestRateLimit("aggregator-checkout", 10, 60), async (req: any,res) => {
    try {
      if (!isPaystackInitialized()) throw new AggregatorError("Payment is unavailable. Please retry later.");
      const requestId = z.string().min(12).max(100).regex(/^[A-Za-z0-9_-]+$/).parse(req.body.checkoutRequestId);
      // Serialize retries across app instances. Never hold a fresh quote
      // reservation while returning an older payment attempt.
      const order = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${requestId}))`);
        const [existing] = await tx.select().from(orders).where(eq(orders.checkoutRequestId, requestId));
        if (existing) {
          if (existing.userId !== req.user.id) throw new AggregatorError("Checkout request unavailable.",409);
          if (!addressMatch(existing.shippingAddress,req.body.shippingAddress) || existing.shippingQuoteRequestId !== Number(req.body.shippingQuoteId)) throw new AggregatorError("This checkout belongs to a different delivery selection. Return to the original checkout or contact support before starting another payment.",409);
          if (existing.paymentStatus !== "pending" || existing.orderStatus !== "pending" ||
            Date.now() - new Date(existing.createdAt!).getTime() > 24*3600_000) throw new AggregatorError("This checkout is completed or closed. Do not pay again.",409);
          if (Math.round(Number(existing.totalAmount)*100) !== Math.round(Number(req.body.expectedTotalAmount)*100)) throw new AggregatorError("Review the updated total before paying.",409);
          return existing;
        }
        const { quote, cart, shippingAmount, totalAmount } = await ownedQuote(req);
        if (Math.round(Number(req.body.expectedTotalAmount)*100) !== Math.round(totalAmount*100)) throw new AggregatorError("Review the updated total before paying.",409);
        // This storage method claims the quote transactionally, creates the
        // order and its immutable item snapshot, and enforces single-use rates.
        const created = await storage.createOrderWithReservedShippingQuote({
          userId:req.user.id, totalAmount:totalAmount.toFixed(2), shippingAmount:shippingAmount.toFixed(2),
          shippingFinalAmount:shippingAmount.toFixed(2), shippingEstimatedAmount:null,
          shippingAddress:{ ...(quote.shippingAddress as any), guestCheckout:!!req.guestCheckout,_paymentOwnerId:req.user.id },
          shippingMethod:quote.carrier, shippingQuoteRequestId:quote.id,
          shippingPaymentStatus:"included", paymentStatus:"pending", orderStatus:"pending",
          paymentReference:`order_${crypto.randomUUID()}`, checkoutRequestId:requestId,
        },quote.id,req.user.id,cart.map(c => ({
          productId:c.productId, quantity:c.quantity, priceAtTime:c.product.price, selectedSize:c.selectedSize,
        })));
        if (!created) throw new AggregatorError("This delivery rate is already in use. Refresh shipping options.",409);
        return created;
      });
      if (order.paymentUrl) return res.json({order,paymentUrl:order.paymentUrl,reference:order.paymentReference});
      const contact = deliverySchema.parse(order.shippingAddress);
      const result = await getPaystackService().initializeTransaction(contact.contactEmail,Number(order.totalAmount),order.paymentReference!,{
        orderId:order.id,userId:order.userId,shippingMethod:order.shippingMethod,
      },`${req.protocol}://${req.get("host")}/api/payment/callback`,"NGN");
      if (!result?.data?.authorization_url) throw new AggregatorError("Payment initialization failed. Retry this checkout, not a second order.");
      await db.update(orders).set({ paymentUrl:result.data.authorization_url,updatedAt:new Date() }).where(and(eq(orders.id,order.id),eq(orders.paymentStatus,"pending")));
      res.json({order,paymentUrl:result.data.authorization_url,reference:order.paymentReference});
    } catch(error) { failure(res,error); }
  });

  app.post("/api/admin/orders/:id/aggregator-book", isAuthenticated, async (req: any,res) => {
    if (!(req.user.roles || []).some((r:string)=>["admin","superadmin"].includes(r))) return res.sendStatus(403);
    try {
      const orderId = z.coerce.number().int().positive().parse(req.params.id);
      if (req.body.confirmWalletCharge !== true) throw new AggregatorError("Confirm that booking charges the shipping provider wallet.",400);
      const order = await storage.getOrder(orderId);
      if (!order || order.paymentStatus !== "paid" || order.orderStatus !== "processing") throw new AggregatorError("Only a paid, processing order can be booked.",409);
      const packages = (order.shippingAddress as any)?._aggregator?.packages as ProviderPackage[] | undefined;
      if (!packages?.length) throw new AggregatorError("This is not an aggregator order.",409);
      const quote = await storage.getShippingQuoteRequest(order.shippingQuoteRequestId!);
      if (!quote?.createdAt || Date.now()-new Date(quote.createdAt).getTime()>=7*86400_000) throw new AggregatorError("The provider rate expired before booking. Contact support to reconcile it; do not charge the buyer or retry an uncertain booking.",409);
      for (const p of packages) {
        if(p.pickupDate && p.pickupDate < new Date().toISOString().slice(0,10)) throw new AggregatorError("The scheduled pickup date passed. Hold the booking for support to reconcile the carrier rate and pickup date.",409);
        if (p.dutiesPaid && (!quote.expiresAt || quote.expiresAt <= new Date())) {
          const renewed = await shipbubble(`/shipping/landed-cost?request_token=${encodeURIComponent(p.requestToken)}&store_checkout_currency=NGN`);
          if (renewed?.currency!=="NGN" || Math.round(Number(renewed.amount)*100)!==Math.round(p.duties*100)) throw new AggregatorError("Import duties changed after payment. Hold this booking for financial review; do not charge the buyer again.",409);
        }
        const shipment = await db.transaction(async tx => {
          const [row] = await tx.select().from(shipments).where(and(eq(shipments.orderId,orderId),eq(shipments.vendorId,p.vendorId),eq(shipments.initialPackage,true))).for("update");
          if (!row || !["preparing","ready_for_pickup"].includes(row.status)) throw new AggregatorError("This package is not available for carrier booking.",409);
          if (row.bookingReference?.startsWith("SB-")) return null;
          if (row.bookingReference) throw new AggregatorError("This package has an uncertain booking attempt. Do not book it twice.",409);
          await tx.update(shipments).set({bookingReference:`attempt_${crypto.randomUUID()}`,updatedAt:new Date()}).where(eq(shipments.id,row.id));
          return row;
        });
        if (!shipment) continue;
        // Persist the claim before contacting the provider. An ambiguous
        // network failure must remain held for staff reconciliation, not retry.
        const label = await createProviderLabel(p);
        if (typeof label?.order_id !== "string" || label?.payment?.status !== "completed") throw new AggregatorError("The provider did not confirm booking. Contact support before retrying.",409);
        await db.update(shipments).set({
          bookingReference:label.order_id,bookingAcceptedAt:new Date(),
          ...(label.ship_from?.name && label.ship_from?.phone && label.ship_from?.address ? {
            pickupAddress:{contactName:label.ship_from.name,phone:label.ship_from.phone,address1:label.ship_from.address,address2:"",city:"",state:"",postalCode:"",country:""},
          }:{}),
          ...(p.pickupDate ? {pickupScheduledAt:new Date(`${p.pickupDate}T12:00:00Z`)}:{}),
          trackingNumber:label.courier?.tracking_code || null,trackingUrl:safeProviderUrl(label.tracking_url),
          deliveryAddress:{...(shipment.deliveryAddress as any),_aggregatorLabel:{provider:"shipbubble",labelUrl:safeProviderUrl(label.waybill_document)}},
          updatedAt:new Date(),
        }).where(eq(shipments.id,shipment.id));
      }
      res.json({booked:true});
    } catch(error) { failure(res,error); }
  });
  app.post("/api/admin/orders/:id/aggregator-sync", isAuthenticated, async (req:any,res) => {
    if (!(req.user.roles || []).some((r:string)=>["admin","superadmin"].includes(r))) return res.sendStatus(403);
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const rows = await db.select().from(shipments).where(eq(shipments.orderId,id));
      for (const row of rows) if (row.bookingReference?.startsWith("SB-")) await syncProviderShipment(row.bookingReference);
      res.json({synced:true});
    } catch(error) { failure(res,error); }
  });
  app.post("/api/checkout/shipbubble/webhook", async (req: any,res) => {
    if (!Buffer.isBuffer(req.rawBody) || !validShipbubbleSignature(req.rawBody,req.headers["x-ship-signature"])) return res.sendStatus(401);
    try {
      if (typeof req.body.order_id === "string") await syncProviderShipment(req.body.order_id);
      res.sendStatus(200);
    } catch { res.sendStatus(503); }
  });
}

function safeProviderUrl(value: unknown): string | null {
  try {
    const u = new URL(String(value));
    if (u.protocol !== "https:" || u.username || u.password ||
      u.hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return null;
    return u.href;
  } catch { return null; }
}

async function syncProviderShipment(reference: string) {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.bookingReference,reference));
  if (!shipment || ["delivered","returned","cancelled"].includes(shipment.status)) return;
  const order = await storage.getOrder(shipment.orderId);
  if (!order || order.paymentStatus !== "paid" || ["cancelled","expired","payment_review"].includes(order.orderStatus || "")) return;
  // Read authoritative provider data, not a webhook's asserted status.
  const data = await shipbubble(`/shipping/labels/list/${encodeURIComponent(reference)}`);
  const found = data?.results?.find((s:any)=>s.order_id===reference);
  if (!found) throw new AggregatorError("The provider shipment could not be found. Existing tracking was not changed.");
  const tracking = typeof found.courier?.tracking_code === "string" ? found.courier.tracking_code.trim() : shipment.trackingNumber;
  const mapped:Record<string,string> = {picked_up:"collected",in_transit:"in_transit",completed:"delivered"};
  const status = mapped[found.status];
  if (status && !tracking) throw new AggregatorError("The carrier must issue a tracking number before this shipment can advance.",409);
  const rank:Record<string,number> = {preparing:0,ready_for_pickup:1,pickup_scheduled:2,collected:3,in_transit:4,out_for_delivery:5,delivered:6};
  await db.transaction(async tx => {
    const [current] = await tx.select().from(shipments).where(eq(shipments.id,shipment.id)).for("update");
    if (!current || ["delivered","returned","cancelled"].includes(current.status)) return;
    const next = status && rank[status]>=rank[current.status] ? status : current.status;
    await tx.update(shipments).set({
      status:next,trackingNumber:tracking,trackingUrl:safeProviderUrl(found.tracking_url),
      deliveryAddress:{...(current.deliveryAddress as any),_aggregatorLabel:{provider:"shipbubble",labelUrl:safeProviderUrl(found.waybill_document)}},
      ...(next==="collected"?{collectedAt:new Date()}:{}),
      ...(next==="delivered"?{deliveryEvidence:`Shipbubble confirmed delivery for ${reference}, tracking ${tracking}.`}:{}),updatedAt:new Date(),
    }).where(eq(shipments.id,current.id));
    if(next!==current.status) await tx.insert(shipmentEvents).values({
      shipmentId:current.id,status:next,type:"carrier_tracking",source:"carrier",
      note:`Shipbubble API confirmed ${found.status}; tracking ${tracking}.`,
      ...(next==="delivered"?{deliveryEvidence:`Provider delivery confirmation ${reference}.`}:{}),
    });
    const siblings = await tx.select().from(shipments).where(eq(shipments.orderId,order.id));
    const allDelivered = siblings.every(s=>s.status==="delivered");
    const allShipped = siblings.every(s=>s.trackingNumber && ["collected","in_transit","out_for_delivery","delivered"].includes(s.status));
    if (allDelivered || allShipped) await tx.update(orders).set({
      orderStatus:allDelivered?"delivered":"shipped",trackingNumber:siblings.find(s=>s.trackingNumber)?.trackingNumber,updatedAt:new Date(),
    }).where(and(eq(orders.id,order.id),eq(orders.paymentStatus,"paid")));
  });
}
