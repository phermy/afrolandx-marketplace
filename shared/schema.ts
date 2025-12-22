import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  decimal,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  password: varchar("password"), // hashed password for email/password auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  roles: jsonb("roles").default(["customer"]), // array of roles: customer, vendor, admin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vendors table
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  businessName: text("business_name").notNull(),
  description: text("description"),
  status: varchar("status").default("pending"), // pending, approved, suspended
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0), // renamed from quantity to stock
  weight: decimal("weight", { precision: 5, scale: 2 }), // in kg
  imageUrl: text("image_url"), // single image URL for display
  images: jsonb("images").default([]), // array of image URLs for gallery
  status: varchar("status").default("pending"), // pending, approved, rejected
  featured: boolean("featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Shopping cart table
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  shippingAmount: decimal("shipping_amount", { precision: 10, scale: 2 }).default("0"),
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, failed
  orderStatus: varchar("order_status").default("pending"), // pending, processing, shipped, delivered, cancelled
  shippingAddress: jsonb("shipping_address").notNull(),
  paymentReference: varchar("payment_reference"),
  shippingMethod: varchar("shipping_method"), // ups, fedex, dhl
  trackingNumber: varchar("tracking_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  priceAtTime: decimal("price_at_time", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

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
});

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
  createdAt: timestamp("created_at").defaultNow(),
});

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
  rsvpCount: integer("rsvp_count").default(0),
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
});

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
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
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
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
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
