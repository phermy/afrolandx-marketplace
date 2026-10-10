import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  integer,
  decimal,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const RETURN_POLICY_OPTIONS = [
  {
    value: "standard_returns",
    label: "Standard returns accepted",
    description: "Eligible returns follow the standard AfrolandX return and refund process.",
  },
  {
    value: "final_sale",
    label: "Final sale",
    description: "Change-of-mind returns are not accepted, subject to applicable consumer rights.",
  },
  {
    value: "custom_made",
    label: "Custom-made item",
    description: "Made-to-order or personalised items are normally non-returnable unless faulty or not as described.",
  },
  {
    value: "hygiene_sensitive",
    label: "Hygiene-sensitive item",
    description: "Returns may be restricted after opening, use, or removal of a hygiene seal.",
  },
] as const;

export const RETURN_POLICY_VALUES = RETURN_POLICY_OPTIONS.map(option => option.value) as [
  (typeof RETURN_POLICY_OPTIONS)[number]["value"],
  ...(typeof RETURN_POLICY_OPTIONS)[number]["value"][],
];
export const returnPolicySchema = z.enum(RETURN_POLICY_VALUES);
export type ReturnPolicyValue = z.infer<typeof returnPolicySchema>;

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().notNull(),
    email: varchar("email"),
    password: varchar("password"), // hashed password for email/password auth
    firstName: varchar("first_name"),
    lastName: varchar("last_name"),
    phone: varchar("phone", { length: 30 }),
    signupIntent: varchar("signup_intent", { length: 16 }).default("customer"),
    profileImageUrl: varchar("profile_image_url"),
    roles: jsonb("roles").default(["customer"]), // array of roles: customer, vendor, admin
    emailVerified: boolean("email_verified").default(false),
    emailOtp: varchar("email_otp"), // keyed digest; never store the code itself
    emailOtpExpiry: timestamp("email_otp_expiry"),
    passwordResetOtp: varchar("password_reset_otp"), // keyed digest
    passwordResetOtpExpiry: timestamp("password_reset_otp_expiry"),
    loginOtp: varchar("login_otp"), // keyed digest
    loginOtpExpiry: timestamp("login_otp_expiry"),
    activeSessionId: varchar("active_session_id"), // enforces single active session
    closedAt: timestamp("closed_at"), // blocked account; keep linked orders, payouts, and audit history
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
  ],
);

export const logisticsPartners = pgTable("logistics_partners", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  contactEmail: varchar("contact_email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const logisticsPartnerMembers = pgTable("logistics_partner_members", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => logisticsPartners.id),
  email: varchar("email", { length: 254 }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  active: boolean("active").notNull().default(true),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [uniqueIndex("logistics_partner_members_email_unique").on(table.partnerId, table.email)]);

// Vendors table
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  contactName: varchar("contact_name"),
  businessName: text("business_name").notNull(),
  phone: varchar("phone"),
  cacNumber: varchar("cac_number"),
  description: text("description"),
  status: varchar("status").default("pending"), // pending, approved, suspended
  verificationStatus: varchar("verification_status", { length: 32 }).notNull().default("pending"), // pending, submitted, verified, rejected
  cacVerifiedAt: timestamp("cac_verified_at"),
  identityVerifiedAt: timestamp("identity_verified_at"),
  businessVerifiedAt: timestamp("business_verified_at"),
  verificationNotes: text("verification_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("vendors_user_id_unique").on(table.userId),
]);

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  shortDescription: text("short_description"),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  sku: varchar("sku", { length: 100 }),
  stock: integer("stock").notNull().default(0), // renamed from quantity to stock
  weight: decimal("weight", { precision: 5, scale: 2 }), // in kg
  dimensions: varchar("dimensions", { length: 120 }),
  shippingClass: varchar("shipping_class", { length: 60 }),
  processingTime: varchar("processing_time", { length: 120 }),
  careInstructions: text("care_instructions"),
  returnPolicy: text("return_policy"),
  metaTitle: varchar("meta_title", { length: 180 }),
  metaDescription: text("meta_description"),
  requiresMeasurements: boolean("requires_measurements").default(false),
  tags: jsonb("tags").default([]),
  variants: jsonb("variants").default([]),
  imageUrl: text("image_url"), // single image URL for display
  images: jsonb("images").default([]), // array of image URLs for gallery
  sizes: jsonb("sizes").default([]), // string[] — available sizes e.g. ["S","M","L","XL"]
  clientImportKey: varchar("client_import_key", { length: 36 }),
  status: varchar("status").default("pending"), // draft, pending, approved, rejected
  featured: boolean("featured").default(false),
  gender: varchar("gender"), // women, men, kids, or null = unisex/all
  originCountry: varchar("origin_country"), // which African country this fashion is from
  traditionalName: varchar("traditional_name"), // local name of the garment (e.g. Kente, Agbada, Habesha Kemis)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("products_client_import_key_unique").on(table.clientImportKey),
]);

// Shopping cart table
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  selectedSize: varchar("selected_size"), // null = no size required (accessories, fabric etc.)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Buyer-owned delivery addresses. Checkout still sends a validated address
// snapshot so historical orders remain immutable if this record changes.
export const savedDeliveryAddresses = pgTable("saved_delivery_addresses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 80 }).notNull().default("My address"),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  address1: varchar("address1", { length: 250 }).notNull(),
  address2: varchar("address2", { length: 250 }).notNull().default(""),
  city: varchar("city", { length: 120 }).notNull(),
  state: varchar("state", { length: 120 }).notNull(),
  postalCode: varchar("postal_code", { length: 30 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("saved_delivery_addresses_user_idx").on(table.userId),
  uniqueIndex("saved_delivery_addresses_one_default_idx")
    .on(table.userId)
    .where(sql`${table.isDefault} = true`),
]);

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  shippingAmount: decimal("shipping_amount", { precision: 10, scale: 2 }).default("0"),
  shippingEstimatedAmount: decimal("shipping_estimated_amount", { precision: 10, scale: 2 }),
  shippingFinalAmount: decimal("shipping_final_amount", { precision: 10, scale: 2 }),
  shippingRefundAmount: decimal("shipping_refund_amount", { precision: 10, scale: 2 }),
  shippingRefundStatus: varchar("shipping_refund_status", { length: 32 }),
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, failed
  checkoutRequestId: varchar("checkout_request_id", { length: 100 }).unique(),
  paymentUrl: text("payment_url"),
  stockReservationStatus: varchar("stock_reservation_status", { length: 32 }).notNull().default("pending"), // pending, reserved, failed
  orderStatus: varchar("order_status").default("pending"), // pending, processing, shipped, delivered, cancelled
  shippingAddress: jsonb("shipping_address").notNull(),
  paymentReference: varchar("payment_reference"),
  shippingMethod: varchar("shipping_method"), // ups, fedex, dhl
  shippingQuoteRequestId: integer("shipping_quote_request_id").references(() => shippingQuoteRequests.id).unique(),
  shippingPaymentStatus: varchar("shipping_payment_status", { length: 32 }).notNull().default("included"), // included, awaiting_quote, pending, paid, rejected
  shippingPaymentReference: varchar("shipping_payment_reference"),
  shippingPaymentUrl: text("shipping_payment_url"),
  trackingNumber: varchar("tracking_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  partnerId: integer("partner_id").references(() => logisticsPartners.id),
  assignmentRevision: integer("assignment_revision").notNull().default(0),
  initialPackage: boolean("initial_package").notNull().default(true),
  splitRequestKey: varchar("split_request_key", { length: 36 }),
  splitFromId: integer("split_from_id"),
  status: varchar("status", { length: 32 }).notNull().default("preparing"),
  items: jsonb("items").notNull(),
  pickupAddress: jsonb("pickup_address"),
  deliveryAddress: jsonb("delivery_address").notNull(),
  weightKg: decimal("weight_kg", { precision: 10, scale: 3 }),
  dimensions: varchar("dimensions", { length: 120 }),
  readyAt: timestamp("ready_at"),
  collectedAt: timestamp("collected_at"),
  pickupScheduledAt: timestamp("pickup_scheduled_at"),
  approvedQuoteId: integer("approved_quote_id"),
  bookingReference: varchar("booking_reference", { length: 160 }),
  bookingAcceptedAt: timestamp("booking_accepted_at"),
  trackingNumber: varchar("tracking_number", { length: 120 }),
  trackingUrl: text("tracking_url"),
  deliveryEvidence: text("delivery_evidence"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  uniqueIndex("shipments_initial_vendor_unique").on(table.orderId, table.vendorId).where(sql`${table.initialPackage} = true`),
  uniqueIndex("shipments_split_request_unique").on(table.splitRequestKey),
  index("shipments_partner_idx").on(table.partnerId),
]);
export const shipmentQuotes = pgTable("shipment_quotes", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => shipments.id),
  partnerId: integer("partner_id").notNull().references(() => logisticsPartners.id),
  assignmentRevision: integer("assignment_revision").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  estimatedDelivery: varchar("estimated_delivery", { length: 150 }).notNull(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("submitted"),
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const shipmentAgencyPayments = pgTable("shipment_agency_payments", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => shipments.id),
  partnerId: integer("partner_id").notNull().references(() => logisticsPartners.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  invoiceReference: varchar("invoice_reference", { length: 160 }).notNull(),
  paymentReference: varchar("payment_reference", { length: 160 }).notNull(),
  paidAt: timestamp("paid_at").notNull(),
  recordedBy: varchar("recorded_by").notNull().references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [uniqueIndex("shipment_agency_payments_shipment_unique").on(table.shipmentId), uniqueIndex("shipment_agency_payments_reference_unique").on(table.paymentReference)]);
export const shipmentEvents = pgTable("shipment_events", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => shipments.id),
  status: varchar("status", { length: 32 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  note: text("note").notNull(),
  source: varchar("source", { length: 20 }).notNull(),
  actorId: varchar("actor_id").references(() => users.id),
  deliveryEvidence: text("delivery_evidence"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const logisticsEmailOutbox = pgTable("logistics_email_outbox", {
  id: serial("id").primaryKey(),
  recipient: varchar("recipient", { length: 254 }).notNull(),
  subject: varchar("subject", { length: 250 }).notNull(),
  message: text("message").notNull(),
  attempts: integer("attempts").notNull().default(0),
  deliveredAt: timestamp("delivered_at"),
  nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  priceAtTime: decimal("price_at_time", { precision: 10, scale: 2 }).notNull(),
  selectedSize: varchar("selected_size"), // size chosen by customer at time of order
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendor payout accounts contain only Paystack recipient identifiers and masked
// account details. Full bank account numbers are never stored locally.
export const vendorPayoutAccounts = pgTable("vendor_payout_accounts", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id).unique(),
  provider: varchar("provider", { length: 32 }).notNull().default("paystack"),
  bankCode: varchar("bank_code", { length: 32 }).notNull(),
  bankName: varchar("bank_name", { length: 160 }).notNull(),
  accountName: varchar("account_name", { length: 200 }).notNull(),
  accountLast4: varchar("account_last4", { length: 4 }).notNull(),
  recipientCode: varchar("recipient_code", { length: 120 }).notNull().unique(),
  status: varchar("status", { length: 32 }).notNull().default("verified"),
  verifiedAt: timestamp("verified_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vendorSettlements = pgTable("vendor_settlements", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  payoutAccountId: integer("payout_account_id").notNull().references(() => vendorPayoutAccounts.id),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  grossAmount: decimal("gross_amount", { precision: 12, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),
  adjustmentAmount: decimal("adjustment_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"), // pending, processing, paid, failed
  transferCode: varchar("transfer_code", { length: 120 }),
  providerReference: varchar("provider_reference", { length: 120 }).unique(),
  failureReason: text("failure_reason"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  approvedBy: varchar("approved_by").references(() => users.id),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("vendor_settlements_vendor_idx").on(table.vendorId),
  index("vendor_settlements_status_idx").on(table.status),
]);

export const vendorLedgerEntries = pgTable("vendor_ledger_entries", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  orderId: integer("order_id").notNull().references(() => orders.id),
  settlementId: integer("settlement_id").references(() => vendorSettlements.id),
  entryType: varchar("entry_type", { length: 32 }).notNull(), // sale, refund, chargeback
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  grossAmount: decimal("gross_amount", { precision: 12, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"), // pending, available, settled
  externalReference: varchar("external_reference", { length: 160 }),
  description: text("description"),
  availableAt: timestamp("available_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("vendor_ledger_vendor_idx").on(table.vendorId),
  index("vendor_ledger_order_idx").on(table.orderId),
  uniqueIndex("vendor_ledger_reference_unique").on(table.vendorId, table.entryType, table.externalReference),
]);

export const orderFinancialAdjustments = pgTable("order_financial_adjustments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  kind: varchar("kind", { length: 32 }).notNull(), // refund, chargeback
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  providerReference: varchar("provider_reference", { length: 160 }).notNull().unique(),
  reason: text("reason").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("order_financial_adjustments_order_idx").on(table.orderId),
]);

// Notifications table for vendor and admin notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // 'order_placed', 'product_sold', 'vendor_approved', etc.
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  isRead: boolean("is_read").notNull().default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("notifications_stalled_order_unique")
    .on(table.userId, table.type, table.orderId)
    .where(sql`${table.type} LIKE 'stalled_order:%' AND ${table.orderId} IS NOT NULL`),
]);

// International shipping quotes requested by buyers and confirmed by admins.
export const shippingQuoteRequests = pgTable("shipping_quote_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  carrier: varchar("carrier", { length: 120 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"), // pending, quoted, reserved, used, rejected, expired
  shippingAddress: jsonb("shipping_address").notNull(),
  cartSnapshot: jsonb("cart_snapshot").notNull(),
  cartFingerprint: varchar("cart_fingerprint", { length: 64 }).notNull(),
  totalWeight: decimal("total_weight", { precision: 10, scale: 2 }).notNull().default("0"),
  quotedAmount: decimal("quoted_amount", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
  estimatedDelivery: varchar("estimated_delivery", { length: 160 }),
  adminNotes: text("admin_notes"),
  confirmedBy: varchar("confirmed_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("shipping_quote_requests_user_idx").on(table.userId),
  index("shipping_quote_requests_status_idx").on(table.status),
]);

// Measurements table for customer body measurements
export const measurements = pgTable("measurements", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  orderId: integer("order_id").references(() => orders.id), // optional - link to specific order
  productId: integer("product_id").references(() => products.id), // optional - link to specific product
  vendorId: integer("vendor_id").references(() => vendors.id), // vendor who will receive the measurements
  
  // Body measurements (all in centimeters for consistency)
  chest: decimal("chest", { precision: 5, scale: 2 }), // Chest/Bust circumference
  waist: decimal("waist", { precision: 5, scale: 2 }), // Waist circumference
  hips: decimal("hips", { precision: 5, scale: 2 }), // Hip circumference
  shoulderWidth: decimal("shoulder_width", { precision: 5, scale: 2 }), // Shoulder to shoulder
  sleeveLength: decimal("sleeve_length", { precision: 5, scale: 2 }), // Shoulder to wrist
  armLength: decimal("arm_length", { precision: 5, scale: 2 }), // Full arm length
  inseam: decimal("inseam", { precision: 5, scale: 2 }), // Inner leg length
  outseam: decimal("outseam", { precision: 5, scale: 2 }), // Outer leg length
  neck: decimal("neck", { precision: 5, scale: 2 }), // Neck circumference
  height: decimal("height", { precision: 5, scale: 2 }), // Total height
  
  // Scan metadata
  scanMethod: varchar("scan_method").default("manual"), // manual or ai_scan
  scanSessionId: varchar("scan_session_id"), // 3DLOOK session ID
  scanData: jsonb("scan_data"), // Additional scan metadata from 3DLOOK
  
  // Additional info
  unit: varchar("unit").default("cm"), // cm or inches
  notes: text("notes"), // Special instructions or notes
  status: varchar("status").default("pending"), // pending, received, acknowledged
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages table for vendor-customer communication
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  recipientId: varchar("recipient_id").notNull().references(() => users.id),
  productId: integer("product_id").references(() => products.id), // optional - link to specific product being discussed
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// FEATURE 1: Bespoke Lookbook Studio
// ============================================

// Occasion profiles for outfit recommendations
export const occasionProfiles = pgTable("occasion_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: varchar("event_type").notNull(), // wedding, naming_ceremony, festival, party, traditional, casual
  eventName: varchar("event_name"), // Custom name like "My Sister's Wedding"
  eventDate: timestamp("event_date"),
  styleNotes: text("style_notes"), // Preferences like "prefer bright colors"
  referenceImages: jsonb("reference_images").default([]), // Mood board images
  budget: decimal("budget", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI-generated lookbook recommendations
export const lookbookRecommendations = pgTable("lookbook_recommendations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  occasionId: integer("occasion_id").references(() => occasionProfiles.id),
  bundleItems: jsonb("bundle_items").notNull().default([]), // Array of {productId, name, price, reason}
  aiPrompt: text("ai_prompt"), // The prompt used to generate recommendations
  aiResponse: text("ai_response"), // Full AI response
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  status: varchar("status").default("generated"), // generated, viewed, accepted, purchased
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// FEATURE 2: Smart Fit Confidence Score
// ============================================

// Product fit metrics based on customer feedback
export const productFitMetrics = pgTable("product_fit_metrics", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  sizeVariant: varchar("size_variant"), // S, M, L, XL or custom
  avgAlterationDelta: decimal("avg_alteration_delta", { precision: 5, scale: 2 }), // Average alteration needed
  returnRate: decimal("return_rate", { precision: 5, scale: 2 }), // Return percentage
  totalOrders: integer("total_orders").default(0),
  positiveFeedback: integer("positive_feedback").default(0),
  negativeFeedback: integer("negative_feedback").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order feedback for fit scoring
export const orderFeedback = pgTable("order_feedback", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  fitRating: integer("fit_rating"), // 1-5 scale
  alterationNeeded: boolean("alteration_needed").default(false),
  alterationDetails: text("alteration_details"),
  overallRating: integer("overall_rating"), // 1-5 scale
  comment: text("comment"),
  moderationStatus: varchar("moderation_status", { length: 20 }).notNull().default("pending"),
  moderatedAt: timestamp("moderated_at"),
  moderatedBy: varchar("moderated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("order_feedback_order_product_unique").on(table.orderId, table.productId),
]);

// ============================================
// FEATURE 3: Measurement Health Alerts
// ============================================

// Measurement change alerts
export const measurementAlerts = pgTable("measurement_alerts", {
  id: serial("id").primaryKey(),
  measurementId: integer("measurement_id").notNull().references(() => measurements.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  vendorId: integer("vendor_id").references(() => vendors.id),
  alertType: varchar("alert_type").notNull(), // significant_change, missing_data, stale_data
  deltaSummary: jsonb("delta_summary"), // {field: {old, new, change}}
  acknowledgedByVendorId: integer("acknowledged_by_vendor_id").references(() => vendors.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  status: varchar("status").default("pending"), // pending, acknowledged, resolved
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// FEATURE 4: Vendor Workshop Dashboard
// ============================================

// Order production stages
export const orderProductionSteps = pgTable("order_production_steps", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  orderItemId: integer("order_item_id").references(() => orderItems.id),
  stage: varchar("stage").notNull(), // received, fabric_cutting, sewing, finishing, quality_check, ready_to_ship, shipped
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  completedBy: varchar("completed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendor resources/materials tracking
export const vendorResources = pgTable("vendor_resources", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id),
  materialType: varchar("material_type").notNull(), // ankara, aso_oke, lace, adire, etc.
  materialName: varchar("material_name"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  unit: varchar("unit").default("yards"), // yards, meters, pieces
  lowStockThreshold: decimal("low_stock_threshold", { precision: 10, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// FEATURE 5: Event Outfit Planner
// ============================================

// Event collections/bundles
export const eventCollections = pgTable("event_collections", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  eventType: varchar("event_type").notNull(), // wedding, naming_ceremony, festival, burial, chieftaincy
  description: text("description"),
  productIds: jsonb("product_ids").default([]), // Array of product IDs
  familyGrouping: varchar("family_grouping"), // couple, family, bridal_party, groomsmen
  genderTarget: varchar("gender_target"), // male, female, unisex
  priceRange: jsonb("price_range"), // {min, max}
  featured: boolean("featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Event planning is separate from product sales. Supplier estimates and planner
// fee quotations are not collected by the site until a settlement flow is ready.
export const eventPlannerProfiles = pgTable("event_planner_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  businessName: varchar("business_name", { length: 160 }).notNull(),
  location: varchar("location", { length: 160 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventPlans = pgTable("event_plans", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id").notNull().references(() => users.id),
  plannerId: integer("planner_id").notNull().references(() => eventPlannerProfiles.id),
  title: varchar("title", { length: 160 }).notNull(),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  eventDate: varchar("event_date", { length: 10 }).notNull(),
  location: varchar("location", { length: 160 }).notNull(),
  guestCount: integer("guest_count").notNull(),
  budgetNgn: integer("budget_ngn"),
  needs: text("needs").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("requested"),
  quoteItems: jsonb("quote_items").notNull().default([]),
  quoteVersion: integer("quote_version").notNull().default(0),
  plannerFeeNgn: integer("planner_fee_ngn"),
  commissionNgn: integer("commission_ngn"),
  plannerNetNgn: integer("planner_net_ngn"),
  quoteValidUntil: timestamp("quote_valid_until"),
  // Reserved for a future verified checkout and settlement workflow.
  paymentReference: varchar("payment_reference", { length: 100 }).unique(),
  paidAt: timestamp("paid_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, table => [
  index("event_plans_customer_idx").on(table.customerId),
  index("event_plans_planner_idx").on(table.plannerId),
]);

export const eventPlannerEarnings = pgTable("event_planner_earnings", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventPlans.id).unique(),
  plannerId: integer("planner_id").notNull().references(() => eventPlannerProfiles.id),
  grossNgn: integer("gross_ngn").notNull(),
  commissionNgn: integer("commission_ngn").notNull(),
  netNgn: integer("net_ngn").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("commission_due"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventPlanMessages = pgTable("event_plan_messages", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventPlans.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, table => [index("event_plan_messages_event_idx").on(table.eventId)]);

// ============================================
// FEATURE 6: Cultural Story Capsules
// ============================================

// Product stories and cultural content
export const productStories = pgTable("product_stories", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  storyType: varchar("story_type").notNull(), // origin, artisan, cultural_significance, making_process
  title: varchar("title").notNull(),
  content: text("content"),
  mediaAssets: jsonb("media_assets").default([]), // Array of {type, url, duration}
  transcript: text("transcript"), // For audio/video content
  storyteller: varchar("storyteller"), // Name of artisan/narrator
  culturalRegion: varchar("cultural_region"), // yoruba, igbo, hausa, edo, etc.
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// FEATURE 7: Loyalty & Rewards Program
// ============================================

// Loyalty accounts
export const loyaltyAccounts = pgTable("loyalty_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  tier: varchar("tier").default("bronze"), // bronze, silver, gold, platinum
  points: integer("points").default(0),
  lifetimePoints: integer("lifetime_points").default(0),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by").references(() => users.id),
  tierUpdatedAt: timestamp("tier_updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Loyalty events/transactions
export const loyaltyEvents = pgTable("loyalty_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  actionType: varchar("action_type").notNull(), // purchase, referral, quiz_complete, review, social_share
  pointsDelta: integer("points_delta").notNull(), // Can be positive or negative
  description: text("description"),
  referenceId: integer("reference_id"), // orderId, quizId, etc.
  referenceType: varchar("reference_type"), // order, quiz, referral
  createdAt: timestamp("created_at").defaultNow(),
});

// Cultural quizzes for engagement
export const culturalQuizzes = pgTable("cultural_quizzes", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  questions: jsonb("questions").notNull().default([]), // Array of {question, options, correctIndex}
  rewardPoints: integer("reward_points").default(10),
  difficulty: varchar("difficulty").default("easy"), // easy, medium, hard
  culturalTopic: varchar("cultural_topic"), // fashion_history, fabric_types, regional_styles
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Quiz attempts
export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  quizId: integer("quiz_id").notNull().references(() => culturalQuizzes.id),
  answers: jsonb("answers").default([]), // User's answers
  score: integer("score").default(0),
  passed: boolean("passed").default(false),
  pointsEarned: integer("points_earned").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// FEATURE 8: Live Fabric Viewer
// ============================================

// Fabric 3D/AR assets
export const fabricAssets = pgTable("fabric_assets", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  assetType: varchar("asset_type").notNull(), // texture_2d, texture_3d, ar_model
  filePath: text("file_path").notNull(),
  thumbnailPath: text("thumbnail_path"),
  metadata: jsonb("metadata"), // {width, height, fileSize, format}
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// FEATURE 9: Designer Collaboration Hub
// ============================================

// Collaboration drops
export const collabDrops = pgTable("collab_drops", {
  id: serial("id").primaryKey(),
  designerId: integer("designer_id").notNull().references(() => vendors.id),
  artisanId: integer("artisan_id").references(() => vendors.id),
  name: varchar("name").notNull(),
  description: text("description"),
  dropStartTime: timestamp("drop_start_time").notNull(),
  dropEndTime: timestamp("drop_end_time"),
  rsvpCap: integer("rsvp_cap"), // Max RSVPs allowed
  rsvpCount: integer("rsvp_count").notNull().default(0),
  productIds: jsonb("product_ids").default([]), // Products in this drop
  status: varchar("status").default("upcoming"), // upcoming, live, ended, cancelled
  isExclusive: boolean("is_exclusive").default(false), // Requires loyalty tier
  minLoyaltyTier: varchar("min_loyalty_tier"), // bronze, silver, gold, platinum
  coverImage: text("cover_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drop RSVPs
export const dropRsvps = pgTable("drop_rsvps", {
  id: serial("id").primaryKey(),
  dropId: integer("drop_id").notNull().references(() => collabDrops.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status").default("confirmed"), // confirmed, cancelled, attended
  notificationSent: boolean("notification_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("drop_rsvps_drop_user_unique").on(table.dropId, table.userId),
]);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  vendor: one(vendors, { fields: [users.id], references: [vendors.userId] }),
  cartItems: many(cartItems),
  orders: many(orders),
  notifications: many(notifications),
  measurements: many(measurements),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "recipient" }),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(users, { fields: [vendors.userId], references: [users.id] }),
  products: many(products),
  measurements: many(measurements),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  vendor: one(vendors, { fields: [products.vendorId], references: [vendors.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
  measurements: many(measurements),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, { fields: [cartItems.userId], references: [users.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  orderItems: many(orderItems),
  measurements: many(measurements),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  order: one(orders, { fields: [notifications.orderId], references: [orders.id] }),
  product: one(products, { fields: [notifications.productId], references: [products.id] }),
}));

export const measurementsRelations = relations(measurements, ({ one }) => ({
  user: one(users, { fields: [measurements.userId], references: [users.id] }),
  order: one(orders, { fields: [measurements.orderId], references: [orders.id] }),
  product: one(products, { fields: [measurements.productId], references: [products.id] }),
  vendor: one(vendors, { fields: [measurements.vendorId], references: [vendors.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id], relationName: "sender" }),
  recipient: one(users, { fields: [messages.recipientId], references: [users.id], relationName: "recipient" }),
  product: one(products, { fields: [messages.productId], references: [products.id] }),
}));

// New feature relations
export const occasionProfilesRelations = relations(occasionProfiles, ({ one, many }) => ({
  user: one(users, { fields: [occasionProfiles.userId], references: [users.id] }),
  recommendations: many(lookbookRecommendations),
}));

export const lookbookRecommendationsRelations = relations(lookbookRecommendations, ({ one }) => ({
  user: one(users, { fields: [lookbookRecommendations.userId], references: [users.id] }),
  occasion: one(occasionProfiles, { fields: [lookbookRecommendations.occasionId], references: [occasionProfiles.id] }),
}));

export const productFitMetricsRelations = relations(productFitMetrics, ({ one }) => ({
  product: one(products, { fields: [productFitMetrics.productId], references: [products.id] }),
}));

export const orderFeedbackRelations = relations(orderFeedback, ({ one }) => ({
  order: one(orders, { fields: [orderFeedback.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderFeedback.productId], references: [products.id] }),
  user: one(users, { fields: [orderFeedback.userId], references: [users.id] }),
}));

export const measurementAlertsRelations = relations(measurementAlerts, ({ one }) => ({
  measurement: one(measurements, { fields: [measurementAlerts.measurementId], references: [measurements.id] }),
  user: one(users, { fields: [measurementAlerts.userId], references: [users.id] }),
  vendor: one(vendors, { fields: [measurementAlerts.vendorId], references: [vendors.id] }),
}));

export const orderProductionStepsRelations = relations(orderProductionSteps, ({ one }) => ({
  order: one(orders, { fields: [orderProductionSteps.orderId], references: [orders.id] }),
  orderItem: one(orderItems, { fields: [orderProductionSteps.orderItemId], references: [orderItems.id] }),
}));

export const vendorResourcesRelations = relations(vendorResources, ({ one }) => ({
  vendor: one(vendors, { fields: [vendorResources.vendorId], references: [vendors.id] }),
}));

export const productStoriesRelations = relations(productStories, ({ one }) => ({
  product: one(products, { fields: [productStories.productId], references: [products.id] }),
}));

export const loyaltyAccountsRelations = relations(loyaltyAccounts, ({ one, many }) => ({
  user: one(users, { fields: [loyaltyAccounts.userId], references: [users.id] }),
  events: many(loyaltyEvents),
}));

export const loyaltyEventsRelations = relations(loyaltyEvents, ({ one }) => ({
  user: one(users, { fields: [loyaltyEvents.userId], references: [users.id] }),
}));

export const culturalQuizzesRelations = relations(culturalQuizzes, ({ many }) => ({
  attempts: many(quizAttempts),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  user: one(users, { fields: [quizAttempts.userId], references: [users.id] }),
  quiz: one(culturalQuizzes, { fields: [quizAttempts.quizId], references: [culturalQuizzes.id] }),
}));

export const fabricAssetsRelations = relations(fabricAssets, ({ one }) => ({
  product: one(products, { fields: [fabricAssets.productId], references: [products.id] }),
}));

export const collabDropsRelations = relations(collabDrops, ({ one, many }) => ({
  designer: one(vendors, { fields: [collabDrops.designerId], references: [vendors.id], relationName: "designer" }),
  artisan: one(vendors, { fields: [collabDrops.artisanId], references: [vendors.id], relationName: "artisan" }),
  rsvps: many(dropRsvps),
}));

export const dropRsvpsRelations = relations(dropRsvps, ({ one }) => ({
  drop: one(collabDrops, { fields: [dropRsvps.dropId], references: [collabDrops.id] }),
  user: one(users, { fields: [dropRsvps.userId], references: [users.id] }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  password: z.string().min(8).optional(),
});

export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  stock: z.number().min(0).default(0),
  imageUrl: z.string().optional(),
  clientImportKey: z.string().uuid().optional().nullable(),
  returnPolicy: returnPolicySchema.nullable().default("standard_returns"),
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedDeliveryAddressSchema = createInsertSchema(savedDeliveryAddresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertShippingQuoteRequestSchema = createInsertSchema(shippingQuoteRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMeasurementSchema = createInsertSchema(measurements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  chest: z.number().positive().optional(),
  waist: z.number().positive().optional(),
  hips: z.number().positive().optional(),
  shoulderWidth: z.number().positive().optional(),
  sleeveLength: z.number().positive().optional(),
  armLength: z.number().positive().optional(),
  inseam: z.number().positive().optional(),
  outseam: z.number().positive().optional(),
  neck: z.number().positive().optional(),
  height: z.number().positive().optional(),
  unit: z.enum(["cm", "inches"]).default("cm"),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
}).extend({
  content: z.string().min(1).max(2000),
});

// New feature schemas
export const insertOccasionProfileSchema = createInsertSchema(occasionProfiles).omit({
  id: true,
  createdAt: true,
}).extend({
  eventType: z.enum(["wedding", "naming_ceremony", "festival", "party", "traditional", "casual", "burial", "chieftaincy"]),
  budget: z.number().positive().optional(),
});

export const insertLookbookRecommendationSchema = createInsertSchema(lookbookRecommendations).omit({
  id: true,
  createdAt: true,
});

export const insertOrderFeedbackSchema = createInsertSchema(orderFeedback).omit({
  id: true,
  createdAt: true,
}).extend({
  fitRating: z.number().min(1).max(5).optional(),
  overallRating: z.number().min(1).max(5).optional(),
});

export const insertProductionStepSchema = createInsertSchema(orderProductionSteps).omit({
  id: true,
  createdAt: true,
}).extend({
  stage: z.enum(["received", "fabric_cutting", "sewing", "finishing", "quality_check", "ready_to_ship", "shipped"]),
});

export const insertVendorResourceSchema = createInsertSchema(vendorResources).omit({
  id: true,
  updatedAt: true,
}).extend({
  quantity: z.number().positive(),
  lowStockThreshold: z.number().positive().optional(),
});

export const insertEventCollectionSchema = createInsertSchema(eventCollections).omit({
  id: true,
  createdAt: true,
}).extend({
  eventType: z.enum(["wedding", "naming_ceremony", "festival", "burial", "chieftaincy", "party"]),
  genderTarget: z.enum(["male", "female", "unisex"]).optional(),
});

export const insertProductStorySchema = createInsertSchema(productStories).omit({
  id: true,
  createdAt: true,
}).extend({
  storyType: z.enum(["origin", "artisan", "cultural_significance", "making_process"]),
  culturalRegion: z.enum(["yoruba", "igbo", "hausa", "edo", "efik", "ijaw", "tiv", "other"]).optional(),
});

export const insertLoyaltyAccountSchema = createInsertSchema(loyaltyAccounts).omit({
  id: true,
  createdAt: true,
  tierUpdatedAt: true,
});

export const insertLoyaltyEventSchema = createInsertSchema(loyaltyEvents).omit({
  id: true,
  createdAt: true,
}).extend({
  actionType: z.enum(["purchase", "referral", "quiz_complete", "review", "social_share", "redeem"]),
});

export const insertCulturalQuizSchema = createInsertSchema(culturalQuizzes).omit({
  id: true,
  createdAt: true,
}).extend({
  difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
  rewardPoints: z.number().positive().default(10),
});

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({
  id: true,
  createdAt: true,
});

export const insertFabricAssetSchema = createInsertSchema(fabricAssets).omit({
  id: true,
  createdAt: true,
}).extend({
  assetType: z.enum(["texture_2d", "texture_3d", "ar_model"]),
});

export const insertCollabDropSchema = createInsertSchema(collabDrops).omit({
  id: true,
  createdAt: true,
  rsvpCount: true,
}).extend({
  status: z.enum(["upcoming", "live", "ended", "cancelled"]).default("upcoming"),
  minLoyaltyTier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
});

export const insertDropRsvpSchema = createInsertSchema(dropRsvps).omit({
  id: true,
  createdAt: true,
}).extend({
  status: z.enum(["confirmed", "cancelled", "attended"]).default("confirmed"),
});

// ── Discover page: inquiries (guide registration, business claim, deal listing, destination feature) ──
export const discoverInquiries = pgTable("discover_inquiries", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 64 }).notNull(), // "guide_registration" | "business_claim" | "deal_listing" | "destination_feature"
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  details: jsonb("details"),
  status: varchar("status", { length: 32 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDiscoverInquirySchema = createInsertSchema(discoverInquiries).omit({ id: true, createdAt: true });
export type InsertDiscoverInquiry = z.infer<typeof insertDiscoverInquirySchema>;
export type DiscoverInquiry = typeof discoverInquiries.$inferSelect;

// ── Discover page: deal bookings ──
export const discoverBookings = pgTable("discover_bookings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  dealTitle: varchar("deal_title", { length: 255 }).notNull(),
  dealType: varchar("deal_type", { length: 64 }).notNull(),
  guestName: varchar("guest_name", { length: 255 }).notNull(),
  guestEmail: varchar("guest_email", { length: 255 }).notNull(),
  guestCount: integer("guest_count").notNull().default(1),
  bookingDate: varchar("booking_date", { length: 32 }).notNull(),
  totalAmountNgn: integer("total_amount_ngn").notNull(),
  paymentReference: varchar("payment_reference", { length: 128 }).unique(),
  paymentStatus: varchar("payment_status", { length: 32 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDiscoverBookingSchema = createInsertSchema(discoverBookings).omit({ id: true, createdAt: true });
export type InsertDiscoverBooking = z.infer<typeof insertDiscoverBookingSchema>;
export type DiscoverBooking = typeof discoverBookings.$inferSelect;

// ── Discover premium subscriptions ──
export const discoverPremium = pgTable("discover_premium", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  guestEmail: varchar("guest_email", { length: 255 }),
  paymentReference: varchar("payment_reference", { length: 128 }).unique(),
  paymentStatus: varchar("payment_status", { length: 32 }).default("pending"),
  subscriptionStart: timestamp("subscription_start"),
  subscriptionEnd: timestamp("subscription_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDiscoverPremiumSchema = createInsertSchema(discoverPremium).omit({ id: true, createdAt: true });
export type InsertDiscoverPremium = z.infer<typeof insertDiscoverPremiumSchema>;
export type DiscoverPremium = typeof discoverPremium.$inferSelect;

// ── Site-wide visitor experience feedback ──
export const experienceFeedback = pgTable("experience_feedback", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  mood: varchar("mood", { length: 20 }).notNull(),
  comment: text("comment"),
  pagePath: varchar("page_path", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExperienceFeedbackSchema = createInsertSchema(experienceFeedback).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  mood: z.enum(["sad", "indifferent", "happy"]),
  comment: z.string().trim().max(1000).optional().default(""),
  pagePath: z.string().trim().max(500).optional().default("/"),
});
export type InsertExperienceFeedback = z.infer<typeof insertExperienceFeedbackSchema>;
export type ExperienceFeedback = typeof experienceFeedback.$inferSelect;

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;
export type SavedDeliveryAddress = typeof savedDeliveryAddresses.$inferSelect;
export type InsertSavedDeliveryAddress = z.infer<typeof insertSavedDeliveryAddressSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertShippingQuoteRequest = z.infer<typeof insertShippingQuoteRequestSchema>;
export type ShippingQuoteRequest = typeof shippingQuoteRequests.$inferSelect;
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurements.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// New feature types
export type InsertOccasionProfile = z.infer<typeof insertOccasionProfileSchema>;
export type OccasionProfile = typeof occasionProfiles.$inferSelect;
export type InsertLookbookRecommendation = z.infer<typeof insertLookbookRecommendationSchema>;
export type LookbookRecommendation = typeof lookbookRecommendations.$inferSelect;
export type InsertOrderFeedback = z.infer<typeof insertOrderFeedbackSchema>;
export type OrderFeedback = typeof orderFeedback.$inferSelect;
export type ProductFitMetric = typeof productFitMetrics.$inferSelect;
export type MeasurementAlert = typeof measurementAlerts.$inferSelect;
export type InsertProductionStep = z.infer<typeof insertProductionStepSchema>;
export type OrderProductionStep = typeof orderProductionSteps.$inferSelect;
export type InsertVendorResource = z.infer<typeof insertVendorResourceSchema>;
export type VendorResource = typeof vendorResources.$inferSelect;
export type InsertEventCollection = z.infer<typeof insertEventCollectionSchema>;
export type EventCollection = typeof eventCollections.$inferSelect;
export type InsertProductStory = z.infer<typeof insertProductStorySchema>;
export type ProductStory = typeof productStories.$inferSelect;
export type InsertLoyaltyAccount = z.infer<typeof insertLoyaltyAccountSchema>;
export type LoyaltyAccount = typeof loyaltyAccounts.$inferSelect;
export type InsertLoyaltyEvent = z.infer<typeof insertLoyaltyEventSchema>;
export type LoyaltyEvent = typeof loyaltyEvents.$inferSelect;
export type InsertCulturalQuiz = z.infer<typeof insertCulturalQuizSchema>;
export type CulturalQuiz = typeof culturalQuizzes.$inferSelect;
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertFabricAsset = z.infer<typeof insertFabricAssetSchema>;
export type FabricAsset = typeof fabricAssets.$inferSelect;
export type InsertCollabDrop = z.infer<typeof insertCollabDropSchema>;
export type CollabDrop = typeof collabDrops.$inferSelect;
export type InsertDropRsvp = z.infer<typeof insertDropRsvpSchema>;
export type DropRsvp = typeof dropRsvps.$inferSelect;
