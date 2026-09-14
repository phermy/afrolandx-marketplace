import {
  users,
  vendors,
  categories,
  products,
  cartItems,
  orders,
  orderItems,
  notifications,
  shippingQuoteRequests,
  measurements,
  messages,
  occasionProfiles,
  lookbookRecommendations,
  productFitMetrics,
  orderFeedback,
  measurementAlerts,
  orderProductionSteps,
  vendorResources,
  eventCollections,
  productStories,
  loyaltyAccounts,
  loyaltyEvents,
  culturalQuizzes,
  quizAttempts,
  fabricAssets,
  collabDrops,
  dropRsvps,
  type User,
  type UpsertUser,
  type Vendor,
  type InsertVendor,
  type Category,
  type InsertCategory,
  type Product,
  type InsertProduct,
  type CartItem,
  type InsertCartItem,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type Notification,
  type InsertNotification,
  type ShippingQuoteRequest,
  type InsertShippingQuoteRequest,
  type Measurement,
  type InsertMeasurement,
  type Message,
  type InsertMessage,
  type OccasionProfile,
  type InsertOccasionProfile,
  type LookbookRecommendation,
  type InsertLookbookRecommendation,
  type ProductFitMetric,
  type OrderFeedback,
  type InsertOrderFeedback,
  type MeasurementAlert,
  type OrderProductionStep,
  type InsertProductionStep,
  type VendorResource,
  type InsertVendorResource,
  type EventCollection,
  type InsertEventCollection,
  type ProductStory,
  type InsertProductStory,
  type LoyaltyAccount,
  type InsertLoyaltyAccount,
  type LoyaltyEvent,
  type InsertLoyaltyEvent,
  type CulturalQuiz,
  type InsertCulturalQuiz,
  type QuizAttempt,
  type InsertQuizAttempt,
  type FabricAsset,
  type InsertFabricAsset,
  type CollabDrop,
  type InsertCollabDrop,
  type DropRsvp,
  type InsertDropRsvp,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, like, or, gte, lte, ilike, isNotNull, isNull, lt } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRoles(userId: string, roles: string[]): Promise<void>;
  addUserRole(userId: string, role: string): Promise<void>;
  removeUserRole(userId: string, role: string): Promise<void>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string }): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  deleteUser(userId: string): Promise<boolean>;
  updateEmailOtp(userId: string, otp: string | null, expiry: Date | null): Promise<void>;
  updatePasswordResetOtp(userId: string, otp: string | null, expiry: Date | null): Promise<void>;
  updateLoginOtp(userId: string, otp: string | null, expiry: Date | null): Promise<void>;
  verifyUserEmail(userId: string): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  updateActiveSession(userId: string, sessionId: string | null): Promise<void>;
  
  // Vendor operations
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  getVendor(id: number): Promise<Vendor | undefined>;
  getVendorByUserId(userId: string): Promise<Vendor | undefined>;
  updateVendorStatus(id: number, status: string): Promise<void>;
  updateVendorProfile(id: number, data: { contactName?: string; businessName?: string; phone?: string; cacNumber?: string | null; description?: string }): Promise<void>;
  getAllVendors(): Promise<Vendor[]>;
  
  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getProducts(filters?: { status?: string; categoryId?: number; vendorId?: number; featured?: boolean; search?: string; minPrice?: number; maxPrice?: number; gender?: string; originCountry?: string; }): Promise<Product[]>;
  updateProductStatus(id: number, status: string): Promise<void>;
  updateProductFeatured(id: number, featured: boolean): Promise<void>;
  updateProductStock(id: number, stock: number): Promise<void>;
  updateProductImages(id: number, images: string[], name?: string, description?: string): Promise<void>;
  updateProduct(id: number, data: { name?: string; description?: string; price?: string; stock?: number; imageUrl?: string; gender?: string | null }): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  getProductsWithVendor(): Promise<(Product & { vendor: Vendor; category: Category })[]>;
  
  // Cart operations
  addToCart(cartItem: InsertCartItem): Promise<CartItem>;
  getCartItems(userId: string): Promise<(CartItem & { product: Product })[]>;
  updateCartItemQuantity(id: number, userId: string, quantity: number): Promise<boolean>;
  removeFromCart(id: number, userId: string): Promise<boolean>;
  clearCart(userId: string): Promise<void>;
  
  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderWithReservedShippingQuote(
    order: InsertOrder,
    quoteId: number,
    userId: string,
    items: Array<Omit<InsertOrderItem, 'orderId'>>,
  ): Promise<Order | undefined>;
  createOrderAwaitingShippingQuote(
    order: InsertOrder,
    quoteId: number,
    userId: string,
    items: Array<Omit<InsertOrderItem, 'orderId'>>,
  ): Promise<Order | undefined>;
  releaseReservedShippingQuoteOrder(orderId: number, quoteId: number, userId: string): Promise<void>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersForUser(userId: string): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  getOrderItemsWithProducts(orderId: number): Promise<OrderItem[]>;
  updateOrderStatus(id: number, status: string): Promise<void>;
  cancelOrderIfNoActiveShippingPayment(id: number, userId?: string): Promise<boolean>;
  updatePaymentStatus(id: number, status: string, reference?: string): Promise<void>;
  markOrderPaid(id: number, reference: string): Promise<boolean>;
  reserveOrderStock(id: number): Promise<boolean>;
  getOrderByShippingQuoteRequestId(quoteId: number): Promise<Order | undefined>;
  updateOrderShippingQuote(
    quoteId: number,
    amount: string,
    status: string,
    orderStatus?: string,
    reconciliation?: { finalAmount?: string; refundAmount?: string; refundStatus?: string },
  ): Promise<Order | undefined>;
  claimShippingPaymentReference(id: number, userId: string, reference: string): Promise<'claimed' | 'busy' | 'unavailable'>;
  saveShippingPaymentUrl(id: number, reference: string, url: string): Promise<boolean>;
  clearShippingPaymentAttempt(id: number, userId: string, reference: string): Promise<void>;
  markShippingPaid(id: number, reference: string): Promise<boolean>;
  claimShippingRefund(id: number, finalAmount: string, refundAmount: string): Promise<boolean>;
  completeShippingRefundClaim(id: number, status: string): Promise<void>;
  releaseShippingRefundClaim(id: number): Promise<void>;
  decrementProductStockIfAvailable(id: number, quantity: number): Promise<boolean>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: number, userId: string): Promise<boolean>;
  dismissNotification(id: number, userId: string): Promise<void>;
  cleanupExpiredNotifications(): Promise<void>;
  getAdminUsers(): Promise<User[]>;

  // Shipping quote request operations
  createShippingQuoteRequest(request: InsertShippingQuoteRequest): Promise<ShippingQuoteRequest>;
  getShippingQuoteRequest(id: number): Promise<ShippingQuoteRequest | undefined>;
  getShippingQuoteRequestsForUser(userId: string): Promise<ShippingQuoteRequest[]>;
  getAllShippingQuoteRequests(): Promise<ShippingQuoteRequest[]>;
  updateShippingQuoteRequest(id: number, data: Partial<Pick<ShippingQuoteRequest, 'status' | 'quotedAmount' | 'currency' | 'estimatedDelivery' | 'adminNotes' | 'confirmedBy' | 'expiresAt'>>): Promise<ShippingQuoteRequest | undefined>;
  claimShippingQuoteDecision(id: number, expectedStatus: string): Promise<boolean>;
  releaseShippingQuoteDecision(id: number, originalStatus: string): Promise<void>;
  
  // Measurement operations
  createMeasurement(measurement: InsertMeasurement): Promise<Measurement>;
  getMeasurement(id: number): Promise<Measurement | undefined>;
  getUserMeasurements(userId: string): Promise<Measurement[]>;
  getVendorMeasurements(vendorId: number): Promise<Measurement[]>;
  getOrderMeasurement(orderId: number): Promise<Measurement | undefined>;
  updateMeasurementStatus(id: number, status: string): Promise<void>;
  deleteMeasurement(id: number): Promise<void>;
  
  // Message operations
  sendMessage(message: InsertMessage): Promise<Message>;
  getConversations(userId: string): Promise<{ otherUser: User; lastMessage: Message; unreadCount: number }[]>;
  getConversationMessages(userId: string, otherUserId: string): Promise<(Message & { sender: User; recipient: User })[]>;
  markMessagesAsRead(userId: string, otherUserId: string): Promise<void>;
  getUnreadMessageCount(userId: string): Promise<number>;

  // Occasion/Lookbook operations
  createOccasionProfile(profile: InsertOccasionProfile): Promise<OccasionProfile>;
  getUserOccasions(userId: string): Promise<OccasionProfile[]>;
  getOccasion(id: number): Promise<OccasionProfile | undefined>;
  createLookbookRecommendation(rec: InsertLookbookRecommendation): Promise<LookbookRecommendation>;
  getUserLookbooks(userId: string): Promise<LookbookRecommendation[]>;
  updateLookbookStatus(id: number, status: string): Promise<void>;

  // Fit metrics & feedback operations
  getProductFitMetrics(productId: number): Promise<ProductFitMetric | undefined>;
  createOrderFeedback(feedback: InsertOrderFeedback): Promise<OrderFeedback>;
  getProductFeedback(productId: number): Promise<OrderFeedback[]>;
  calculateFitScore(productId: number, userMeasurements?: Measurement): Promise<number>;

  // Measurement alerts
  createMeasurementAlert(alert: { measurementId: number; userId: string; vendorId?: number; alertType: string; deltaSummary?: object }): Promise<MeasurementAlert>;
  getVendorMeasurementAlerts(vendorId: number): Promise<MeasurementAlert[]>;
  acknowledgeMeasurementAlert(id: number, vendorId: number): Promise<void>;

  // Production steps operations
  createProductionStep(step: InsertProductionStep): Promise<OrderProductionStep>;
  getProductionStep(id: number): Promise<OrderProductionStep | undefined>;
  getOrderProductionSteps(orderId: number): Promise<OrderProductionStep[]>;
  updateProductionStep(id: number, completedAt: Date, notes?: string): Promise<void>;
  getVendorOrders(vendorId: number): Promise<Order[]>;

  // Vendor resources operations
  createVendorResource(resource: InsertVendorResource): Promise<VendorResource>;
  getVendorResources(vendorId: number): Promise<VendorResource[]>;
  updateVendorResource(id: number, quantity: number): Promise<void>;
  getLowStockResources(vendorId: number): Promise<VendorResource[]>;

  // Event collections operations
  createEventCollection(collection: InsertEventCollection): Promise<EventCollection>;
  getEventCollections(eventType?: string): Promise<EventCollection[]>;
  getEventCollection(id: number): Promise<EventCollection | undefined>;

  // Product stories operations
  createProductStory(story: InsertProductStory): Promise<ProductStory>;
  getProductStories(productId: number): Promise<ProductStory[]>;
  updateProductStoryPublished(id: number, isPublished: boolean): Promise<void>;

  // Loyalty operations
  getOrCreateLoyaltyAccount(userId: string): Promise<LoyaltyAccount>;
  getLoyaltyAccount(userId: string): Promise<LoyaltyAccount | undefined>;
  addLoyaltyPoints(userId: string, points: number, actionType: string, description: string, referenceId?: number, referenceType?: string): Promise<void>;
  redeemLoyaltyPoints(userId: string, points: number): Promise<boolean>;
  getLoyaltyHistory(userId: string): Promise<LoyaltyEvent[]>;
  updateLoyaltyTier(userId: string): Promise<void>;
  generateReferralCode(userId: string): Promise<string>;
  applyReferralCode(userId: string, referralCode: string): Promise<boolean>;

  // Quiz operations
  createCulturalQuiz(quiz: InsertCulturalQuiz): Promise<CulturalQuiz>;
  getActiveQuizzes(): Promise<CulturalQuiz[]>;
  getQuiz(id: number): Promise<CulturalQuiz | undefined>;
  submitQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt>;
  getUserQuizAttempts(userId: string): Promise<QuizAttempt[]>;
  hasUserCompletedQuiz(userId: string, quizId: number): Promise<boolean>;

  // Fabric assets operations
  createFabricAsset(asset: InsertFabricAsset): Promise<FabricAsset>;
  getProductFabricAssets(productId: number): Promise<FabricAsset[]>;

  // Collaboration drops operations
  createCollabDrop(drop: InsertCollabDrop): Promise<CollabDrop>;
  getCollabDrops(status?: string): Promise<CollabDrop[]>;
  getCollabDrop(id: number): Promise<CollabDrop | undefined>;
  createDropRsvp(rsvp: InsertDropRsvp): Promise<DropRsvp>;
  getDropRsvps(dropId: number): Promise<DropRsvp[]>;
  getUserDropRsvps(userId: string): Promise<DropRsvp[]>;
  hasUserRsvped(userId: string, dropId: number): Promise<boolean>;
  updateDropStatus(id: number, status: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const canonicalEmail = email.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${canonicalEmail}`);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const normalizedUserData = {
      ...userData,
      ...(userData.email ? { email: userData.email.trim().toLowerCase() } : {}),
    };
    const [user] = await db
      .insert(users)
      .values(normalizedUserData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...normalizedUserData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserRoles(userId: string, roles: string[]): Promise<void> {
    await db
      .update(users)
      .set({ roles, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async addUserRole(userId: string, role: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user) {
      const currentRoles = user.roles as string[] || [];
      if (!currentRoles.includes(role)) {
        const newRoles = [...currentRoles, role];
        await this.updateUserRoles(userId, newRoles);
      }
    }
  }

  async removeUserRole(userId: string, role: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user) {
      const currentRoles = user.roles as string[] || [];
      const newRoles = currentRoles.filter(r => r !== role);
      if (newRoles.length === 0) {
        newRoles.push("customer"); // Always keep at least customer role
      }
      await this.updateUserRoles(userId, newRoles);
    }
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async deleteUser(userId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Delete dependent records first because these tables intentionally use
      // restrictive foreign keys. Vendor-owned catalog data is removed with
      // the vendor account so no orphaned records remain.
      await tx.execute(sql`DELETE FROM sessions WHERE sess->'passport'->>'user' = ${userId}`);
      await tx.execute(sql`DELETE FROM order_production_steps WHERE order_id IN (SELECT id FROM orders WHERE user_id = ${userId}) OR completed_by = ${userId}`);
      await tx.execute(sql`DELETE FROM order_feedback WHERE user_id = ${userId} OR order_id IN (SELECT id FROM orders WHERE user_id = ${userId}) OR product_id IN (SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM measurements WHERE user_id = ${userId} OR order_id IN (SELECT id FROM orders WHERE user_id = ${userId}) OR vendor_id IN (SELECT id FROM vendors WHERE user_id = ${userId}) OR product_id IN (SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM measurement_alerts WHERE user_id = ${userId} OR vendor_id IN (SELECT id FROM vendors WHERE user_id = ${userId}) OR acknowledged_by_vendor_id IN (SELECT id FROM vendors WHERE user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM shipping_quote_requests WHERE user_id = ${userId} OR confirmed_by = ${userId}`);
      await tx.execute(sql`DELETE FROM notifications WHERE user_id = ${userId} OR order_id IN (SELECT id FROM orders WHERE user_id = ${userId}) OR product_id IN (SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM messages WHERE sender_id = ${userId} OR recipient_id = ${userId}`);
      await tx.execute(sql`UPDATE messages SET product_id = NULL WHERE product_id IN (SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM occasion_profiles WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM lookbook_recommendations WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM loyalty_events WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM loyalty_accounts WHERE user_id = ${userId}`);
      await tx.execute(sql`UPDATE loyalty_accounts SET referred_by = NULL WHERE referred_by = ${userId}`);
      await tx.execute(sql`DELETE FROM quiz_attempts WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM drop_rsvps WHERE user_id = ${userId} OR drop_id IN (SELECT id FROM collab_drops WHERE designer_id IN (SELECT id FROM vendors WHERE user_id = ${userId}) OR artisan_id IN (SELECT id FROM vendors WHERE user_id = ${userId}))`);
      await tx.execute(sql`DELETE FROM collab_drops WHERE designer_id IN (SELECT id FROM vendors WHERE user_id = ${userId}) OR artisan_id IN (SELECT id FROM vendors WHERE user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM discover_bookings WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM discover_premium WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM vendor_resources WHERE vendor_id IN (SELECT id FROM vendors WHERE user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM product_fit_metrics WHERE product_id IN (SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM product_stories WHERE product_id IN (SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM fabric_assets WHERE product_id IN (SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM cart_items WHERE user_id = ${userId} OR product_id IN (SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ${userId}) OR product_id IN (SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE v.user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM orders WHERE user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM products WHERE vendor_id IN (SELECT id FROM vendors WHERE user_id = ${userId})`);
      await tx.execute(sql`DELETE FROM vendors WHERE user_id = ${userId}`);
      const result = await tx.execute(sql`DELETE FROM users WHERE id = ${userId} RETURNING id`);
      return result.rows.length > 0;
    });
  }

  async updateEmailOtp(userId: string, otp: string | null, expiry: Date | null): Promise<void> {
    await db.update(users).set({ emailOtp: otp, emailOtpExpiry: expiry, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updatePasswordResetOtp(userId: string, otp: string | null, expiry: Date | null): Promise<void> {
    await db.update(users).set({ passwordResetOtp: otp, passwordResetOtpExpiry: expiry, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateLoginOtp(userId: string, otp: string | null, expiry: Date | null): Promise<void> {
    await db.update(users).set({ loginOtp: otp, loginOtpExpiry: expiry, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async verifyUserEmail(userId: string): Promise<void> {
    await db.update(users).set({ emailVerified: true, emailOtp: null, emailOtpExpiry: null, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword, passwordResetOtp: null, passwordResetOtpExpiry: null, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateActiveSession(userId: string, sessionId: string | null): Promise<void> {
    await db.update(users).set({ activeSessionId: sessionId, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  // Vendor operations
  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db
      .insert(vendors)
      .values(vendor)
      .returning();
    return newVendor;
  }

  async getVendor(id: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor;
  }

  async getVendorByUserId(userId: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, userId));
    return vendor;
  }

  async updateVendorStatus(id: number, status: string): Promise<void> {
    await db
      .update(vendors)
      .set({ status, updatedAt: new Date() })
      .where(eq(vendors.id, id));
  }

  async updateVendorProfile(id: number, data: { contactName?: string; businessName?: string; phone?: string; cacNumber?: string | null; description?: string }): Promise<void> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.contactName !== undefined) updates.contactName = data.contactName;
    if (data.businessName !== undefined) updates.businessName = data.businessName;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.cacNumber !== undefined) updates.cacNumber = data.cacNumber;
    if (data.description !== undefined) updates.description = data.description;
    await db
      .update(vendors)
      .set(updates)
      .where(eq(vendors.id, id));
  }

  async getAllVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors).orderBy(desc(vendors.createdAt));
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db
      .insert(products)
      .values(product)
      .returning();
    return newProduct;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProducts(filters?: { 
    status?: string; 
    categoryId?: number; 
    vendorId?: number; 
    featured?: boolean;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    gender?: string;
    originCountry?: string;
  }): Promise<Product[]> {
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(products.status, filters.status));
    }
    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    if (filters?.vendorId) {
      conditions.push(eq(products.vendorId, filters.vendorId));
    }
    if (filters?.featured !== undefined) {
      conditions.push(eq(products.featured, filters.featured));
    }
    if (filters?.search) {
      conditions.push(
        or(
          like(products.name, `%${filters.search}%`),
          like(products.description, `%${filters.search}%`)
        )
      );
    }
    if (filters?.minPrice !== undefined) {
      conditions.push(gte(products.price, filters.minPrice.toString()));
    }
    if (filters?.maxPrice !== undefined) {
      conditions.push(lte(products.price, filters.maxPrice.toString()));
    }
    if (filters?.gender) {
      conditions.push(eq(products.gender, filters.gender));
    }
    if (filters?.originCountry) {
      conditions.push(eq(products.originCountry, filters.originCountry));
    }
    
    const query = db.select().from(products);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(products.createdAt));
    }
    return await query.orderBy(desc(products.createdAt));
  }

  async updateProductStatus(id: number, status: string): Promise<void> {
    await db
      .update(products)
      .set({ status, updatedAt: new Date() })
      .where(eq(products.id, id));
  }

  async updateProductFeatured(id: number, featured: boolean): Promise<void> {
    await db
      .update(products)
      .set({ featured, updatedAt: new Date() })
      .where(eq(products.id, id));
  }

  async updateProductStock(id: number, stock: number): Promise<void> {
    await db
      .update(products)
      .set({ stock, updatedAt: new Date() })
      .where(eq(products.id, id));
  }

  async updateProductImages(id: number, images: string[], name?: string, description?: string): Promise<void> {
    const updates: Record<string, unknown> = { images, updatedAt: new Date() };
    if (name) updates.name = name;
    if (description) updates.description = description;
    await db.update(products).set(updates).where(eq(products.id, id));
  }

  async updateProduct(id: number, data: { name?: string; description?: string; price?: string; stock?: number; imageUrl?: string }): Promise<Product> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.price !== undefined) updates.price = data.price;
    if (data.stock !== undefined) updates.stock = data.stock;
    if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl;
    const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getProductsWithVendor(): Promise<(Product & { vendor: Vendor; category: Category })[]> {
    const result = await db
      .select()
      .from(products)
      .leftJoin(vendors, eq(products.vendorId, vendors.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(desc(products.createdAt));

    return result.map(row => ({
      ...row.products,
      vendor: row.vendors!,
      category: row.categories!,
    }));
  }

  // Cart operations
  async addToCart(cartItem: InsertCartItem): Promise<CartItem> {
    // Match on product + size: same product with different size = separate cart item
    const conditions = [
      eq(cartItems.userId, cartItem.userId),
      eq(cartItems.productId, cartItem.productId),
    ];
    if (cartItem.selectedSize) {
      conditions.push(eq(cartItems.selectedSize, cartItem.selectedSize));
    } else {
      conditions.push(isNull(cartItems.selectedSize));
    }

    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(...conditions));

    if (existingItem) {
      const [updatedItem] = await db
        .update(cartItems)
        .set({ 
          quantity: (existingItem.quantity || 0) + (cartItem.quantity || 1),
          updatedAt: new Date()
        })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      return updatedItem;
    } else {
      const [newItem] = await db
        .insert(cartItems)
        .values(cartItem)
        .returning();
      return newItem;
    }
  }

  async getCartItems(userId: string): Promise<(CartItem & { product: Product })[]> {
    const result = await db
      .select()
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, userId))
      .orderBy(desc(cartItems.createdAt));

    return result.map(row => ({
      ...row.cart_items,
      product: row.products!,
    }));
  }

  async updateCartItemQuantity(id: number, userId: string, quantity: number): Promise<boolean> {
    const result = await db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning({ id: cartItems.id });
    return result.length > 0;
  }

  async removeFromCart(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning({ id: cartItems.id });
    return result.length > 0;
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db
      .insert(orders)
      .values(order)
      .returning();
    return newOrder;
  }

  async createOrderWithReservedShippingQuote(
    order: InsertOrder,
    quoteId: number,
    userId: string,
    items: Array<Omit<InsertOrderItem, 'orderId'>>,
  ): Promise<Order | undefined> {
    return await db.transaction(async tx => {
      const [reserved] = await tx.update(shippingQuoteRequests)
        .set({ status: 'reserved', updatedAt: new Date() })
        .where(and(
          eq(shippingQuoteRequests.id, quoteId),
          eq(shippingQuoteRequests.userId, userId),
          eq(shippingQuoteRequests.status, 'quoted'),
          sql`${shippingQuoteRequests.expiresAt} > NOW()`,
        ))
        .returning({ id: shippingQuoteRequests.id });
      if (!reserved) return undefined;

      const [newOrder] = await tx.insert(orders)
        .values({ ...order, shippingQuoteRequestId: quoteId })
        .returning();
      if (items.length > 0) {
        await tx.insert(orderItems).values(items.map(item => ({ ...item, orderId: newOrder.id })));
      }
      return newOrder;
    });
  }

  async createOrderAwaitingShippingQuote(
    order: InsertOrder,
    quoteId: number,
    userId: string,
    items: Array<Omit<InsertOrderItem, 'orderId'>>,
  ): Promise<Order | undefined> {
    return await db.transaction(async tx => {
      const [request] = await tx.select({ id: shippingQuoteRequests.id })
        .from(shippingQuoteRequests)
        .where(and(
          eq(shippingQuoteRequests.id, quoteId),
          eq(shippingQuoteRequests.userId, userId),
          eq(shippingQuoteRequests.status, 'pending'),
        ));
      if (!request) return undefined;

      const [newOrder] = await tx.insert(orders)
        .values({ ...order, shippingQuoteRequestId: quoteId })
        .returning();
      if (items.length > 0) {
        await tx.insert(orderItems).values(items.map(item => ({ ...item, orderId: newOrder.id })));
      }
      return newOrder;
    });
  }

  async releaseReservedShippingQuoteOrder(orderId: number, quoteId: number, userId: string): Promise<void> {
    await db.transaction(async tx => {
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await tx.delete(orders).where(and(
        eq(orders.id, orderId),
        eq(orders.userId, userId),
        eq(orders.shippingQuoteRequestId, quoteId),
        eq(orders.paymentStatus, 'pending'),
      ));
      await tx.update(shippingQuoteRequests)
        .set({ status: 'quoted', updatedAt: new Date() })
        .where(and(
          eq(shippingQuoteRequests.id, quoteId),
          eq(shippingQuoteRequests.userId, userId),
          eq(shippingQuoteRequests.status, 'reserved'),
        ));
    });
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db
      .insert(orderItems)
      .values(orderItem)
      .returning();
    return newOrderItem;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderByShippingQuoteRequestId(quoteId: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.shippingQuoteRequestId, quoteId));
    return order;
  }

  async updateOrderShippingQuote(
    quoteId: number,
    amount: string,
    status: string,
    orderStatus?: string,
    reconciliation?: { finalAmount?: string; refundAmount?: string; refundStatus?: string },
  ): Promise<Order | undefined> {
    const update: any = { shippingAmount: amount, shippingPaymentStatus: status, updatedAt: new Date() };
    if (orderStatus) {
      update.orderStatus = sql`CASE
        WHEN ${orders.orderStatus} IN ('pending', 'awaiting_shipping_quote') THEN ${orderStatus}
        ELSE ${orders.orderStatus}
      END`;
    }
    if (reconciliation?.finalAmount !== undefined) update.shippingFinalAmount = reconciliation.finalAmount;
    if (reconciliation?.refundAmount !== undefined) update.shippingRefundAmount = reconciliation.refundAmount;
    if (reconciliation?.refundStatus !== undefined) update.shippingRefundStatus = reconciliation.refundStatus;
    const [order] = await db.update(orders)
      .set(update)
      .where(and(
        eq(orders.shippingQuoteRequestId, quoteId),
        sql`${orders.orderStatus} <> 'cancelled'`,
      ))
      .returning();
    return order;
  }

  async claimShippingPaymentReference(id: number, userId: string, reference: string): Promise<'claimed' | 'busy' | 'unavailable'> {
    const updated = await db.transaction(async tx => {
      const [current] = await tx.select({ quoteId: orders.shippingQuoteRequestId })
        .from(orders)
        .where(and(eq(orders.id, id), eq(orders.userId, userId)));
      if (!current?.quoteId) return [];
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${current.quoteId})`);
      return await tx.update(orders)
        .set({ shippingPaymentReference: reference, shippingPaymentUrl: null, updatedAt: new Date() })
        .where(and(
          eq(orders.id, id),
          eq(orders.userId, userId),
          eq(orders.paymentStatus, 'paid'),
          eq(orders.shippingPaymentStatus, 'pending'),
          eq(orders.orderStatus, 'awaiting_shipping_quote'),
          isNull(orders.shippingPaymentReference),
          sql`EXISTS (
            SELECT 1 FROM ${shippingQuoteRequests}
            WHERE ${shippingQuoteRequests.id} = ${orders.shippingQuoteRequestId}
              AND ${shippingQuoteRequests.status} = 'quoted'
          )`,
        ))
        .returning({ id: orders.id });
    });
    if (updated.length > 0) return 'claimed';
    const current = await this.getOrder(id);
    if (current?.userId === userId && current.paymentStatus === 'paid' && current.shippingPaymentStatus === 'pending' && current.shippingPaymentReference) {
      return 'busy';
    }
    return 'unavailable';
  }

  async saveShippingPaymentUrl(id: number, reference: string, url: string): Promise<boolean> {
    const updated = await db.update(orders)
      .set({ shippingPaymentUrl: url, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.shippingPaymentReference, reference), eq(orders.shippingPaymentStatus, 'pending')))
      .returning({ id: orders.id });
    return updated.length > 0;
  }

  async clearShippingPaymentAttempt(id: number, userId: string, reference: string): Promise<void> {
    await db.update(orders)
      .set({ shippingPaymentReference: null, shippingPaymentUrl: null, updatedAt: new Date() })
      .where(and(
        eq(orders.id, id),
        eq(orders.userId, userId),
        eq(orders.shippingPaymentStatus, 'pending'),
        eq(orders.shippingPaymentReference, reference),
      ));
  }

  async markShippingPaid(id: number, reference: string): Promise<boolean> {
    const updated = await db.update(orders)
      .set({
        shippingPaymentStatus: 'paid',
        orderStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(and(
        eq(orders.id, id),
        eq(orders.paymentStatus, 'paid'),
        eq(orders.shippingPaymentStatus, 'pending'),
        eq(orders.shippingPaymentReference, reference),
        eq(orders.orderStatus, 'awaiting_shipping_quote'),
      ))
      .returning({ id: orders.id });
    return updated.length > 0;
  }

  async claimShippingRefund(id: number, finalAmount: string, refundAmount: string): Promise<boolean> {
    const updated = await db.update(orders)
      .set({
        shippingFinalAmount: finalAmount,
        shippingRefundAmount: refundAmount,
        shippingRefundStatus: 'processing',
        updatedAt: new Date(),
      })
      .where(and(
        eq(orders.id, id),
        eq(orders.paymentStatus, 'paid'),
        isNull(orders.shippingRefundStatus),
      ))
      .returning({ id: orders.id });
    return updated.length > 0;
  }

  async completeShippingRefundClaim(id: number, status: string): Promise<void> {
    await db.update(orders)
      .set({ shippingRefundStatus: status, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.shippingRefundStatus, 'processing')));
  }

  async releaseShippingRefundClaim(id: number): Promise<void> {
    await db.update(orders)
      .set({
        shippingFinalAmount: null,
        shippingRefundAmount: null,
        shippingRefundStatus: null,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, id), eq(orders.shippingRefundStatus, 'processing')));
  }

  async getOrdersForUser(userId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async getAllOrders(): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
  }

  async updateOrderStatus(id: number, status: string): Promise<void> {
    await db
      .update(orders)
      .set({ orderStatus: status, updatedAt: new Date() })
      .where(eq(orders.id, id));
  }

  async cancelOrderIfNoActiveShippingPayment(id: number, userId?: string): Promise<boolean> {
    const conditions = [
      eq(orders.id, id),
      sql`${orders.paymentStatus} <> 'pending'`,
      or(sql`${orders.shippingPaymentStatus} <> 'pending'`, isNull(orders.shippingPaymentReference)),
    ];
    if (userId) conditions.push(eq(orders.userId, userId));
    const updated = await db.update(orders)
      .set({ orderStatus: 'cancelled', updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: orders.id });
    return updated.length > 0;
  }

  async updatePaymentStatus(id: number, status: string, reference?: string): Promise<void> {
    const updateData: any = { paymentStatus: status, updatedAt: new Date() };
    if (reference) {
      updateData.paymentReference = reference;
    }
    
    await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id));
  }

  async markOrderPaid(id: number, reference: string): Promise<boolean> {
    const result = await db.update(orders)
      .set({
        paymentStatus: 'paid',
        paymentReference: reference,
        orderStatus: sql`CASE
          WHEN ${orders.shippingEstimatedAmount} IS NOT NULL AND ${orders.shippingFinalAmount} IS NULL
            THEN 'awaiting_shipping_quote'
          ELSE 'pending'
        END`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(orders.id, id),
        eq(orders.paymentStatus, 'pending'),
        sql`${orders.orderStatus} <> 'cancelled'`,
      ))
      .returning({ id: orders.id });
    return result.length > 0;
  }

  async reserveOrderStock(id: number): Promise<boolean> {
    try {
      return await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${9300000 + id})`);
        const [order] = await tx.select().from(orders).where(eq(orders.id, id));
        if (!order || order.paymentStatus !== 'paid') return false;
        if (order.stockReservationStatus === 'reserved') return true;
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
        if (items.length === 0) return false;
        for (const item of items) {
          const updated = await tx.update(products)
            .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
            .where(and(eq(products.id, item.productId), gte(products.stock, item.quantity)))
            .returning({ id: products.id });
          if (updated.length === 0) throw new Error(`Insufficient stock for product ${item.productId}`);
        }
        await tx.update(orders)
          .set({ stockReservationStatus: 'reserved', updatedAt: new Date() })
          .where(eq(orders.id, id));
        return true;
      });
    } catch (error) {
      console.error(`Could not reserve stock for paid order ${id}:`, error);
      await db.update(orders)
        .set({ stockReservationStatus: 'failed', updatedAt: new Date() })
        .where(and(
          eq(orders.id, id),
          eq(orders.paymentStatus, 'paid'),
          sql`${orders.stockReservationStatus} <> 'reserved'`,
        ));
      return false;
    }
  }

  async decrementProductStockIfAvailable(id: number, quantity: number): Promise<boolean> {
    const result = await db.update(products)
      .set({ stock: sql`${products.stock} - ${quantity}`, updatedAt: new Date() })
      .where(and(eq(products.id, id), gte(products.stock, quantity)))
      .returning({ id: products.id });
    return result.length > 0;
  }

  async getOrderItemsWithProducts(orderId: number): Promise<OrderItem[]> {
    return await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    // Set expiration time to 2 minutes from now for order notifications
    const expirationTime = notification.type === 'order' 
      ? new Date(Date.now() + 2 * 60 * 1000) // 2 minutes
      : null;

    const [newNotification] = await db
      .insert(notifications)
      .values({
        ...notification,
        expiresAt: expirationTime
      })
      .returning();
    return newNotification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    // Clean up expired notifications first
    await this.cleanupExpiredNotifications();
    
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: number, userId: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    return result.length > 0;
  }

  async dismissNotification(id: number, userId: string): Promise<void> {
    await db
      .delete(notifications)
      .where(
        sql`${notifications.id} = ${id} AND ${notifications.userId} = ${userId}`
      );
  }

  async cleanupExpiredNotifications(): Promise<void> {
    const now = new Date();
    await db
      .delete(notifications)
      .where(
        sql`${notifications.expiresAt} IS NOT NULL AND ${notifications.expiresAt} < ${now}`
      );
  }

  async getAdminUsers(): Promise<User[]> {
    const adminUsers = await db
      .select()
      .from(users)
      .where(sql`${users.roles}::jsonb ? 'admin'`);
    return adminUsers;
  }

  // Shipping quote request operations
  async createShippingQuoteRequest(request: InsertShippingQuoteRequest): Promise<ShippingQuoteRequest> {
    const [created] = await db.insert(shippingQuoteRequests).values(request).returning();
    return created;
  }

  async getShippingQuoteRequest(id: number): Promise<ShippingQuoteRequest | undefined> {
    const [request] = await db.select().from(shippingQuoteRequests).where(eq(shippingQuoteRequests.id, id));
    return request;
  }

  async getShippingQuoteRequestsForUser(userId: string): Promise<ShippingQuoteRequest[]> {
    return await db.select().from(shippingQuoteRequests)
      .where(eq(shippingQuoteRequests.userId, userId))
      .orderBy(desc(shippingQuoteRequests.createdAt));
  }

  async getAllShippingQuoteRequests(): Promise<ShippingQuoteRequest[]> {
    return await db.select().from(shippingQuoteRequests).orderBy(desc(shippingQuoteRequests.createdAt));
  }

  async updateShippingQuoteRequest(
    id: number,
    data: Partial<Pick<ShippingQuoteRequest, 'status' | 'quotedAmount' | 'currency' | 'estimatedDelivery' | 'adminNotes' | 'confirmedBy' | 'expiresAt'>>,
  ): Promise<ShippingQuoteRequest | undefined> {
    const [updated] = await db.update(shippingQuoteRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shippingQuoteRequests.id, id))
      .returning();
    return updated;
  }

  async claimShippingQuoteDecision(id: number, expectedStatus: string): Promise<boolean> {
    const claimed = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${id})`);
      return await tx.update(shippingQuoteRequests)
        .set({ status: 'reconciling', updatedAt: new Date() })
        .where(and(
          eq(shippingQuoteRequests.id, id),
          eq(shippingQuoteRequests.status, expectedStatus),
          sql`NOT EXISTS (
            SELECT 1 FROM ${orders}
            WHERE ${orders.shippingQuoteRequestId} = ${id}
              AND ${orders.shippingPaymentReference} IS NOT NULL
          )`,
        ))
        .returning({ id: shippingQuoteRequests.id });
    });
    return claimed.length > 0;
  }

  async releaseShippingQuoteDecision(id: number, originalStatus: string): Promise<void> {
    await db.update(shippingQuoteRequests)
      .set({ status: originalStatus, updatedAt: new Date() })
      .where(and(
        eq(shippingQuoteRequests.id, id),
        eq(shippingQuoteRequests.status, 'reconciling'),
      ));
  }

  // Measurement operations
  async createMeasurement(measurementData: InsertMeasurement): Promise<Measurement> {
    const [measurement] = await db
      .insert(measurements)
      .values(measurementData as any)
      .returning();
    return measurement;
  }

  async getMeasurement(id: number): Promise<Measurement | undefined> {
    const [measurement] = await db
      .select()
      .from(measurements)
      .where(eq(measurements.id, id));
    return measurement;
  }

  async getUserMeasurements(userId: string): Promise<Measurement[]> {
    return await db
      .select()
      .from(measurements)
      .where(eq(measurements.userId, userId))
      .orderBy(desc(measurements.createdAt));
  }

  async getVendorMeasurements(vendorId: number): Promise<Measurement[]> {
    return await db
      .select()
      .from(measurements)
      .where(eq(measurements.vendorId, vendorId))
      .orderBy(desc(measurements.createdAt));
  }

  async getOrderMeasurement(orderId: number): Promise<Measurement | undefined> {
    const [measurement] = await db
      .select()
      .from(measurements)
      .where(eq(measurements.orderId, orderId));
    return measurement;
  }

  async updateMeasurementStatus(id: number, status: string): Promise<void> {
    await db
      .update(measurements)
      .set({ status, updatedAt: new Date() })
      .where(eq(measurements.id, id));
  }

  async deleteMeasurement(id: number): Promise<void> {
    await db
      .delete(measurements)
      .where(eq(measurements.id, id));
  }

  // Message operations
  async sendMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(messageData)
      .returning();
    return message;
  }

  async getConversations(userId: string): Promise<{ otherUser: User; lastMessage: Message; unreadCount: number }[]> {
    const sentMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.senderId, userId));
    
    const receivedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.recipientId, userId));

    const allMessages = [...sentMessages, ...receivedMessages];
    const conversationMap = new Map<string, { lastMessage: Message; unreadCount: number }>();

    for (const message of allMessages) {
      const otherUserId = message.senderId === userId ? message.recipientId : message.senderId;
      const existing = conversationMap.get(otherUserId);
      
      if (!existing || new Date(message.createdAt!) > new Date(existing.lastMessage.createdAt!)) {
        const unreadCount = message.recipientId === userId && !message.isRead ? 
          (existing?.unreadCount || 0) + 1 : (existing?.unreadCount || 0);
        conversationMap.set(otherUserId, { lastMessage: message, unreadCount });
      }
    }

    const conversations = await Promise.all(
      Array.from(conversationMap.entries()).map(async ([otherUserId, data]) => {
        const [otherUser] = await db.select().from(users).where(eq(users.id, otherUserId));
        return { otherUser, lastMessage: data.lastMessage, unreadCount: data.unreadCount };
      })
    );

    return conversations.sort((a, b) => 
      new Date(b.lastMessage.createdAt!).getTime() - new Date(a.lastMessage.createdAt!).getTime()
    );
  }

  async getConversationMessages(userId: string, otherUserId: string): Promise<(Message & { sender: User; recipient: User })[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId), eq(messages.recipientId, otherUserId)),
          and(eq(messages.senderId, otherUserId), eq(messages.recipientId, userId))
        )
      )
      .orderBy(messages.createdAt);

    const messagesWithUsers = await Promise.all(
      msgs.map(async (msg) => {
        const [sender] = await db.select().from(users).where(eq(users.id, msg.senderId));
        const [recipient] = await db.select().from(users).where(eq(users.id, msg.recipientId));
        return { ...msg, sender, recipient };
      })
    );

    return messagesWithUsers;
  }

  async markMessagesAsRead(userId: string, otherUserId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.senderId, otherUserId),
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      );
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      );
    return Number(result[0]?.count || 0);
  }

  // Occasion/Lookbook operations
  async createOccasionProfile(profile: InsertOccasionProfile): Promise<OccasionProfile> {
    const [occasion] = await db.insert(occasionProfiles).values(profile as any).returning();
    return occasion;
  }

  async getUserOccasions(userId: string): Promise<OccasionProfile[]> {
    return await db.select().from(occasionProfiles).where(eq(occasionProfiles.userId, userId)).orderBy(desc(occasionProfiles.createdAt));
  }

  async getOccasion(id: number): Promise<OccasionProfile | undefined> {
    const [occasion] = await db.select().from(occasionProfiles).where(eq(occasionProfiles.id, id));
    return occasion;
  }

  async createLookbookRecommendation(rec: InsertLookbookRecommendation): Promise<LookbookRecommendation> {
    const [lookbook] = await db.insert(lookbookRecommendations).values(rec).returning();
    return lookbook;
  }

  async getUserLookbooks(userId: string): Promise<LookbookRecommendation[]> {
    return await db.select().from(lookbookRecommendations).where(eq(lookbookRecommendations.userId, userId)).orderBy(desc(lookbookRecommendations.createdAt));
  }

  async updateLookbookStatus(id: number, status: string): Promise<void> {
    await db.update(lookbookRecommendations).set({ status }).where(eq(lookbookRecommendations.id, id));
  }

  // Fit metrics & feedback operations
  async getProductFitMetrics(productId: number): Promise<ProductFitMetric | undefined> {
    const [metrics] = await db.select().from(productFitMetrics).where(eq(productFitMetrics.productId, productId));
    return metrics;
  }

  async createOrderFeedback(feedback: InsertOrderFeedback): Promise<OrderFeedback> {
    const [newFeedback] = await db.insert(orderFeedback).values(feedback).returning();
    
    // Update product fit metrics
    const productMetrics = await this.getProductFitMetrics(feedback.productId);
    if (productMetrics) {
      const update: any = { updatedAt: new Date() };
      if (feedback.fitRating && feedback.fitRating >= 4) {
        update.positiveFeedback = (productMetrics.positiveFeedback || 0) + 1;
      } else if (feedback.fitRating && feedback.fitRating <= 2) {
        update.negativeFeedback = (productMetrics.negativeFeedback || 0) + 1;
      }
      update.totalOrders = (productMetrics.totalOrders || 0) + 1;
      await db.update(productFitMetrics).set(update).where(eq(productFitMetrics.id, productMetrics.id));
    } else {
      await db.insert(productFitMetrics).values({
        productId: feedback.productId,
        totalOrders: 1,
        positiveFeedback: feedback.fitRating && feedback.fitRating >= 4 ? 1 : 0,
        negativeFeedback: feedback.fitRating && feedback.fitRating <= 2 ? 1 : 0,
      });
    }
    
    return newFeedback;
  }

  async getProductFeedback(productId: number): Promise<OrderFeedback[]> {
    return await db.select().from(orderFeedback).where(eq(orderFeedback.productId, productId)).orderBy(desc(orderFeedback.createdAt));
  }

  async calculateFitScore(productId: number, userMeasurements?: Measurement): Promise<number> {
    const metrics = await this.getProductFitMetrics(productId);
    if (!metrics) return 85; // Default score for products without feedback
    
    const total = (metrics.positiveFeedback || 0) + (metrics.negativeFeedback || 0);
    if (total === 0) return 85;
    
    const positiveRate = (metrics.positiveFeedback || 0) / total;
    return Math.round(70 + (positiveRate * 30)); // Score between 70-100
  }

  // Measurement alerts
  async createMeasurementAlert(alert: { measurementId: number; userId: string; vendorId?: number; alertType: string; deltaSummary?: object }): Promise<MeasurementAlert> {
    const [newAlert] = await db.insert(measurementAlerts).values(alert).returning();
    return newAlert;
  }

  async getVendorMeasurementAlerts(vendorId: number): Promise<MeasurementAlert[]> {
    return await db.select().from(measurementAlerts).where(eq(measurementAlerts.vendorId, vendorId)).orderBy(desc(measurementAlerts.createdAt));
  }

  async acknowledgeMeasurementAlert(id: number, vendorId: number): Promise<void> {
    await db.update(measurementAlerts).set({ 
      acknowledgedByVendorId: vendorId, 
      acknowledgedAt: new Date(), 
      status: "acknowledged" 
    }).where(eq(measurementAlerts.id, id));
  }

  // Production steps operations
  async createProductionStep(step: InsertProductionStep): Promise<OrderProductionStep> {
    const [newStep] = await db.insert(orderProductionSteps).values(step).returning();
    return newStep;
  }

  async getProductionStep(id: number): Promise<OrderProductionStep | undefined> {
    const [step] = await db.select().from(orderProductionSteps).where(eq(orderProductionSteps.id, id));
    return step;
  }

  async getOrderProductionSteps(orderId: number): Promise<OrderProductionStep[]> {
    return await db.select().from(orderProductionSteps).where(eq(orderProductionSteps.orderId, orderId)).orderBy(orderProductionSteps.createdAt);
  }

  async updateProductionStep(id: number, completedAt: Date, notes?: string): Promise<void> {
    const update: any = { completedAt };
    if (notes) update.notes = notes;
    await db.update(orderProductionSteps).set(update).where(eq(orderProductionSteps.id, id));
  }

  async getVendorOrders(vendorId: number): Promise<Order[]> {
    const vendorProducts = await db.select({ id: products.id }).from(products).where(eq(products.vendorId, vendorId));
    const productIds = vendorProducts.map(p => p.id);
    
    if (productIds.length === 0) return [];
    
    const vendorOrderItems = await db.select().from(orderItems).where(sql`${orderItems.productId} IN ${productIds}`);
    const orderIds = Array.from(new Set(vendorOrderItems.map(oi => oi.orderId)));
    
    if (orderIds.length === 0) return [];
    
    return await db.select().from(orders)
      .where(and(
        sql`${orders.id} IN ${orderIds}`,
        eq(orders.paymentStatus, 'paid'),
        or(eq(orders.shippingPaymentStatus, 'included'), eq(orders.shippingPaymentStatus, 'paid')),
        sql`${orders.orderStatus} <> 'awaiting_shipping_quote'`,
      ))
      .orderBy(desc(orders.createdAt));
  }

  // Vendor resources operations
  async createVendorResource(resource: InsertVendorResource): Promise<VendorResource> {
    const [newResource] = await db.insert(vendorResources).values(resource as any).returning();
    return newResource;
  }

  async getVendorResources(vendorId: number): Promise<VendorResource[]> {
    return await db.select().from(vendorResources).where(eq(vendorResources.vendorId, vendorId));
  }

  async updateVendorResource(id: number, quantity: number): Promise<void> {
    await db.update(vendorResources).set({ quantity: quantity.toString(), updatedAt: new Date() }).where(eq(vendorResources.id, id));
  }

  async getLowStockResources(vendorId: number): Promise<VendorResource[]> {
    return await db.select().from(vendorResources).where(
      and(
        eq(vendorResources.vendorId, vendorId),
        sql`CAST(${vendorResources.quantity} AS DECIMAL) <= CAST(${vendorResources.lowStockThreshold} AS DECIMAL)`
      )
    );
  }

  // Event collections operations
  async createEventCollection(collection: InsertEventCollection): Promise<EventCollection> {
    const [newCollection] = await db.insert(eventCollections).values(collection).returning();
    return newCollection;
  }

  async getEventCollections(eventType?: string): Promise<EventCollection[]> {
    if (eventType) {
      return await db.select().from(eventCollections).where(eq(eventCollections.eventType, eventType));
    }
    return await db.select().from(eventCollections).orderBy(desc(eventCollections.createdAt));
  }

  async getEventCollection(id: number): Promise<EventCollection | undefined> {
    const [collection] = await db.select().from(eventCollections).where(eq(eventCollections.id, id));
    return collection;
  }

  // Product stories operations
  async createProductStory(story: InsertProductStory): Promise<ProductStory> {
    const [newStory] = await db.insert(productStories).values(story).returning();
    return newStory;
  }

  async getProductStories(productId: number): Promise<ProductStory[]> {
    return await db.select().from(productStories).where(
      and(eq(productStories.productId, productId), eq(productStories.isPublished, true))
    );
  }

  async updateProductStoryPublished(id: number, isPublished: boolean): Promise<void> {
    await db.update(productStories).set({ isPublished }).where(eq(productStories.id, id));
  }

  // Loyalty operations
  async getOrCreateLoyaltyAccount(userId: string): Promise<LoyaltyAccount> {
    let [account] = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.userId, userId));
    if (!account) {
      const referralCode = `AFR${userId.slice(0, 6).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      [account] = await db.insert(loyaltyAccounts).values({ userId, referralCode }).returning();
    }
    return account;
  }

  async getLoyaltyAccount(userId: string): Promise<LoyaltyAccount | undefined> {
    const [account] = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.userId, userId));
    return account;
  }

  async addLoyaltyPoints(userId: string, points: number, actionType: string, description: string, referenceId?: number, referenceType?: string): Promise<void> {
    const account = await this.getOrCreateLoyaltyAccount(userId);
    
    await db.insert(loyaltyEvents).values({
      userId,
      actionType,
      pointsDelta: points,
      description,
      referenceId,
      referenceType,
    });
    
    await db.update(loyaltyAccounts).set({
      points: (account.points || 0) + points,
      lifetimePoints: (account.lifetimePoints || 0) + (points > 0 ? points : 0),
    }).where(eq(loyaltyAccounts.userId, userId));
    
    await this.updateLoyaltyTier(userId);
  }

  async redeemLoyaltyPoints(userId: string, points: number): Promise<boolean> {
    const account = await this.getLoyaltyAccount(userId);
    if (!account || (account.points || 0) < points) return false;
    
    await this.addLoyaltyPoints(userId, -points, "redeem", `Redeemed ${points} points`);
    return true;
  }

  async getLoyaltyHistory(userId: string): Promise<LoyaltyEvent[]> {
    return await db.select().from(loyaltyEvents).where(eq(loyaltyEvents.userId, userId)).orderBy(desc(loyaltyEvents.createdAt));
  }

  async updateLoyaltyTier(userId: string): Promise<void> {
    const account = await this.getLoyaltyAccount(userId);
    if (!account) return;
    
    const lifetime = account.lifetimePoints || 0;
    let tier = "bronze";
    if (lifetime >= 10000) tier = "platinum";
    else if (lifetime >= 5000) tier = "gold";
    else if (lifetime >= 1000) tier = "silver";
    
    if (tier !== account.tier) {
      await db.update(loyaltyAccounts).set({ tier, tierUpdatedAt: new Date() }).where(eq(loyaltyAccounts.userId, userId));
    }
  }

  async generateReferralCode(userId: string): Promise<string> {
    const account = await this.getOrCreateLoyaltyAccount(userId);
    return account.referralCode || "";
  }

  async applyReferralCode(userId: string, referralCode: string): Promise<boolean> {
    const [referrer] = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.referralCode, referralCode));
    if (!referrer || referrer.userId === userId) return false;
    
    const userAccount = await this.getOrCreateLoyaltyAccount(userId);
    if (userAccount.referredBy) return false; // Already referred
    
    await db.update(loyaltyAccounts).set({ referredBy: referrer.userId }).where(eq(loyaltyAccounts.userId, userId));
    
    await this.addLoyaltyPoints(userId, 100, "referral", "Welcome bonus for using referral code");
    await this.addLoyaltyPoints(referrer.userId, 200, "referral", `Referral bonus for inviting a friend`);
    
    return true;
  }

  // Quiz operations
  async createCulturalQuiz(quiz: InsertCulturalQuiz): Promise<CulturalQuiz> {
    const [newQuiz] = await db.insert(culturalQuizzes).values(quiz).returning();
    return newQuiz;
  }

  async getActiveQuizzes(): Promise<CulturalQuiz[]> {
    return await db.select().from(culturalQuizzes).where(eq(culturalQuizzes.isActive, true));
  }

  async getQuiz(id: number): Promise<CulturalQuiz | undefined> {
    const [quiz] = await db.select().from(culturalQuizzes).where(eq(culturalQuizzes.id, id));
    return quiz;
  }

  async submitQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt> {
    const [newAttempt] = await db.insert(quizAttempts).values(attempt).returning();
    
    // Award points if passed
    if (newAttempt.passed && newAttempt.pointsEarned && newAttempt.pointsEarned > 0) {
      await this.addLoyaltyPoints(
        newAttempt.userId,
        newAttempt.pointsEarned,
        "quiz_complete",
        `Completed cultural quiz`,
        newAttempt.quizId,
        "quiz"
      );
    }
    
    return newAttempt;
  }

  async getUserQuizAttempts(userId: string): Promise<QuizAttempt[]> {
    return await db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(desc(quizAttempts.createdAt));
  }

  async hasUserCompletedQuiz(userId: string, quizId: number): Promise<boolean> {
    const [attempt] = await db.select().from(quizAttempts).where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId), eq(quizAttempts.passed, true))
    );
    return !!attempt;
  }

  // Fabric assets operations
  async createFabricAsset(asset: InsertFabricAsset): Promise<FabricAsset> {
    const [newAsset] = await db.insert(fabricAssets).values(asset).returning();
    return newAsset;
  }

  async getProductFabricAssets(productId: number): Promise<FabricAsset[]> {
    return await db.select().from(fabricAssets).where(
      and(eq(fabricAssets.productId, productId), eq(fabricAssets.isActive, true))
    );
  }

  // Collaboration drops operations
  async createCollabDrop(drop: InsertCollabDrop): Promise<CollabDrop> {
    const [newDrop] = await db.insert(collabDrops).values(drop).returning();
    return newDrop;
  }

  async getCollabDrops(status?: string): Promise<CollabDrop[]> {
    if (status) {
      return await db.select().from(collabDrops).where(eq(collabDrops.status, status)).orderBy(desc(collabDrops.dropStartTime));
    }
    return await db.select().from(collabDrops).orderBy(desc(collabDrops.dropStartTime));
  }

  async getCollabDrop(id: number): Promise<CollabDrop | undefined> {
    const [drop] = await db.select().from(collabDrops).where(eq(collabDrops.id, id));
    return drop;
  }

  async createDropRsvp(rsvp: InsertDropRsvp): Promise<DropRsvp> {
    const [newRsvp] = await db.insert(dropRsvps).values(rsvp).returning();
    
    // Increment RSVP count
    await db.update(collabDrops).set({ 
      rsvpCount: sql`${collabDrops.rsvpCount} + 1` 
    }).where(eq(collabDrops.id, rsvp.dropId));
    
    return newRsvp;
  }

  async getDropRsvps(dropId: number): Promise<DropRsvp[]> {
    return await db.select().from(dropRsvps).where(eq(dropRsvps.dropId, dropId));
  }

  async getUserDropRsvps(userId: string): Promise<DropRsvp[]> {
    return await db.select().from(dropRsvps).where(eq(dropRsvps.userId, userId));
  }

  async hasUserRsvped(userId: string, dropId: number): Promise<boolean> {
    const [rsvp] = await db.select().from(dropRsvps).where(
      and(eq(dropRsvps.userId, userId), eq(dropRsvps.dropId, dropId))
    );
    return !!rsvp;
  }

  async updateDropStatus(id: number, status: string): Promise<void> {
    await db.update(collabDrops).set({ status }).where(eq(collabDrops.id, id));
  }
}

export const storage = new DatabaseStorage();
