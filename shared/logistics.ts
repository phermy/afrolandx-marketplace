import { z } from "zod";
import { normalizeAccountPhone } from "./account-registration";

export const shipmentStatuses = ["preparing", "ready_for_pickup", "pickup_scheduled", "collected", "in_transit", "out_for_delivery", "delivered", "delayed", "delivery_failed", "returned"] as const;
export type ShipmentStatus = typeof shipmentStatuses[number];
export const shipmentTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  preparing: ["ready_for_pickup"], ready_for_pickup: ["pickup_scheduled", "delayed"],
  pickup_scheduled: ["collected", "delayed", "delivery_failed"],
  collected: ["in_transit", "delayed", "delivery_failed"],
  in_transit: ["out_for_delivery", "delayed", "delivery_failed", "returned"],
  out_for_delivery: ["delivered", "delayed", "delivery_failed", "returned"],
  delivered: ["returned"], returned: [],
  delayed: ["pickup_scheduled", "collected", "in_transit", "out_for_delivery", "delivery_failed", "returned"],
  delivery_failed: ["pickup_scheduled", "collected", "in_transit", "out_for_delivery", "returned"],
};
export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  preparing: "Preparing", ready_for_pickup: "Ready for pickup", pickup_scheduled: "Pickup scheduled",
  collected: "Collected", in_transit: "In transit", out_for_delivery: "Out for delivery",
  delivered: "Delivered", delayed: "Delayed", delivery_failed: "Delivery failed", returned: "Returned",
};
export const pickupAddressSchema = z.object({
  contactName: z.string().trim().min(2).max(120),
  phone: z.string().transform((value, ctx) => {
    const phone = normalizeAccountPhone(value);
    if (!phone) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid pickup phone." }); return z.NEVER; }
    return phone;
  }),
  address1: z.string().trim().min(3).max(250), address2: z.string().trim().max(250).default(""),
  city: z.string().trim().min(2).max(120), state: z.string().trim().min(2).max(120),
  postalCode: z.string().trim().min(1).max(30), country: z.string().trim().min(2).max(100),
});
export type PickupAddress = z.infer<typeof pickupAddressSchema>;
export type ShipmentItem = { productId: number; name: string; quantity: number };
export type LogisticsAccess = {
  admin: boolean; vendorId: number | null; partnerIds: number[];
  invitations: { id: number; partnerName: string }[];
};
export type LogisticsPartnerView = {
  id: number; name: string; contactEmail: string; phone: string | null; active: boolean;
  members: { id: number; email: string; active: boolean; accepted: boolean }[];
};
export type ShipmentEventView = {
  id: number; status: string; type: string; note: string; source: "system" | "admin" | "partner" | "vendor" | "customer";
  createdAt: string; deliveryEvidence?: string | null;
  actorName?: string;
};
export type ShipmentQuoteView = {
  id: number; amount: string; status: string; estimatedDelivery: string; notes: string | null;
  createdAt: string; reviewNote: string | null;
};
export type ShipmentView = {
  id: number; orderId: number; vendorId: number; vendorName: string; partnerId: number | null; partnerName: string | null;
  status: ShipmentStatus; items: ShipmentItem[];
  pickupAddress: PickupAddress | null; deliveryAddress: Record<string, string>;
  weightKg: string | null; dimensions: string | null; trackingNumber: string | null; trackingUrl: string | null;
  pickupScheduledAt: string | null; bookingReference: string | null; bookingAcceptedAt: string | null;
  readyAt: string | null; deliveryEvidence: string | null; createdAt: string;
  buyerShippingStatus: string; buyerShippingAmount: string | null; customerQuoteRequestId: number | null;
  approvedQuoteId?: number | null; quotes?: ShipmentQuoteView[];
  agencyPayment?: { amount: string; invoiceReference: string; paymentReference: string; paidAt: string; note: string | null } | null;
  events: ShipmentEventView[];
};
export type ShipmentsResponse = {
  shipments: ShipmentView[];
  eligibleOrders: { id: number; createdAt: string; buyerName: string }[];
  notificationFailures?: number;
};
export const logisticsNoteSchema = z.string().trim().min(3).max(2000);
export const shipmentUpdateSchema = z.object({
  status: z.enum(shipmentStatuses),
  note: logisticsNoteSchema,
  correction: z.boolean().default(false),
  reason: z.string().trim().max(1000).optional(),
  trackingNumber: z.string().trim().min(3).max(120).optional(),
  trackingUrl: z.string().url().max(1000).refine(value => new URL(value).protocol === "https:", "Tracking links must use HTTPS.").optional(),
  pickupScheduledAt: z.string().datetime({ offset: true }).optional(),
  deliveryEvidence: z.string().trim().min(5).max(2000).optional(),
  pickupAddress: pickupAddressSchema.optional(),
  weightKg: z.coerce.number().positive().max(10000).optional(),
  dimensions: z.string().trim().min(3).max(120).optional(),
});
export const partnerQuoteSchema = z.object({
  amount: z.coerce.number().positive().max(100000000).refine(value => Number.isInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use at most two decimal places."),
  estimatedDelivery: z.string().trim().min(3).max(150),
  notes: z.string().trim().max(2000).default(""),
});
export const splitShipmentSchema = z.object({
  requestKey: z.string().uuid(),
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1).max(200),
  reason: logisticsNoteSchema,
});
