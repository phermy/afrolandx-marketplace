import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { notifyFinancialAdjustment, notifyOrderPayment, notifyVendorSettlement, notifyOrderClosure } from "./payment-emails";
import { closeUnpaidCheckout, unpaidCheckoutCanClose, startUnpaidCheckoutExpiry } from "./unpaid-checkouts";
import { checkoutTotal, unpaidCheckoutExpired } from "../shared/checkout-lifecycle";
import { vendorOrdersHandler } from "./vendor-orders";
import { VENDOR_DETAILS_ROUTE } from "./vendor-route-paths";
import { requestRateLimit } from "./request-rate-limit";
import { checkoutAccess } from "./guest-checkout";
import { ensureShippingProfileTable, registerMarketplaceCheckout } from "./marketplace-checkout";
import { orderDetailsHandler } from "./order-details";
import { createPublicProductHandler } from "./public-product";
import { queueAccountEmail } from "./account-notifications";
import { findSubcategory, subcategoryTag, SUBCATEGORY_TAG_PREFIX } from "@shared/product-subcategories";
import { isDesignatedOwnerEmail } from "./admin-role-bootstrap";
import { RoleManagementError, updateManagedRoles } from "./superadmin-role-management";
import { vendorStatusHandler } from "./admin-vendor-status";
import { canReviewVendorApplication, vendorApplicationForReviewer } from "./vendor-application-access";
import { cacReviewNotes, cacReviewSchema, hasManualCacReview } from "./cac-review";
import { lockApprovedProductReferences } from "./product-reference-lock";
import {
  approveSelectedProducts, getPendingAdminProducts, getProductByClientImportKey,
  parsePendingProductPagination, resolveClientImportRetry, validateProductIds,
} from "./admin-product-bulk";
import { deleteVerifiedTestVendor, previewTestVendorDeletion, TestVendorDeletionError } from "./test-vendor-deletion";
import { setupAuth, isAuthenticated, sanitizeUser } from "./auth";
import { getAdminUserDetails } from "./admin-user-details";
import { productReviewHandlers } from "./admin-product-review";
import { managementGuard } from "./admin-management-guard";
import { canSeeManagedAccount, requireFullManagement } from "./admin-access";
import { hasFullManagementAccess, hasSupportManagementAccess, isAdministratorAccount } from "../shared/admin-access";
import { registerLogisticsRoutes } from "./logistics-routes";
import { ensureOrderShipments } from "./logistics-service";
import { normalizeAccountPhone } from "@shared/account-registration";
import { getPaystackService, isPaystackInitialized, PaystackRequestError } from "./paystack";
import { registerEventPlanningRoutes } from "./event-planning";
import { getChatbotService } from "./chatbot";
import { buildLookbookItems } from "./lookbook-generation";
import { registerVirtualTryOnRoutes } from "./virtual-try-on";
import { registerLiveArRoutes } from "./live-ar";
import { getReviewStatusesForOrderItems, registerReviewRoutes } from "./reviews";
import { initiateScan, getScanResults, getServiceStatus } from "./bodyscan";
import {
  insertVendorSchema, insertProductSchema, insertCartItemSchema, insertMeasurementSchema,
  insertMessageSchema, insertProductionStepSchema, insertVendorResourceSchema,
  insertProductStorySchema, insertFabricAssetSchema, insertCollabDropSchema, orders, orderItems, products, vendors,
  vendorLedgerEntries, vendorPayoutAccounts, vendorSettlements, orderFinancialAdjustments, shippingQuoteRequests, shipments,
  experienceFeedback, insertExperienceFeedbackSchema, returnPolicySchema,
  insertSavedDeliveryAddressSchema,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { getCloudStorageService, getCloudStorageConnectionStatus, isCloudStorageEnabled, reinitializeCloudStorage } from "./cloudStorage";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  calculateCheckoutTotal,
  calculateCheckoutSubtotal,
  calculateEstimatedShippingAmount,
  CheckoutValidationError,
  createCartFingerprint,
  findOwnedCartItem,
  getShippingQuote,
  isValidPaystackWebhookSignature,
  paymentVerificationError,
  shippingPaymentVerificationError,
  SHIPPING_QUOTES,
  recommendShippingCarriers,
} from "./order-security";
import { createVerifiedOrderCompleter } from "./order-processing";
import { deleteStoredProductImage, isProductImageStorageEnabled, requiresDurableProductImageStorage, retouchProductImage, storeLocalProductImage, storeProductImage, suggestProductListing } from "./product-image";
import { getR2ProductPhotoStatus, R2PhotoStorageError } from "./r2-product-photos";
import { InvalidProfileImageError, isManagedProfileImage, MAX_PROFILE_IMAGE_BYTES, prepareProfileImage, PROFILE_IMAGE_TYPES } from "./profile-image";
import { sendExperienceFeedbackNotification } from "./email";
import {
  createFinanceReference,
  createSaleLedger,
  createSettlement,
  claimNegativeAdjustment,
  failNegativeAdjustment as failNegativeAdjustmentRecord,
  finalizeNegativeAdjustment as finalizeNegativeAdjustmentRecord,
  getVendorFinance,
  recordNegativeAdjustment,
  releaseOrderEarnings,
} from "./finance";

const shippingAddressSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).optional().default(''),
  address1: z.string().trim().min(3).max(250),
  address2: z.string().trim().max(250).optional().default(''),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(30),
  country: z.string().trim().min(2).max(100),
});

const quoteRequestSchema = z.object({
  carrier: z.string().trim().min(1).max(120),
  shippingAddress: shippingAddressSchema,
});

const quoteDecisionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('quoted'),
    quotedAmount: z.coerce.number().positive().max(100000000),
    estimatedDelivery: z.string().trim().min(1).max(160),
    adminNotes: z.string().trim().max(2000).optional().default(''),
    validDays: z.coerce.number().int().min(1).max(30).default(7),
  }),
  z.object({
    status: z.literal('rejected'),
    adminNotes: z.string().trim().min(1).max(2000),
  }),
]);

function addressesMatch(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(canonicalAddress(left)) === JSON.stringify(canonicalAddress(right));
  } catch {
    return false;
  }
}

function canonicalAddress(address: unknown) {
  const parsed = shippingAddressSchema.parse(address);
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [
    key, typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : value,
  ]));
}

function safeImagePath(filename: string): string | null {
  if (!filename || filename !== path.basename(filename) || !/^[A-Za-z0-9._-]+$/.test(filename)) return null;
  const uploadRoot = path.resolve(process.cwd(), 'uploads', 'products');
  const candidate = path.resolve(uploadRoot, filename);
  return candidate.startsWith(`${uploadRoot}${path.sep}`) ? candidate : null;
}

function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

declare global {
  namespace Express {
    interface User {
      id?: string;
    }
  }
}

// Configure multer for memory storage (for cloud upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif|avif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMime = /image\/(jpeg|jpg|png|webp|gif|avif)/.test(file.mimetype);

    if (allowedMime && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPG, PNG, WEBP, GIF, AVIF)'));
    }
  }
});

const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROFILE_IMAGE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (PROFILE_IMAGE_TYPES.has(file.mimetype)) callback(null, true);
    else callback(new Error("Choose a JPEG, PNG, or WebP image."));
  },
}).single("image");

const localUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif|avif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMime = /image\/(jpeg|jpg|png|webp|gif|avif)/.test(file.mimetype);

    if (allowedMime && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPG, PNG, WEBP, GIF, AVIF)'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureShippingProfileTable();
  const finalizeNegativeAdjustment = async (reference: string, status: string) => {
    await finalizeNegativeAdjustmentRecord(reference, status);
    await notifyFinancialAdjustment(reference);
  };
  const failNegativeAdjustment = async (reference: string, reason: string) => {
    await failNegativeAdjustmentRecord(reference, reason);
    await notifyFinancialAdjustment(reference);
  };
  app.get('/downloads/femi-elegbeleye-profile.jpg', (_req, res) => {
    const publicRoot = app.get('env') === 'development' ? 'client/public' : 'dist/public';
    const photoPath = path.resolve(process.cwd(), publicRoot, 'downloads/femi-elegbeleye-profile.jpg');
    if (!fs.existsSync(photoPath)) return res.status(404).send('Photo not available');
    res.download(photoPath, 'femi-elegbeleye-profile.jpg');
  });

  // Optimized image serving route
  app.get('/uploads/:filename', async (req, res) => {
    const filename = req.params.filename;
    const filePath = safeImagePath(filename);
    if (!filePath) return res.status(400).json({ message: 'Invalid image path' });
    
    if (fs.existsSync(filePath)) {
      try {
        const { imageProcessor } = await import('./imageProcessor');
        
        // Get optimization parameters from query
        const width = boundedInt(req.query.w, 800, 16, 2400);
        const height = boundedInt(req.query.h, 800, 16, 2400);
        const quality = boundedInt(req.query.q, 85, 30, 95);
        const format = ['jpeg', 'webp', 'png'].includes(String(req.query.f)) ? String(req.query.f) : 'jpeg';
        
        // Optimize and serve image
        const optimizedPath = await imageProcessor.optimizeImage(filePath, {
          width,
          height,
          quality,
          format: format as 'jpeg' | 'webp' | 'png'
        });
        
        // Set appropriate cache headers
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        res.setHeader('Content-Type', `image/${format}`);
        
        res.sendFile(path.resolve(optimizedPath));
      } catch (error) {
        console.error('Error optimizing image:', error);
        // Fallback to original image
        res.sendFile(filePath);
      }
    } else {
      res.status(404).json({ message: 'Image not found' });
    }
  });

  // Advanced image optimization API endpoint
  app.get('/api/images/optimize/uploads/:filename', async (req, res) => {
    const filename = req.params.filename;
    const filePath = safeImagePath(filename);
    if (!filePath) return res.status(400).json({ message: 'Invalid image path' });
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Image not found' });
    }

    try {
      const { imageProcessor } = await import('./imageProcessor');
      
      // Parse optimization parameters
      const width = req.query.w ? boundedInt(req.query.w, 800, 16, 2400) : undefined;
      const height = req.query.h ? boundedInt(req.query.h, 800, 16, 2400) : undefined;
      const quality = boundedInt(req.query.q, 85, 30, 95);
      const format = ['jpeg', 'webp', 'png'].includes(String(req.query.f)) ? String(req.query.f) : 'jpeg';
      
      const optimizedPath = await imageProcessor.optimizeImage(filePath, {
        width,
        height,
        quality,
        format: format as 'jpeg' | 'webp' | 'png'
      });
      
      // Set cache headers and content type
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Content-Type', `image/${format}`);
      
      res.sendFile(path.resolve(optimizedPath));
    } catch (error) {
      console.error('Error in image optimization API:', error);
      res.status(500).json({ message: 'Failed to optimize image' });
    }
  });

  // Auth middleware
  await setupAuth(app);
  registerMarketplaceCheckout(app);
  app.use('/api/admin', isAuthenticated, managementGuard);
  app.use(['/api/categories/init', '/api/discover/inquiries', '/api/discover/premium', '/api/places'], isAuthenticated, requireFullManagement);
  registerLogisticsRoutes(app);
  registerReviewRoutes(app);
  registerVirtualTryOnRoutes(app);
  registerLiveArRoutes(app);
  registerEventPlanningRoutes(app);

  // Geo/currency detection — proxied server-side to avoid CORS
  app.get('/api/geo', async (req: any, res) => {
    try {
      // The response depends on the visitor's IP; shared proxies must not reuse it.
      res.set('Cache-Control', 'private, max-age=3600');

      // Get client IP (handles proxies)
      const forwarded = req.headers['x-forwarded-for'] as string;
      const ip = (forwarded ? forwarded.split(',')[0].trim() : req.ip) || '';
      
      // Skip for localhost/private IPs
      const isLocal = !ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.');
      if (isLocal) {
        return res.json({ local: true });
      }

      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, {
        headers: { 'User-Agent': 'afrolandx/1.0' },
        signal: AbortSignal.timeout(4000),
      });

      if (!geoRes.ok) return res.status(503).json({ error: 'geo_unavailable' });
      const data = await geoRes.json() as any;

      res.json({
        country_code: data.country_code,
        country_name: data.country_name,
        currency: data.currency,
        currency_name: data.currency_name,
      });
    } catch {
      res.status(503).json({ error: 'geo_unavailable' });
    }
  });

  // Privacy-safe public marketplace totals for the homepage.
  app.get('/api/public/stats', async (_req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      const result = await db.execute(sql`
        SELECT
          (
            SELECT COUNT(*)::int
            FROM vendors
            WHERE status = 'approved'
              AND verification_status = 'verified'
              AND business_name NOT IN ('Adunni Fashion', 'Test Vendor Co')
          ) AS verified_vendors,
          (
            SELECT COUNT(*)::int
            FROM users
            WHERE email_verified = true
              AND roles @> '["customer"]'::jsonb
          ) AS verified_customers,
          (
            SELECT COUNT(*)::int
            FROM (
              SELECT created_at FROM users
                WHERE email_verified = true AND created_at >= NOW() - INTERVAL '24 hours'
              UNION ALL
              SELECT created_at FROM messages
                WHERE created_at >= NOW() - INTERVAL '24 hours'
              UNION ALL
              SELECT created_at FROM orders
                WHERE payment_status = 'paid' AND created_at >= NOW() - INTERVAL '24 hours'
            ) daily_activity
          ) AS daily_interactions,
          (
            SELECT COUNT(DISTINCT LOWER(TRIM(shipping_address->>'country')))::int
            FROM orders
            WHERE payment_status = 'paid'
              AND NULLIF(TRIM(shipping_address->>'country'), '') IS NOT NULL
          ) AS countries_served
      `);
      const stats = result.rows[0] as any;
      res.json({
        verifiedVendors: Number(stats?.verified_vendors || 0),
        verifiedCustomers: Number(stats?.verified_customers || 0),
        dailyInteractions: Number(stats?.daily_interactions || 0),
        countriesServed: Number(stats?.countries_served || 0),
        interactionWindow: '24h',
      });
    } catch (error) {
      console.error('Failed to load public marketplace stats:', error);
      res.status(500).json({ message: 'Failed to load marketplace stats' });
    }
  });

  // Exchange rates proxy
  app.get('/api/exchange-rates', async (_req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=3600');
      const rRes = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(5000),
      });
      if (!rRes.ok) return res.status(503).json({ error: 'rates_unavailable' });
      const data = await rRes.json() as any;
      if (!data?.rates || typeof data.rates !== 'object') return res.status(502).json({ error: 'rates_unavailable' });
      res.json({ rates: data.rates });
    } catch {
      res.status(503).json({ error: 'rates_unavailable' });
    }
  });

  app.patch('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const { firstName, lastName } = req.body;
      
      const updatedUser = await storage.updateUserProfile(userId, { firstName, lastName });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post('/api/profile/image', isAuthenticated, (req: any, res) => {
    profileImageUpload(req, res, async (uploadError: any) => {
      if (uploadError) {
        return res.status(uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400)
          .json({ message: uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE"
            ? "The image must be 5 MB or smaller."
            : "Choose a JPEG, PNG, or WebP image up to 5 MB." });
      }
      if (!req.file) return res.status(400).json({ message: "Choose an image to upload." });
      if (!isCloudStorageEnabled()) {
        return res.status(503).json({ message: "Photo storage is unavailable right now. Please try again later." });
      }

      let uploadedUrl: string | undefined;
      try {
        const userId = req.user.id as string;
        const previousUser = await storage.getUser(userId);
        if (!previousUser) return res.status(404).json({ message: "Account not found." });

        const image = await prepareProfileImage(req.file.buffer);
        const cloud = getCloudStorageService();
        uploadedUrl = await cloud.uploadImage(image, "image/jpeg", "profiles");
        const updatedUser = await storage.updateUserProfile(userId, { profileImageUrl: uploadedUrl });
        if (!updatedUser) {
          await cloud.deleteImage(uploadedUrl);
          return res.status(404).json({ message: "Account not found." });
        }
        uploadedUrl = undefined;
        if (previousUser.profileImageUrl && isManagedProfileImage(previousUser.profileImageUrl)) {
          await cloud.deleteImage(previousUser.profileImageUrl);
        }
        return res.json(sanitizeUser(updatedUser));
      } catch (error) {
        if (uploadedUrl) await getCloudStorageService().deleteImage(uploadedUrl);
        if (error instanceof InvalidProfileImageError) {
          return res.status(400).json({ message: error.message });
        }
        console.error("Error updating profile photo:", error);
        return res.status(503).json({ message: "Could not save your photo. Please try again later." });
      }
    });
  });

  app.delete('/api/profile/image', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id as string;
      const previousUser = await storage.getUser(userId);
      if (!previousUser) return res.status(404).json({ message: "Account not found." });
      if (!previousUser.profileImageUrl) return res.json(sanitizeUser(previousUser));

      const updatedUser = await storage.updateUserProfile(userId, { profileImageUrl: null });
      if (!updatedUser) return res.status(404).json({ message: "Account not found." });
      if (isCloudStorageEnabled() && isManagedProfileImage(previousUser.profileImageUrl)) {
        await getCloudStorageService().deleteImage(previousUser.profileImageUrl);
      }
      return res.json(sanitizeUser(updatedUser));
    } catch (error) {
      console.error("Error removing profile photo:", error);
      return res.status(500).json({ message: "Could not remove your photo. Please try again." });
    }
  });

  // Helper function to check if user has role
  const hasRole = (user: any, role: string): boolean => {
    const roles = user?.roles || [];
    return Array.isArray(roles) && roles.includes(role);
  };

  // Admin check middleware
  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = (req.user as any)?.id;
      const user = await storage.getUser(userId);
      
      if (!hasRole(user, 'admin')) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ message: "Error checking admin status" });
    }
  };

  const isSuperadmin = async (req: any, res: any, next: any) => {
    try {
      const current = await storage.getUser(req.user?.id);
      if (!current || !current.emailVerified || !hasRole(current, 'admin') || !hasRole(current, 'superadmin')) {
        return res.status(403).json({ message: 'Verified superadmin access is required.' });
      }
      next();
    } catch (error) {
      res.status(500).json({ message: 'Could not check superadmin access.' });
    }
  };

  // The client route alone is not an access boundary; deny direct page loads too.
  app.get('/discover', (req: any, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!req.isAuthenticated() || !req.user?.emailVerified || req.user?.closedAt) {
      return res.redirect('/login?returnTo=%2Fdiscover');
    }
    if (!hasSupportManagementAccess(req.user)) return res.redirect('/products');
    next();
  }, isAuthenticated, isAdmin, (_req, _res, next) => next());

  // Ordinary admin tools cannot remove the owner-level role (including by
  // replacing all roles) or delete an account that holds it.
  const protectSuperadmin = async (req: any, res: any, next: any) => {
    try {
      const target = await storage.getUser(req.params.userId);
      if (hasRole(target, 'superadmin')) return res.status(403).json({ message: 'Superadmin accounts cannot be changed here' });
      next();
    } catch (error) {
      console.error('Superadmin protection failed:', error);
      res.status(500).json({ message: 'Could not check account privileges' });
    }
  };

  // Vendor check middleware
  const isVendor = async (req: any, res: any, next: any) => {
    try {
      const userId = (req.user as any)?.id;
      const user = await storage.getUser(userId);
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!hasRole(user, 'vendor') || !vendor || vendor.status !== 'approved') {
        return res.status(403).json({ message: "Approved vendor access required" });
      }
      
      req.vendor = vendor;
      next();
    } catch (error) {
      res.status(500).json({ message: "Error checking vendor status" });
    }
  };

  const completeVerifiedOrder = createVerifiedOrderCompleter(storage, async orderId => {
    await createSaleLedger(orderId);
    await notifyOrderPayment(orderId);
  }, ensureOrderShipments, orderId => notifyOrderClosure(orderId, "payment_review"));
  const canAutomaticallyProcessOrder = async (orderId: number): Promise<boolean> => {
    const current = await storage.getOrder(orderId);
    if (!current
      || current.paymentStatus !== 'paid'
      || current.stockReservationStatus !== 'reserved'
      || !['included', 'paid'].includes(current.shippingPaymentStatus)
      || (current.shippingEstimatedAmount && !current.shippingFinalAmount)
      || ['cancelled', 'expired', 'payment_review'].includes(current.orderStatus || '')) {
      return false;
    }
    const items = await storage.getOrderItemsWithProducts(orderId);
    if (items.length === 0) return false;
    const vendorIds = new Set<number>();
    for (const item of items) {
      const product = await storage.getProduct(item.productId);
      if (!product) return false;
      vendorIds.add(product.vendorId);
    }
    for (const vendorId of Array.from(vendorIds)) {
      const vendor = await storage.getVendor(vendorId);
      if (!vendor || vendor.status !== 'approved') return false;
    }
    return true;
  };
  const completeVerifiedShippingPayment = async (order: any, verification: any, reference: string): Promise<boolean> => {
    const mismatch = shippingPaymentVerificationError(order, verification, reference);
    if (mismatch) return false;
    const transitioned = await storage.markShippingPaid(order.id, reference);
    if (!transitioned) {
      await notifyOrderPayment(order.id, 'shipping');
      return (await storage.getOrder(order.id))?.shippingPaymentStatus === 'paid';
    }
    if (order.shippingQuoteRequestId) {
      await storage.updateShippingQuoteRequest(order.shippingQuoteRequestId, { status: 'used' });
    }
    const movedToProcessing = await canAutomaticallyProcessOrder(order.id);
    if (movedToProcessing) await storage.updateOrderStatus(order.id, 'processing');
    await storage.createNotification({
      userId: order.userId,
      title: 'Shipping payment confirmed',
      message: movedToProcessing
        ? `Shipping for order #${order.id} has been paid. Your order is now being processed.`
        : `Shipping for order #${order.id} has been paid and is awaiting fulfillment review.`,
      type: 'shipping_quote',
      orderId: order.id,
    }).catch(error => console.error('Failed to notify buyer about shipping payment:', error));
    await notifyOrderPayment(order.id, 'shipping');
    return true;
  };

  // Admin user management routes
  app.get('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const details = await getAdminUserDetails(storage, req.params.userId, (req as any).managementActor);
      if (!details) return res.status(404).json({ message: 'Account not found.' });
      res.json(details);
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({ message: 'Failed to fetch account details.' });
    }
  });

  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.filter(account => canSeeManagedAccount((req as any).managementActor, account)).map(account => ({
        ...sanitizeUser(account),
        roleManagementLocked: isDesignatedOwnerEmail(account.email),
      })));
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Close accounts without deleting linked orders, payments, catalog, or audit history.
  app.get('/api/admin/vendors', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const actor = (req as any).managementActor;
      const accounts = await storage.getAllUsers();
      const applicants = new Map(accounts.filter(account => canReviewVendorApplication(actor, account)).map(account => [account.id, account]));
      const allVendors = await storage.getAllVendors();
      res.json(allVendors.flatMap(vendor => {
        const applicant = applicants.get(vendor.userId);
        return applicant ? [vendorApplicationForReviewer(vendor, applicant, actor)] : [];
      }));
    } catch { res.status(503).json({ message: 'Could not load vendor support records.' }); }
  });
  app.post('/api/admin/users/:userId/close', isAuthenticated, isSuperadmin, async (req: any, res) => {
    if (typeof req.body?.confirmation !== 'string') {
      return res.status(400).json({ message: 'Type the account email to confirm closure.' });
    }
    try {
      const closed = await storage.closeUser(req.params.userId, req.user.id, req.body.confirmation);
      if (!closed) return res.status(404).json({ message: 'Account not found.' });
      return res.json({ message: 'Account closed. Access is blocked and business records are retained.' });
    } catch (error: any) {
      if (error?.message === 'SUPERADMIN_REQUIRED' || error?.message === 'PROTECTED_ACCOUNT') {
        return res.status(403).json({ message: 'This account cannot be closed by this Superadmin.' });
      }
      if (error?.message === 'ACCOUNT_CONFIRMATION_REQUIRED') {
        return res.status(400).json({ message: 'The confirmation does not match the account email.' });
      }
      if (error?.message === 'ACCOUNT_ALREADY_CLOSED') {
        return res.status(409).json({ message: 'This account is already closed.' });
      }
      console.error('Error closing account:', error);
      return res.status(503).json({ message: 'Account closure failed. No changes were saved.' });
    }
  });

  // Only unlinked accounts may be permanently deleted (admin only).
  app.delete('/api/admin/users/:userId', isAuthenticated, isAdmin, protectSuperadmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: 'User ID is required' });
      }
      if (userId === req.user.id) {
        return res.status(400).json({ message: 'You cannot delete your own admin account' });
      }
      const target = await storage.getUser(userId);
      const actor = await storage.getUser(req.user.id);
      if (hasRole(target, 'admin') && !hasRole(actor, 'superadmin')) {
        return res.status(403).json({ message: 'Only a superadmin can delete an admin account.' });
      }

      const deleted = await storage.deleteUser(userId, req.user.id);
      if (!deleted) return res.status(404).json({ message: 'User not found' });
      res.json({ message: 'Unused account deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      if (error?.message === 'PROTECTED_ACCOUNT' || error?.message === 'ACCOUNT_DELETION_FORBIDDEN') {
        return res.status(403).json({ message: 'This protected account cannot be deleted.' });
      }
      if (error?.message === 'SUPERADMIN_REQUIRED') {
        return res.status(403).json({ message: 'Only a verified superadmin can delete an admin account.' });
      }
      if (error?.message === 'ACCOUNT_HAS_LINKED_RECORDS') {
        return res.status(409).json({
          message: 'This account has a vendor profile or orders. It cannot be permanently deleted here; no data was removed.',
        });
      }
      if (error?.code === '23503') {
        return res.status(409).json({
          message: 'This account has linked records that prevent permanent deletion. No account data was removed.',
          blocker: typeof error.constraint === 'string' ? error.constraint : undefined,
        });
      }
      if (error?.code === '42P01' || error?.code === '42703') {
        return res.status(503).json({
          message: 'Account deletion is unavailable because the live database schema is out of date. No account data was removed.',
        });
      }
      res.status(500).json({ message: 'Account deletion failed. No account data was removed. Check the server logs for details.' });
    }
  });

  const handleTestDeletionError = (error: any, res: any) => {
    if (error instanceof TestVendorDeletionError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Test vendor deletion failed:', error);
    if (error?.code === '23503' || error?.code === '23505') {
      return res.status(409).json({
        message: 'Another record still references this account or its test data. Nothing was deleted.',
        blocker: typeof error.constraint === 'string' ? error.constraint : undefined,
      });
    }
    return res.status(503).json({ message: 'Test-data deletion could not be completed. Nothing was deleted.' });
  };

  app.get('/api/admin/users/:userId/test-data-deletion-preview', isAuthenticated, isAdmin, protectSuperadmin, async (req: any, res) => {
    if (req.params.userId === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account.' });
    try {
      res.json(await previewTestVendorDeletion(req.params.userId));
    } catch (error) {
      handleTestDeletionError(error, res);
    }
  });

  app.delete('/api/admin/users/:userId/test-data', isAuthenticated, isAdmin, protectSuperadmin, async (req: any, res) => {
    if (req.params.userId === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account.' });
    if (typeof req.body?.confirmationEmail !== 'string' || typeof req.body?.fingerprint !== 'string') {
      return res.status(400).json({ message: 'Preview the test records and type the account email to confirm deletion.' });
    }
    try {
      const result = await deleteVerifiedTestVendor(req.params.userId, req.body.confirmationEmail, req.body.fingerprint);
      res.json({ message: 'The vendor account and its verified test data were removed.', ...result });
    } catch (error) {
      handleTestDeletionError(error, res);
    }
  });

  const handleRoleManagementError = (error: unknown, res: any) => {
    if (error instanceof RoleManagementError) return res.status(error.status).json({ message: error.message });
    console.error('Role management failed:', error);
    return res.status(500).json({ message: 'Could not update user roles.' });
  };

  // Role management, including the legacy grant endpoint, belongs only to
  // verified superadmins. The service checks privileges again under row locks.
  app.patch('/api/admin/users/:userId/roles', isAuthenticated, isSuperadmin, async (req: any, res) => {
    try {
      const roles = await updateManagedRoles(req.user.id, req.params.userId, { roles: req.body?.roles });
      res.json({ message: 'User roles updated successfully', roles });
    } catch (error) {
      handleRoleManagementError(error, res);
    }
  });

  app.post('/api/admin/users/:userId/roles/:role', isAuthenticated, isSuperadmin, async (req: any, res) => {
    try {
      const roles = await updateManagedRoles(req.user.id, req.params.userId, { role: req.params.role, enabled: true });
      res.json({ message: 'Role added successfully', roles });
    } catch (error) {
      handleRoleManagementError(error, res);
    }
  });

  app.delete('/api/admin/users/:userId/roles/:role', isAuthenticated, isSuperadmin, async (req: any, res) => {
    try {
      const roles = await updateManagedRoles(req.user.id, req.params.userId, { role: req.params.role, enabled: false });
      res.json({ message: 'Role removed successfully', roles });
    } catch (error) {
      handleRoleManagementError(error, res);
    }
  });

  app.post('/api/admin/grant-admin', isAuthenticated, isSuperadmin, async (req: any, res) => {
    try {
      const roles = await updateManagedRoles(req.user.id, req.body?.userId, { role: 'admin', enabled: true });
      res.json({ message: 'Admin privileges granted successfully', roles });
    } catch (error) {
      handleRoleManagementError(error, res);
    }
  });

  // Initialize default categories
  app.post('/api/categories/init', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const defaultCategories = [
        { name: 'Traditional Wear',   slug: 'traditional-wear',  description: 'Authentic African traditional clothing' },
        { name: 'Aso Oke',            slug: 'aso-oke',           description: 'Handwoven traditional fabrics' },
        { name: 'Beads & Jewelry',    slug: 'beads-jewelry',     description: 'Traditional African beads and jewelry' },
        { name: 'Accessories',        slug: 'accessories',       description: 'Fashion accessories and items' },
        { name: 'Ankara & Kente',     slug: 'ankara-kente',      description: 'Printed and woven African fabrics' },
        { name: 'Footwear',           slug: 'footwear',          description: 'African leather sandals and shoes' },
        { name: 'Home & Crafts',      slug: 'home-crafts',       description: 'Handmade baskets, carvings, and art' },
        { name: 'Beauty & Wellness',  slug: 'beauty-wellness',   description: 'African natural beauty products' },
        { name: 'Others',             slug: 'others',            description: 'Other African fashion products not listed above' },
      ];

      // Fetch slugs that already exist so we never hit the unique constraint
      const existing = await storage.getCategories();
      const existingSlugs = new Set(existing.map((c: any) => c.slug));

      const created = [];
      const skipped = [];
      for (const cat of defaultCategories) {
        if (existingSlugs.has(cat.slug)) {
          skipped.push(cat.slug);
          continue;
        }
        const category = await storage.createCategory(cat);
        created.push(category);
      }

      const message = created.length === 0
        ? `All categories already exist (${skipped.length} skipped)`
        : `Created ${created.length} categor${created.length === 1 ? 'y' : 'ies'}${skipped.length ? `, ${skipped.length} already existed` : ''}`;

      res.json({ message, categories: [...existing, ...created] });
    } catch (error) {
      console.error('Error initializing categories:', error);
      res.status(500).json({ message: 'Failed to initialize categories' });
    }
  });

  // Categories routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  // Vendor routes
  app.post('/api/vendors', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;

      // Prevent duplicate vendor registration
      const existingVendor = await storage.getVendorByUserId(userId);
      if (existingVendor) {
        return res.status(409).json({
          message: 'You are already registered as a vendor.',
          vendor: existingVendor,
          alreadyRegistered: true,
        });
      }

      const vendorInput = z.object({
        contactName: z.string().trim().min(2).max(120),
        businessName: z.string().trim().min(2).max(160),
        phone: z.string().transform((value, ctx) => {
          const phone = normalizeAccountPhone(value);
          if (!phone) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number with 7 to 15 digits." });
            return z.NEVER;
          }
          return phone;
        }),
        cacNumber: z.preprocess(
          (value) => typeof value === 'string' && value.trim() === '' ? null : value,
          z.string().trim().min(3).max(60).nullable().optional(),
        ),
        description: z.string().trim().min(10).max(2000),
      }).parse(req.body);
      const vendorData = insertVendorSchema.parse({
        ...vendorInput,
        userId,
        status: 'pending',
      });

      const vendor = await storage.createVendor(vendorData);
      await storage.addUserRole(userId, 'vendor');
      const applicant = await storage.getUser(userId);
      await queueAccountEmail(applicant?.email, "Vendor application received",
        "Your vendor application has been received and is awaiting verification and approval. You do not have permission to sell until approval. Sign in to view your application, or contact support@afrolandx.com."
      ).catch(() => console.error("Vendor application email could not be queued."));
      res.json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else if ((error as any)?.code === '23505' && (error as any)?.constraint === 'vendors_user_id_unique') {
        const vendor = await storage.getVendorByUserId((req.user as any)?.id);
        res.status(409).json({
          message: 'You are already registered as a vendor.',
          vendor,
          alreadyRegistered: true,
        });
      } else {
        console.error('Error creating vendor:', error);
        res.status(500).json({ message: 'Failed to create vendor' });
      }
    }
  });

  // IMPORTANT: /api/vendors/me routes MUST come before /api/vendors/:id
  // otherwise Express matches "me" as the :id param and hits the admin-only route.

  app.get('/api/vendors/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const vendor = await storage.getVendorByUserId(userId);
      res.set('Cache-Control', 'no-store');
      if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch vendor info' });
    }
  });

  app.patch('/api/vendors/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      const profile = z.object({
        contactName: z.string().trim().min(2).max(120).optional(),
        businessName: z.string().trim().min(2).max(160).optional(),
        phone: z.string().trim().min(7).max(30).optional(),
        cacNumber: z.preprocess(
          (value) => typeof value === 'string' && value.trim() === '' ? null : value,
          z.string().trim().min(3).max(60).nullable().optional(),
        ),
        description: z.string().trim().min(10).max(2000).optional(),
      }).parse(req.body);
      if (Object.keys(profile).length === 0) return res.status(400).json({ message: 'At least one profile field is required' });
      const updated = await db.transaction(async tx => {
        await tx.execute(sql`SELECT id FROM vendors WHERE id = ${vendor.id} FOR UPDATE`);
        const [current] = await tx.select().from(vendors).where(eq(vendors.id, vendor.id));
        if (!current) throw new RoleManagementError('Vendor not found', 404);
        const registrationChanged = (profile.cacNumber !== undefined && profile.cacNumber !== current.cacNumber)
          || (profile.businessName !== undefined && profile.businessName !== current.businessName);
        if (registrationChanged && current.verificationStatus === 'verified') {
          throw new RoleManagementError('A verified CAC number or business name cannot be changed here. Contact support for a new verification review.');
        }
        const [saved] = await tx.update(vendors).set({ ...profile, updatedAt: new Date() })
          .where(eq(vendors.id, vendor.id)).returning();
        return saved;
      });
      const applicant = await storage.getUser(userId);
      const actor = (req as any).managementActor;
      res.json(applicant && actor ? vendorApplicationForReviewer(updated, applicant, actor) : {
        id: updated.id, status: updated.status, verificationStatus: updated.verificationStatus,
      });
    } catch (error) {
      if (error instanceof RoleManagementError) return res.status(error.status).json({ message: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid vendor profile', errors: error.errors });
      console.error('Error updating vendor profile:', error);
      res.status(500).json({ message: 'Failed to update vendor profile' });
    }
  });

  app.get('/api/vendors/me/products', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      const vendorProducts = await storage.getProducts({ vendorId: vendor.id });
      res.json(vendorProducts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch vendor products' });
    }
  });

  app.get('/api/vendors/me/finance', isAuthenticated, async (req: any, res) => {
    try {
      const vendor = await storage.getVendorByUserId((req.user as any)?.id);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      res.set('Cache-Control', 'no-store');
      res.json(await getVendorFinance(vendor.id));
    } catch (error) {
      console.error('Error fetching vendor finance:', error);
      res.status(500).json({ message: 'Failed to fetch vendor finance details' });
    }
  });

  app.get('/api/paystack/banks', isAuthenticated, async (_req, res) => {
    try {
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured' });
      const banks = await getPaystackService().listBanks();
      res.set('Cache-Control', 'private, max-age=86400');
      res.json(banks.map(bank => ({ name: bank.name, code: bank.code })).filter(bank => bank.name && bank.code));
    } catch (error) {
      console.error('Error fetching banks:', error);
      res.status(502).json({ message: 'Could not load the bank list' });
    }
  });

  app.put('/api/vendors/me/payout-account', isAuthenticated, async (req: any, res) => {
    try {
      const vendor = await storage.getVendorByUserId((req.user as any)?.id);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      if (vendor.verificationStatus !== 'verified') {
        return res.status(409).json({ message: 'Complete vendor verification before adding a payout account' });
      }
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured' });
      const input = z.object({
        accountNumber: z.string().regex(/^\d{10}$/),
        bankCode: z.string().trim().min(2).max(32),
        bankName: z.string().trim().min(2).max(160),
      }).parse(req.body);
      const paystack = getPaystackService();
      const resolved = await paystack.resolveBankAccount(input.accountNumber, input.bankCode);
      const recipient = await paystack.createTransferRecipient(resolved.account_name, input.accountNumber, input.bankCode);
      const [account] = await db.insert(vendorPayoutAccounts).values({
        vendorId: vendor.id,
        bankCode: input.bankCode,
        bankName: input.bankName,
        accountName: resolved.account_name,
        accountLast4: input.accountNumber.slice(-4),
        recipientCode: recipient.recipient_code,
        status: 'verified',
        verifiedAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: vendorPayoutAccounts.vendorId,
        set: {
          bankCode: input.bankCode,
          bankName: input.bankName,
          accountName: resolved.account_name,
          accountLast4: input.accountNumber.slice(-4),
          recipientCode: recipient.recipient_code,
          status: 'verified',
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      }).returning();
      res.json({
        id: account.id,
        bankName: account.bankName,
        accountName: account.accountName,
        accountLast4: account.accountLast4,
        status: account.status,
      });
    } catch (error) {
      console.error('Error saving payout account:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Choose a bank and enter a valid 10-digit account number' });
      res.status(502).json({ message: error instanceof Error ? error.message : 'Could not verify payout account' });
    }
  });

  // Admin: list all vendors
  app.get('/api/vendors', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const actor = await storage.getUser((req.user as any)?.id);
      if (!actor || !hasSupportManagementAccess(actor)) return res.status(403).json({ message: 'Verified Admin access is required.' });
      const vendors = await storage.getAllVendors();
      const enriched = await Promise.all(vendors.map(async (v) => {
        const user = await storage.getUser(v.userId);
        if (!user || !canReviewVendorApplication(actor, user)) return null;
        if (isAdministratorAccount(user) && !hasFullManagementAccess(actor)) {
          return vendorApplicationForReviewer(v, user, actor);
        }
        return {
          ...v,
          user: user ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            emailVerified: user.emailVerified,
            profileImageUrl: user.profileImageUrl,
            createdAt: user.createdAt,
          } : null,
        };
      }));
      res.json(enriched.filter(Boolean));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch vendors' });
    }
  });

  // Admin: get single vendor with details
  // Register literal order routes before :id, which would otherwise require
  // Admin access and treat "orders" as a vendor identifier.
  app.get('/api/vendors/orders', isAuthenticated, vendorOrdersHandler);
  app.get('/api/vendors/me/orders', isAuthenticated, vendorOrdersHandler);

  app.get(VENDOR_DETAILS_ROUTE, isAuthenticated, isAdmin, async (req, res) => {
    try {
      const actor = await storage.getUser((req.user as any)?.id);
      if (!actor || !hasSupportManagementAccess(actor)) return res.status(403).json({ message: 'Verified Admin access is required.' });
      const vendorId = parseInt(req.params.id);
      const allVendors = await storage.getAllVendors();
      const vendor = allVendors.find(v => v.id === vendorId);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      const user = await storage.getUser(vendor.userId);
      if (!user || !canReviewVendorApplication(actor, user)) return res.status(404).json({ message: 'Vendor not found' });
      if (isAdministratorAccount(user) && !hasFullManagementAccess(actor)) {
        return res.json(vendorApplicationForReviewer(vendor, user, actor));
      }
      const products = await storage.getProducts({ vendorId });
      res.json({
        ...vendor,
        user: user ? {
          id: user.id, firstName: user.firstName, lastName: user.lastName,
          email: user.email, emailVerified: user.emailVerified,
          profileImageUrl: user.profileImageUrl, createdAt: user.createdAt,
        } : null,
        productCount: products.length,
        approvedProductCount: products.filter(p => p.status === 'approved').length,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch vendor' });
    }
  });

  app.patch('/api/admin/vendors/:id/status', isAuthenticated, vendorStatusHandler);
  app.patch('/api/vendors/:id/status', isAuthenticated, vendorStatusHandler);

  app.patch('/api/admin/vendors/:id/verification', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const vendorId = Number(req.params.id);
      if (!Number.isSafeInteger(vendorId) || vendorId <= 0) return res.status(400).json({ message: 'Invalid vendor ID' });
      const input = cacReviewSchema.parse(req.body);
      const { updated, userId } = await db.transaction(async tx => {
        await tx.execute(sql`SELECT id FROM vendors WHERE id = ${vendorId} FOR UPDATE`);
        const [vendor] = await tx.select().from(vendors).where(eq(vendors.id, vendorId));
        if (!vendor) throw new RoleManagementError('Vendor not found', 404);
        const now = new Date();
        let reviewNotes: string;
        try {
          reviewNotes = cacReviewNotes(vendor, input, (req.user as any).id, now);
        } catch (error) {
          throw new RoleManagementError(error instanceof Error ? error.message : 'Invalid CAC review', 400);
        }
        const verified = input.decision === 'verified';
        const [updated] = await tx.update(vendors).set({
          verificationStatus: input.decision,
          cacVerifiedAt: verified ? now : null,
          identityVerifiedAt: verified ? now : null,
          businessVerifiedAt: verified ? now : null,
          verificationNotes: [vendor.verificationNotes, reviewNotes].filter(Boolean).join('\n\n---\n\n'),
          status: !verified && vendor.status === 'approved' ? 'suspended' : vendor.status,
          updatedAt: now,
        }).where(eq(vendors.id, vendorId)).returning();
        return { updated, userId: vendor.userId };
      });
      await storage.createNotification({
        userId,
        type: 'vendor_verification',
        title: input.decision === 'verified' ? 'Vendor verification completed' : 'Vendor verification needs attention',
        message: input.decision === 'verified'
          ? 'Your CAC, identity, and business checks are complete. Afrolandx can now approve your vendor account.'
          : `Your verification was not approved. ${input.notes || 'Contact support for the required corrections.'}`,
      });
      res.json(updated);
    } catch (error) {
      if (error instanceof RoleManagementError) return res.status(error.status).json({ message: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Complete the verification checklist' });
      console.error('Error reviewing vendor verification:', error);
      res.status(500).json({ message: 'Failed to update vendor verification' });
    }
  });

  // Product routes
  app.post('/api/products/ai-suggest-listing', isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const roles = Array.isArray((req.user as any)?.roles) ? (req.user as any).roles : [];
      const vendor = await storage.getVendorByUserId(userId);
      const allowed = roles.includes('admin') || (vendor && vendor.status === 'approved');
      if (!allowed) return res.status(403).json({ message: 'Approved vendor or admin access required' });
      if (!req.file?.buffer) return res.status(400).json({ message: 'Choose a product photo first' });

      const categories = await storage.getCategories();
      if (categories.length === 0) return res.status(409).json({ message: 'Product categories must be configured first' });
      const suggestion = await suggestProductListing(req.file.buffer, req.file.mimetype, categories);
      if (!suggestion.title || !suggestion.shortDescription || !suggestion.description || !suggestion.categoryId) {
        return res.status(502).json({ message: 'AI could not identify enough visible product details' });
      }
      res.json(suggestion);
    } catch (error: any) {
      console.error('AI product listing suggestion failed:', error);
      const unavailable = String(error?.message || '').includes('not configured');
      res.status(unavailable ? 503 : 502).json({
        message: unavailable ? 'AI product listing is not configured' : 'AI could not analyse this photo. Try a clearer front-facing image.',
      });
    }
  });

  app.post('/api/admin/vendors/:vendorId/products', isAuthenticated, isAdmin, upload.array('images', 5), async (req: any, res) => {
    if (process.env.NODE_ENV === 'production' && !isProductImageStorageEnabled()) {
      return res.status(503).json({ message: 'Product image storage is unavailable. Please try again later.' });
    }
    try {
      const vendorId = Number(req.params.vendorId);
      const vendor = await storage.getVendor(vendorId);
      if (!vendor || vendor.status !== 'approved') {
        return res.status(400).json({ message: 'Choose an approved vendor' });
      }
      const input = z.object({
        name: z.string().trim().min(2).max(240),
        description: z.string().trim().min(10).max(10000),
        categoryId: z.coerce.number().int().positive(),
        price: z.coerce.number().positive(),
        stock: z.coerce.number().int().min(0),
      }).parse(req.body);
      const files = (req.files as Express.Multer.File[]) || [];
      let imageUrls: string[];
      try {
        imageUrls = await Promise.all(files.map(file => storeProductImage(file.buffer, 'products')));
      } catch (error) {
        if (requiresDurableProductImageStorage()) {
          console.error('Admin product image upload failed; refusing temporary local storage:', error);
          return res.status(503).json({ message: 'Product image storage is unavailable. The product was not saved. Please try again later.' });
        }
        throw error;
      }
      const product = await storage.createProduct(insertProductSchema.parse({
        vendorId,
        categoryId: input.categoryId,
        name: input.name,
        shortDescription: input.description.slice(0, 240),
        description: input.description,
        price: input.price.toFixed(2),
        stock: input.stock,
        images: imageUrls,
        status: 'draft',
      }));
      await storage.createNotification({
        userId: vendor.userId,
        type: 'rep_product_created',
        title: 'A product draft was created for you',
        message: `${product.name} is ready in My Products. Review the details, update anything needed, then submit it for approval.`,
        productId: product.id,
      });
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Complete all required product fields', errors: error.errors });
      }
      console.error('Rep product creation failed:', error);
      res.status(500).json({ message: 'Failed to create product draft' });
    }
  });

  app.post('/api/products', isAuthenticated, isVendor, async (req: any, res) => {
    if (process.env.NODE_ENV === 'production' && !isProductImageStorageEnabled()) {
      return res.status(503).json({ message: 'Product image storage is unavailable. Please try again later.' });
    }
    const uploadHandler = isProductImageStorageEnabled() ? upload.array('images', 5) : localUpload.array('images', 5);
    
    uploadHandler(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      let files = (req.files || []) as Express.Multer.File[];
      let imageUrls: string[] = [];
      try {
        // Validate required fields are present
        if (!req.body.name || !req.body.shortDescription || !req.body.description || req.body.price === undefined || req.body.stock === undefined || !req.body.categoryId) {
          return res.status(400).json({ 
            message: 'Missing required fields', 
            required: ['name', 'shortDescription', 'description', 'price', 'stock', 'categoryId']
          });
        }
        
        let clientImportKey: string | undefined;
        if (req.body.clientImportKey !== undefined) {
          const parsedKey = z.string().uuid().safeParse(req.body.clientImportKey);
          if (!parsedKey.success) {
            return res.status(400).json({ message: 'clientImportKey must be a UUID' });
          }
          clientImportKey = parsedKey.data.toLowerCase();
          const existing = await getProductByClientImportKey(clientImportKey);
          const retry = resolveClientImportRetry(existing, req.vendor.id, req.body);
          if (retry.kind !== 'new') {
            if (retry.kind === 'different_vendor') {
              return res.status(409).json({ message: 'clientImportKey belongs to another vendor', reason: 'idempotency_key_owned_by_another_vendor' });
            }
            if (retry.kind === 'payload_conflict') {
              return res.status(409).json({ message: 'clientImportKey was already used with different product details', reason: 'idempotency_key_payload_conflict' });
            }
            return res.status(200).json(retry.product);
          }
        }

        // Upload product images durably in production; local optimization is
        // retained only for development when cloud storage is unavailable.
        if (files && files.length > 0) {
          try {
            if (isProductImageStorageEnabled()) {
              const uploadPromises = files.map(file => 
                storeProductImage(file.buffer, 'products')
              );
              imageUrls = await Promise.all(uploadPromises);
              console.log('Successfully uploaded images to cloud storage');
            } else {
              for (const file of files) {
                if (file.buffer) imageUrls.push(await storeLocalProductImage(file.buffer, 'products'));
              }
              console.log(`Saved ${imageUrls.length} image(s) locally for development`);
            }
          } catch (error: any) {
            if (requiresDurableProductImageStorage()) {
              console.error('Product image upload failed; refusing temporary local storage:', error);
              return res.status(503).json({ message: 'Product image storage is unavailable. Your product was not saved. Please try again later.' });
            }
            console.error('Cloud storage failed, falling back to local storage:', error);
            
            // Check if it's an AWS credential issue and provide specific feedback
            if (error.message?.includes('AWS credentials expired')) {
              console.error('AWS session token has expired. Image will be saved locally until credentials are refreshed.');
            } else if (error.message?.includes('Invalid AWS credentials')) {
              console.error('AWS credentials are invalid. Image will be saved locally until credentials are fixed.');
            }
            
            imageUrls = [];
            for (const file of files) {
              if (file.buffer) imageUrls.push(await storeLocalProductImage(file.buffer, 'products'));
            }
            console.log('Saved product images locally for development');
          }
        }

        // Parse sizes — sent as JSON string from FormData
        let sizes: string[] = [];
        if (req.body.sizes) {
          try { sizes = JSON.parse(req.body.sizes); } catch { sizes = []; }
        }
        let tags: string[] = [];
        if (req.body.tags) {
          try { tags = z.array(z.string().trim().min(1).max(60)).max(30).parse(JSON.parse(req.body.tags)); } catch {
            return res.status(400).json({ message: 'Tags must be a valid list of up to 30 keywords' });
          }
        }
        if (tags.some(tag => tag.startsWith(SUBCATEGORY_TAG_PREFIX))) {
          return res.status(400).json({ message: 'Choose a subcategory using the subcategory field' });
        }
        if (req.body.subcategorySlug) {
          const selected = findSubcategory(req.body.subcategorySlug);
          const category = (await storage.getCategories()).find(item => item.id === Number(req.body.categoryId));
          if (!selected || !category || selected.parentSlug !== category.slug) {
            return res.status(400).json({ message: 'Select a subcategory within the chosen category' });
          }
          if (tags.length === 30) return res.status(400).json({ message: 'Use no more than 29 keywords with a subcategory' });
          tags.push(subcategoryTag(selected.slug));
        }
        let variants: Array<{ size?: string; color?: string; pattern?: string; sku?: string; stock: number }> = [];
        if (req.body.variants) {
          try {
            variants = z.array(z.object({
              size: z.string().trim().max(40).optional(),
              color: z.string().trim().max(60).optional(),
              pattern: z.string().trim().max(60).optional(),
              sku: z.string().trim().max(100).optional(),
              stock: z.coerce.number().int().min(0),
            })).max(100).parse(JSON.parse(req.body.variants));
          } catch {
            return res.status(400).json({ message: 'Variants must be a valid list with non-negative stock values' });
          }
        }

        const productData = {
          name: req.body.name.trim(),
          shortDescription: req.body.shortDescription.trim(),
          description: req.body.description.trim(),
          price: req.body.price,
          compareAtPrice: req.body.compareAtPrice && req.body.compareAtPrice.trim() ? req.body.compareAtPrice.trim() : null,
          sku: req.body.sku && req.body.sku.trim() ? req.body.sku.trim() : null,
          stock: parseInt(req.body.stock),
          categoryId: parseInt(req.body.categoryId),
          weight: req.body.weight && req.body.weight.trim() ? req.body.weight.trim() : undefined,
          dimensions: req.body.dimensions && req.body.dimensions.trim() ? req.body.dimensions.trim() : null,
          shippingClass: req.body.shippingClass && req.body.shippingClass.trim() ? req.body.shippingClass.trim() : null,
          processingTime: req.body.processingTime && req.body.processingTime.trim() ? req.body.processingTime.trim() : null,
          careInstructions: req.body.careInstructions && req.body.careInstructions.trim() ? req.body.careInstructions.trim() : null,
          returnPolicy: returnPolicySchema.parse(req.body.returnPolicy || "standard_returns"),
          metaTitle: req.body.metaTitle && req.body.metaTitle.trim() ? req.body.metaTitle.trim() : null,
          metaDescription: req.body.metaDescription && req.body.metaDescription.trim() ? req.body.metaDescription.trim() : null,
          requiresMeasurements: req.body.requiresMeasurements === 'true',
          tags,
          variants,
          imageUrl: req.body.imageUrl && req.body.imageUrl.trim() ? req.body.imageUrl.trim() : undefined,
          images: imageUrls,
          sizes,
          vendorId: req.vendor.id,
          gender: req.body.gender && req.body.gender.trim() ? req.body.gender.trim() : null,
          originCountry: req.body.originCountry && req.body.originCountry.trim() ? req.body.originCountry.trim() : null,
          traditionalName: req.body.traditionalName && req.body.traditionalName.trim() ? req.body.traditionalName.trim() : null,
          status: req.body.status === 'draft' ? 'draft' : 'pending',
          ...(clientImportKey ? { clientImportKey } : {}),
        };

        const numericPrice = Number(productData.price);
        const numericCompareAtPrice = productData.compareAtPrice === null ? null : Number(productData.compareAtPrice);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
          return res.status(400).json({ message: 'Price must be a positive number' });
        }
        if (numericCompareAtPrice !== null && (!Number.isFinite(numericCompareAtPrice) || numericCompareAtPrice <= numericPrice)) {
          return res.status(400).json({ message: 'Compare-at price must be greater than the selling price' });
        }

        const validatedData = insertProductSchema.parse(productData);
        const product = await storage.createProduct(validatedData);
        res.json(product);
      } catch (error) {
        const databaseError = error as {
          code?: string; constraint?: string; cause?: { code?: string; constraint?: string };
        };
        const importKeyConflict = (databaseError?.code === '23505' && databaseError.constraint === 'products_client_import_key_unique')
          || (databaseError?.cause?.code === '23505' && databaseError.cause.constraint === 'products_client_import_key_unique');
        if (importKeyConflict && req.body.clientImportKey) {
          if (isProductImageStorageEnabled()) {
            await Promise.all(imageUrls.map(imageUrl => deleteStoredProductImage(imageUrl).catch(() => {
              console.error("Could not clean up an unused product photo.");
            })));
          }
          const existing = await getProductByClientImportKey(String(req.body.clientImportKey).toLowerCase());
          const retry = resolveClientImportRetry(existing, req.vendor.id, req.body);
          if (retry.kind === 'same_vendor') return res.status(200).json(retry.product);
          return res.status(409).json({
            message: retry.kind === 'different_vendor'
              ? 'clientImportKey belongs to another vendor'
              : 'clientImportKey was already used with different product details',
            reason: retry.kind === 'different_vendor' ? 'idempotency_key_owned_by_another_vendor' : 'idempotency_key_payload_conflict',
          });
        }
        if (error instanceof z.ZodError) {
          console.error('Validation error details:', error.errors);
          res.status(400).json({ message: 'Validation error', errors: error.errors });
        } else {
          console.error('Error creating product:', error);
          res.status(500).json({ message: 'Failed to create product' });
        }
      }
    });
  });

  app.get('/api/products', async (req, res) => {
    try {
      const {
        categoryId, 
        subcategory,
        vendorId, 
        featured, 
        search, 
        minPrice, 
        maxPrice,
        gender,
        originCountry
      } = req.query;
      
      const filters: any = { status: 'approved' };
      if (categoryId) filters.categoryId = parseInt(categoryId as string);
      if (subcategory !== undefined) {
        if (typeof subcategory !== 'string') return res.status(400).json({ message: 'Invalid subcategory' });
        const selected = findSubcategory(subcategory);
        if (!selected) return res.status(400).json({ message: 'Invalid subcategory' });
        const parent = (await storage.getCategories()).find(item => item.slug === selected.parentSlug);
        if (!parent || (categoryId && Number(categoryId) !== parent.id)) {
          return res.status(400).json({ message: 'Subcategory does not match category' });
        }
        filters.categoryId = parent.id;
        filters.subcategory = selected.slug;
      }
      if (vendorId) filters.vendorId = parseInt(vendorId as string);
      if (featured) filters.featured = featured === 'true';
      if (search) filters.search = search as string;
      if (minPrice) filters.minPrice = parseFloat(minPrice as string);
      if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);
      if (gender && gender !== 'all') filters.gender = gender as string;
      if (originCountry && originCountry !== 'all') filters.originCountry = originCountry as string;

      const products = await storage.getProducts(filters);
      const publicProducts = (await Promise.all(products.map(async product => {
        const vendor = await storage.getVendor(product.vendorId);
        return vendor?.status === 'approved' && vendor.verificationStatus === 'verified' ? product : null;
      }))).filter((product): product is NonNullable<typeof product> => product !== null);
      res.json(publicProducts);
    } catch (error) {
      console.error('Products error:', error);
      res.status(500).json({ message: 'Failed to fetch products' });
    }
  });

  app.get('/api/products/with-details', async (req, res) => {
    try {
      const products = (await storage.getProductsWithVendor()).filter(product =>
        product.status === 'approved'
        && product.vendor?.status === 'approved'
        && product.vendor?.verificationStatus === 'verified'
      );
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch products with details' });
    }
  });

  app.get('/api/admin/products/pending', isAuthenticated, isAdmin, async (req, res) => {
    const pagination = parsePendingProductPagination(req.query.limit, req.query.offset);
    if (!pagination) {
      return res.status(400).json({ message: 'limit must be 1..50 and offset must be a nonnegative safe integer' });
    }
    try {
      const result = await getPendingAdminProducts(pagination.limit, pagination.offset);
      res.json(result);
    } catch (error) {
      console.error('Failed to fetch pending admin products:', error);
      res.status(500).json({ message: 'Failed to fetch pending products' });
    }
  });

  app.post('/api/admin/products/bulk-approve', isAuthenticated, isAdmin, async (req, res) => {
    const productIds = req.body?.productIds;
    if (!validateProductIds(productIds)) {
      return res.status(400).json({
        message: 'productIds must contain 1 to 50 unique positive safe integers',
      });
    }

    try {
      const result = await approveSelectedProducts(productIds);
      res.json(result);
    } catch (error) {
      console.error('Failed to bulk approve products:', error);
      res.status(500).json({ message: 'Failed to approve selected products' });
    }
  });

  app.get('/api/public/vendors/:id', async (req, res) => {
    const idText = req.params.id;
    if (!/^[1-9]\d*$/.test(idText)) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    const vendorId = Number(idText);
    if (!Number.isSafeInteger(vendorId)) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    try {
      const [vendor] = await db
        .select({
          id: vendors.id,
          businessName: vendors.businessName,
          description: vendors.description,
        })
        .from(vendors)
        .where(and(
          eq(vendors.id, vendorId),
          eq(vendors.status, 'approved'),
        ))
        .limit(1);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

      const approvedProducts = await db
        .select({
          id: products.id,
          name: products.name,
          imageUrl: products.imageUrl,
          price: products.price,
          originCountry: products.originCountry,
        })
        .from(products)
        .where(and(eq(products.vendorId, vendorId), eq(products.status, 'approved')))
        .orderBy(desc(products.id))
        .limit(60);
      res.json({
        vendor: {
          id: vendor.id,
          businessName: vendor.businessName,
          description: vendor.description,
        },
        products: approvedProducts.map(product => ({
          id: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          price: Number(product.price),
          originCountry: product.originCountry,
        })),
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch public vendor' });
    }
  });

  app.get('/api/products/:id', createPublicProductHandler(storage));

  // Vendor: update their own product (name, description, price, stock, imageUrl, removeImages)
  app.patch('/api/products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const productId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved' || product.vendorId !== vendor.id) {
        return res.status(403).json({ message: 'Access denied: This product does not belong to you' });
      }
      const {
        name, shortDescription, description, price, compareAtPrice, sku, stock, imageUrl,
        dimensions, shippingClass, processingTime, careInstructions, returnPolicy, metaTitle, metaDescription,
        requiresMeasurements, tags, variants, removeImages, gender, originCountry, traditionalName
      } = req.body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined && name.trim()) updates.name = name.trim();
      if (shortDescription !== undefined) updates.shortDescription = shortDescription.trim() || null;
      if (description !== undefined) updates.description = description.trim();
      if (price !== undefined) updates.price = price;
      if (compareAtPrice !== undefined) updates.compareAtPrice = compareAtPrice && compareAtPrice.trim() ? compareAtPrice.trim() : null;
      if (sku !== undefined) updates.sku = sku && sku.trim() ? sku.trim() : null;
      if (stock !== undefined) updates.stock = parseInt(stock);
      if (imageUrl !== undefined) updates.imageUrl = imageUrl.trim() || null;
      if (dimensions !== undefined) updates.dimensions = dimensions && dimensions.trim() ? dimensions.trim() : null;
      if (shippingClass !== undefined) updates.shippingClass = shippingClass && shippingClass.trim() ? shippingClass.trim() : null;
      if (processingTime !== undefined) updates.processingTime = processingTime && processingTime.trim() ? processingTime.trim() : null;
      if (careInstructions !== undefined) updates.careInstructions = careInstructions && careInstructions.trim() ? careInstructions.trim() : null;
       if (returnPolicy !== undefined) {
         const parsedReturnPolicy = returnPolicySchema.safeParse(returnPolicy);
         if (!parsedReturnPolicy.success) {
           return res.status(400).json({ message: 'Select an approved AfrolandX return classification' });
         }
         updates.returnPolicy = parsedReturnPolicy.data;
       }
      if (metaTitle !== undefined) updates.metaTitle = metaTitle && metaTitle.trim() ? metaTitle.trim() : null;
      if (metaDescription !== undefined) updates.metaDescription = metaDescription && metaDescription.trim() ? metaDescription.trim() : null;
      if (requiresMeasurements !== undefined) updates.requiresMeasurements = requiresMeasurements === true || requiresMeasurements === 'true';
      if (tags !== undefined) {
        try {
          updates.tags = z.array(z.string().trim().min(1).max(60)).max(30).parse(typeof tags === 'string' ? JSON.parse(tags) : tags);
          if ((updates.tags as string[]).some(tag => tag.startsWith(SUBCATEGORY_TAG_PREFIX))) {
            return res.status(400).json({ message: 'Choose a subcategory using the subcategory field' });
          }
        } catch {
          return res.status(400).json({ message: 'Tags must be a valid list of up to 30 keywords' });
        }
      }
      if (req.body.subcategorySlug !== undefined || tags !== undefined) {
        const slug = req.body.subcategorySlug;
        const baseTags = ((updates.tags ?? product.tags) as string[] || []).filter(
          tag => typeof tag === 'string' && !tag.startsWith(SUBCATEGORY_TAG_PREFIX)
        );
        if (slug !== undefined && slug !== '') {
          const selected = typeof slug === 'string' ? findSubcategory(slug) : undefined;
          const category = (await storage.getCategories()).find(item => item.id === product.categoryId);
          if (!selected || !category || selected.parentSlug !== category.slug) {
            return res.status(400).json({ message: 'Select a subcategory within the product category' });
          }
          baseTags.push(subcategoryTag(selected.slug));
        } else if (slug === undefined) {
          const existing = (product.tags as string[] || []).find(tag => typeof tag === 'string' && tag.startsWith(SUBCATEGORY_TAG_PREFIX));
          if (existing) baseTags.push(existing);
        }
        if (baseTags.length > 30) return res.status(400).json({ message: 'Use no more than 30 tags' });
        updates.tags = baseTags;
      }
      if (variants !== undefined) {
        try {
          updates.variants = z.array(z.object({
            size: z.string().trim().max(40).optional(),
            color: z.string().trim().max(60).optional(),
            pattern: z.string().trim().max(60).optional(),
            sku: z.string().trim().max(100).optional(),
            stock: z.coerce.number().int().min(0),
          })).max(100).parse(typeof variants === 'string' ? JSON.parse(variants) : variants);
        } catch {
          return res.status(400).json({ message: 'Variants must be a valid list with non-negative stock values' });
        }
      }
      if (gender !== undefined) updates.gender = gender && gender.trim() ? gender.trim() : null;
      if (originCountry !== undefined) updates.originCountry = originCountry && originCountry.trim() ? originCountry.trim() : null;
      if (traditionalName !== undefined) updates.traditionalName = traditionalName && traditionalName.trim() ? traditionalName.trim() : null;
      if (updates.price !== undefined && (!Number.isFinite(Number(updates.price)) || Number(updates.price) <= 0)) {
        return res.status(400).json({ message: 'Price must be a positive number' });
      }
      if (updates.stock !== undefined && (!Number.isSafeInteger(updates.stock) || (updates.stock as number) < 0)) {
        return res.status(400).json({ message: 'Stock must be a non-negative whole number' });
      }
      const updated = await storage.updateProduct(productId, updates as any);

      // Handle image removal — filter URLs the vendor wants gone
      if (removeImages) {
        const toRemove: string[] = Array.isArray(removeImages)
          ? removeImages
          : JSON.parse(removeImages);
        if (toRemove.length > 0) {
          const refreshed = await storage.getProduct(productId);
          const currentImages = (refreshed?.images as string[]) || [];
          const kept = currentImages.filter(url => !toRemove.includes(url));
          await storage.updateProductImages(productId, kept);
          // If imageUrl itself was removed, clear it too
          if (refreshed?.imageUrl && toRemove.includes(refreshed.imageUrl)) {
            await storage.updateProduct(productId, { imageUrl: null as any });
          }
        }
      }

      const final = await storage.getProduct(productId);
      res.json(final);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Failed to update product' });
    }
  });

  // Vendor: upload additional images to an existing product
  app.post('/api/products/:id/images', isAuthenticated, async (req: any, res) => {
    if (process.env.NODE_ENV === 'production' && !isProductImageStorageEnabled()) {
      return res.status(503).json({ message: 'Product image storage is unavailable. Please try again later.' });
    }
    const uploadHandler = isProductImageStorageEnabled() ? upload.array('images', 10) : localUpload.array('images', 10);
    uploadHandler(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      try {
        const productId = parseInt(req.params.id);
        const userId = (req.user as any)?.id;
        const product = await storage.getProduct(productId);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        const vendor = await storage.getVendorByUserId(userId);
        if (!vendor || vendor.status !== 'approved' || product.vendorId !== vendor.id) {
          return res.status(403).json({ message: 'Access denied: This product does not belong to you' });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ message: 'No images provided' });
        }

        let newImageUrls: string[] = [];
        try {
          if (isProductImageStorageEnabled()) {
            newImageUrls = await Promise.all(files.map(f => storeProductImage(f.buffer, 'products')));
          } else {
            for (const file of files) {
              if (file.buffer) newImageUrls.push(await storeLocalProductImage(file.buffer, 'products'));
            }
          }
        } catch (uploadErr: any) {
          if (requiresDurableProductImageStorage()) {
            console.error('Product image upload failed; refusing temporary local storage:', uploadErr);
            return res.status(503).json({ message: 'Product image storage is unavailable. No images were added. Please try again later.' });
          }
          // Fallback to local
          newImageUrls = [];
          for (const file of files) {
            if (file.buffer) newImageUrls.push(await storeLocalProductImage(file.buffer, 'products'));
          }
        }

        // Append new images to existing array
        const currentImages = (product.images as string[]) || [];
        await storage.updateProductImages(productId, [...currentImages, ...newImageUrls]);

        const updated = await storage.getProduct(productId);
        res.json(updated);
      } catch (error) {
        console.error('Error uploading product images:', error);
        res.status(500).json({ message: 'Failed to upload images' });
      }
    });
  });

  app.post('/api/products/:id/images/ai-retouch', isAuthenticated, upload.single('image'), async (req: any, res) => {
    if (process.env.NODE_ENV === 'production' && !isProductImageStorageEnabled()) {
      return res.status(503).json({ message: 'Product image storage is unavailable. Please try again later.' });
    }
    try {
      const productId = Number(req.params.id);
      const userId = (req.user as any)?.id;
      const product = await storage.getProduct(productId);
      const vendor = await storage.getVendorByUserId(userId);
      if (!product || !vendor || vendor.status !== 'approved' || product.vendorId !== vendor.id) {
        return res.status(403).json({ message: 'You can only enhance images for your own products' });
      }
      if (!req.file?.buffer) return res.status(400).json({ message: 'Choose an image to enhance' });

      const originalUrl = await storeProductImage(req.file.buffer, 'products');
      const retouchedBuffer = await retouchProductImage(req.file.buffer, req.file.mimetype);
      const retouchedUrl = await storeProductImage(retouchedBuffer, 'products');
      const currentImages = (product.images as string[]) || [];
      await storage.updateProductImages(productId, [...currentImages, originalUrl, retouchedUrl]);
      res.json({
        originalUrl,
        retouchedUrl,
        product: await storage.getProduct(productId),
        message: 'Original and AI-retouched images were added. Review both before removing either one.',
      });
    } catch (error: any) {
      console.error('AI product image enhancement failed:', error);
      if (error instanceof R2PhotoStorageError) {
        return res.status(503).json({ message: 'Product image storage is unavailable. Your product was not changed. Please try again later.' });
      }
      const unavailable = String(error?.message || '').includes('not configured');
      res.status(unavailable ? 503 : 502).json({
        message: unavailable ? 'AI image enhancement is not configured' : 'AI could not enhance this image. Your product was not changed.',
      });
    }
  });

  app.delete('/api/products/:id', isAuthenticated, async (req: any, res) => {
    try {
      const productId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || product.vendorId !== vendor.id) {
        return res.status(403).json({ message: 'Access denied: This product does not belong to you' });
      }
      await storage.deleteProduct(productId);
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: 'Failed to delete product' });
    }
  });

  app.get('/api/admin/products/:id', isAuthenticated, productReviewHandlers.getDetails);
  app.patch('/api/admin/products/:id/status', isAuthenticated, productReviewHandlers.updateStatus);
  // Preserve existing clients while applying the same live reviewer permissions
  // and listing-quality checks as the canonical admin route.
  app.patch('/api/products/:id/status', isAuthenticated, productReviewHandlers.updateStatus);

  app.post('/api/products/:id/submit', isAuthenticated, async (req: any, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (!Number.isSafeInteger(productId)) return res.status(400).json({ message: 'Invalid product ID' });
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      const userId = (req.user as any)?.id;
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved' || product.vendorId !== vendor.id) {
        return res.status(403).json({ message: 'Approved vendor access required' });
      }
      if (!['draft', 'rejected'].includes(product.status || '')) {
        return res.status(409).json({ message: 'Only draft or rejected products can be submitted' });
      }
      await storage.updateProductStatus(productId, 'pending');
      res.json(await storage.getProduct(productId));
    } catch (error) {
      console.error('Error submitting product for review:', error);
      res.status(500).json({ message: 'Failed to submit product for review' });
    }
  });

  app.patch('/api/products/:id/featured', isAuthenticated, requireFullManagement, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { featured } = req.body;

      await storage.updateProductFeatured(productId, featured);
      res.json({ message: 'Product featured status updated' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update featured status' });
    }
  });

  // Placeholder image service
  app.get('/api/placeholder/:width/:height', (req, res) => {
    const { width, height } = req.params;
    const w = parseInt(width) || 300;
    const h = parseInt(height) || 400;
    
    // Generate SVG placeholder
    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1a5f3f"/>
        <rect x="20" y="20" width="${w-40}" height="${h-40}" fill="#d4af37" opacity="0.1"/>
        <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="16" fill="#d4af37" text-anchor="middle">Nigerian Fashion</text>
        <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="12" fill="#ffffff" text-anchor="middle">${w} × ${h}</text>
      </svg>
    `;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(svg);
  });

  // Image migration endpoint for admin use
  app.post('/api/admin/migrate-images', isAuthenticated, isAdmin, async (req, res) => {
    try {
      if (!isCloudStorageEnabled()) {
        return res.status(400).json({ 
          message: 'Cloud storage not enabled' 
        });
      }

      const { imageOptimizer } = await import('./imageOptimizer');
      await imageOptimizer.migrateLocalImagesToCloud();
      
      res.json({ 
        message: 'Image migration completed successfully' 
      });
    } catch (error) {
      console.error('Error during manual migration:', error);
      res.status(500).json({ 
        message: 'Failed to migrate images' 
      });
    }
  });

  // Test Paystack integration with payment initialization
  app.get('/api/test-paystack', async (req, res) => {
    try {
      if (!isPaystackInitialized()) {
        return res.status(500).json({ 
          status: 'error', 
          message: 'Paystack service not initialized' 
        });
      }

      // Test payment initialization with Paystack API
      const paystack = getPaystackService();
      const testReference = 'TEST_' + Date.now();
      
      const testPayment = await paystack.initializeTransaction(
        'test@example.com',
        1, // $1 in cents
        testReference,
        { test: true }
      );
      
      res.json({ 
        status: 'success', 
        message: 'Paystack service is fully functional',
        timestamp: new Date().toISOString(),
        test_payment: {
          reference: testReference,
          authorization_url: testPayment.data.authorization_url,
          access_code: testPayment.data.access_code
        }
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'error', 
        message: 'Paystack integration test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Cart routes
  // Saved delivery addresses are always scoped to the authenticated buyer.
  app.get('/api/delivery-addresses', isAuthenticated, async (req: any, res) => {
    try { res.json(await storage.getSavedDeliveryAddresses(req.user.id)); }
    catch { res.status(500).json({ message: 'Failed to fetch saved delivery addresses' }); }
  });
  app.post('/api/delivery-addresses', isAuthenticated, async (req: any, res) => {
    try {
      const body = z.object({
        label: z.string().trim().min(1).max(80).default('My address'),
        isDefault: z.boolean().optional().default(false),
        ...shippingAddressSchema.shape,
      }).parse(req.body);
      const address = await storage.createSavedDeliveryAddress({ ...body, userId: req.user.id });
      res.status(201).json(address);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid delivery address', errors: error.errors });
      res.status(500).json({ message: 'Failed to save delivery address' });
    }
  });
  app.patch('/api/delivery-addresses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id)) return res.status(400).json({ message: 'Invalid address ID' });
      const body = z.object({
        label: z.string().trim().min(1).max(80).optional(),
        isDefault: z.boolean().optional(),
        ...shippingAddressSchema.shape,
      }).partial().parse(req.body);
      const updated = await storage.updateSavedDeliveryAddress(id, req.user.id, body);
      if (!updated) return res.status(404).json({ message: 'Delivery address not found' });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid delivery address', errors: error.errors });
      res.status(500).json({ message: 'Failed to update delivery address' });
    }
  });
  app.delete('/api/delivery-addresses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id)) return res.status(400).json({ message: 'Invalid address ID' });
      if (!await storage.deleteSavedDeliveryAddress(id, req.user.id)) return res.status(404).json({ message: 'Delivery address not found' });
      res.status(204).end();
    } catch { res.status(500).json({ message: 'Failed to delete delivery address' }); }
  });

  app.post('/api/cart/restore-order/:id', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const userId = req.user.id;
      const order = await storage.getOrder(orderId);
      if (!order || order.userId !== userId) return res.status(404).json({ message: 'Order not found' });
      const items = await storage.getOrderItemsWithProducts(orderId);
      const added: any[] = [], skipped: any[] = [], adjusted: any[] = [];
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        const base = { productId: item.productId, selectedSize: item.selectedSize ?? null, quantity: item.quantity };
        if (!product || product.status !== 'approved') { skipped.push({ ...base, reason: 'product_unavailable' }); continue; }
        if (product.stock < 1) { skipped.push({ ...base, reason: 'out_of_stock' }); continue; }
        const sizes = Array.isArray(product.sizes) ? product.sizes.filter((s): s is string => typeof s === 'string') : [];
        if (sizes.length > 0 && (!item.selectedSize || !sizes.includes(item.selectedSize))) {
          skipped.push({ ...base, reason: 'size_unavailable' }); continue;
        }
        const quantity = Math.min(item.quantity, product.stock);
        const existing = (await storage.getCartItems(userId)).find(cart =>
          cart.productId === item.productId && (cart.selectedSize ?? null) === (item.selectedSize ?? null));
        const room = Math.max(0, product.stock - (existing?.quantity || 0));
        const toAdd = Math.min(quantity, room);
        if (toAdd < 1) { skipped.push({ ...base, reason: 'cart_stock_limit' }); continue; }
        try {
          await storage.addToCart({ userId, productId: item.productId, quantity: toAdd, selectedSize: item.selectedSize ?? null });
        } catch (error) {
          if (error instanceof Error && error.message === 'Requested quantity exceeds available stock') {
            skipped.push({ ...base, reason: 'cart_stock_limit' });
            continue;
          }
          throw error;
        }
        const result = { ...base, quantity: toAdd };
        (toAdd < item.quantity ? adjusted : added).push(result);
      }
      res.json({ added, adjusted, skipped });
    } catch (error) {
      console.error('Error restoring order to cart:', error);
      res.status(500).json({ message: 'Failed to restore order items' });
    }
  });

  app.post('/api/cart', checkoutAccess, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const cartItemData = insertCartItemSchema.parse({
        ...req.body,
        userId,
      });
      const quantity = cartItemData.quantity ?? 1;
      const product = await storage.getProduct(cartItemData.productId);
      if (!product || product.status !== 'approved') return res.status(404).json({ message: 'Product is not available' });
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Quantity must be a positive whole number' });
      }
      const sizes = Array.isArray(product.sizes) ? product.sizes.filter((size): size is string => typeof size === 'string') : [];
      if (sizes.length > 0 && (!cartItemData.selectedSize || !sizes.includes(cartItemData.selectedSize))) {
        return res.status(400).json({ message: 'Please select a valid size' });
      }
      const existing = (await storage.getCartItems(userId))
        .find(item => item.productId === cartItemData.productId && item.selectedSize === (cartItemData.selectedSize ?? null));
      if ((existing?.quantity || 0) + quantity > product.stock) {
        return res.status(409).json({ message: 'Requested quantity exceeds available stock' });
      }

      const cartItem = await storage.addToCart(cartItemData);
      res.json(cartItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else if (error instanceof Error && error.message === 'Requested quantity exceeds available stock') {
        res.status(409).json({ message: error.message });
      } else {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Failed to add to cart' });
      }
    }
  });

  app.get('/api/cart', checkoutAccess, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const cartItems = await storage.getCartItems(userId);
      res.json(cartItems);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch cart items' });
    }
  });

  app.patch('/api/cart/:id', checkoutAccess, async (req: any, res) => {
    try {
      const cartItemId = parseInt(req.params.id);
      const { quantity } = req.body;
      const userId = (req.user as any)?.id;
      if (!Number.isSafeInteger(cartItemId) || !Number.isSafeInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'A positive whole-number quantity is required' });
      }
      const item = findOwnedCartItem(await storage.getCartItems(userId), userId, cartItemId);
      if (!item) return res.status(404).json({ message: 'Cart item not found' });
      if (item.product.status !== 'approved' || quantity > item.product.stock) {
        return res.status(409).json({ message: 'Requested quantity is not available' });
      }
      if (!await storage.updateCartItemQuantity(cartItemId, userId, quantity)) {
        return res.status(404).json({ message: 'Cart item not found' });
      }
      res.json({ message: 'Cart item updated' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update cart item' });
    }
  });

  app.delete('/api/cart/:id', checkoutAccess, async (req: any, res) => {
    try {
      const cartItemId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      if (!Number.isSafeInteger(cartItemId)) return res.status(400).json({ message: 'Invalid cart item ID' });
      if (!await storage.removeFromCart(cartItemId, userId)) return res.status(404).json({ message: 'Cart item not found' });
      res.json({ message: 'Item removed from cart' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to remove item from cart' });
    }
  });

  app.delete('/api/cart', checkoutAccess, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      await storage.clearCart(userId);
      res.json({ message: 'Cart cleared' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to clear cart' });
    }
  });

  // Shipping quotes endpoint
  app.get('/api/shipping/quote', isAuthenticated, async (req: any, res) => {
    try {
      const cartItems = await storage.getCartItems((req.user as any)?.id);
      const subtotal = cartItems.length > 0 ? calculateCheckoutSubtotal(cartItems) : 0;
      const totalWeight = cartItems.reduce((sum, item) => sum + Number(item.product.weight || 0) * item.quantity, 0);
      const recommendation = recommendShippingCarriers({
        country: typeof req.query.country === 'string' ? req.query.country : '',
        totalWeight,
        subtotal,
      });
      const quotes = SHIPPING_QUOTES.map(quote => ({
          ...quote,
          estimatedPrice: subtotal > 0 ? calculateEstimatedShippingAmount(subtotal, quote.carrier) : null,
          currency: 'NGN',
          recommendation: recommendation.ranked.find(item => item.carrier === quote.carrier) || null,
        }));
      // Keep the historic array response contract; recommendation details are
      // available through the focused endpoint below.
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch shipping quotes' });
    }
  });

  app.get('/api/shipping/recommendation', isAuthenticated, async (req: any, res) => {
    try {
      const cartItems = await storage.getCartItems(req.user.id);
      const subtotal = cartItems.length ? calculateCheckoutSubtotal(cartItems) : 0;
      const totalWeight = cartItems.reduce((sum, item) => sum + Number(item.product.weight || 0) * item.quantity, 0);
      res.json(recommendShippingCarriers({ country: String(req.query.country || ''), subtotal, totalWeight }));
    } catch { res.status(500).json({ message: 'Failed to calculate shipping recommendation' }); }
  });

  // Buyer: request and view confirmed international shipping quotes.
  app.get('/api/shipping/quote-requests/mine', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const [requests, cartItems] = await Promise.all([
        storage.getShippingQuoteRequestsForUser(userId),
        storage.getCartItems(userId),
      ]);
      const currentCartFingerprint = cartItems.length > 0 ? createCartFingerprint(cartItems) : null;
      res.json(requests.map(request => ({
        ...request,
        cartMatches: request.cartFingerprint === currentCartFingerprint,
        status: request.status === 'quoted' && request.expiresAt && request.expiresAt <= new Date()
          ? 'expired'
          : request.status,
      })));
    } catch (error) {
      console.error('Error fetching shipping quote requests:', error);
      res.status(500).json({ message: 'Failed to fetch shipping quote requests' });
    }
  });

  app.post('/api/shipping/quote-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const input = quoteRequestSchema.parse(req.body);
      const shippingOption = getShippingQuote(input.carrier);
      if (!shippingOption) {
        return res.status(404).json({ message: 'Shipping company not found' });
      }

      const cartItems = await storage.getCartItems(userId);
      if (cartItems.length === 0) return res.status(400).json({ message: 'Your cart is empty' });
      try {
        calculateCheckoutSubtotal(cartItems);
      } catch (error) {
        if (error instanceof CheckoutValidationError) return res.status(409).json({ message: error.message });
        throw error;
      }

      const cartFingerprint = createCartFingerprint(cartItems);
      const existing = (await storage.getShippingQuoteRequestsForUser(userId)).find(request =>
        request.carrier.toLowerCase() === shippingOption.carrier.toLowerCase()
        && request.cartFingerprint === cartFingerprint
        && addressesMatch(request.shippingAddress, input.shippingAddress)
        && (request.status === 'pending'
          || (request.status === 'quoted' && !!request.expiresAt && request.expiresAt > new Date()))
      );
      if (existing) return res.status(200).json(existing);

      const cartSnapshot = cartItems.map(item => ({
        productId: item.productId,
        name: item.product.name,
        quantity: item.quantity,
        selectedSize: item.selectedSize ?? null,
        unitPrice: item.product.price,
        weight: item.product.weight ?? null,
      }));
      const totalWeight = cartItems.reduce((sum, item) => {
        const weight = Number(item.product.weight || 0);
        return sum + (Number.isFinite(weight) ? weight * item.quantity : 0);
      }, 0);
      const request = await storage.createShippingQuoteRequest({
        userId,
        carrier: shippingOption.carrier,
        status: 'pending',
        shippingAddress: input.shippingAddress,
        cartSnapshot,
        cartFingerprint,
        totalWeight: totalWeight.toFixed(2),
        currency: 'NGN',
      });

      const buyer = await storage.getUser(userId);
      const admins = await storage.getAdminUsers();
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          type: 'shipping_quote',
          title: 'New shipping quote request',
          message: `${buyer?.firstName || buyer?.email || 'A buyer'} requested a ${shippingOption.carrier} quote to ${input.shippingAddress.country}.`,
        });
      }

      res.status(201).json(request);
    } catch (error) {
      console.error('Error creating shipping quote request:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Select a carrier and provide a complete shipping address' });
      res.status(500).json({ message: 'Failed to request shipping quote' });
    }
  });

  app.post('/api/orders/:id/shipping-quote/retry', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const userId = (req.user as any)?.id;
      if (!Number.isSafeInteger(orderId) || orderId <= 0) return res.status(400).json({ message: 'Invalid order ID' });

      const order = await storage.getOrder(orderId);
      if (!order || order.userId !== userId) return res.status(404).json({ message: 'Order not found' });
      if (order.paymentStatus !== 'paid' || order.shippingPaymentStatus !== 'rejected' || order.orderStatus !== 'awaiting_shipping_quote') {
        return res.status(409).json({ message: 'This order is not waiting for a replacement shipping quote' });
      }
      if (!order.shippingQuoteRequestId) return res.status(409).json({ message: 'Original shipping quote request not found' });
      const originalRequest = await storage.getShippingQuoteRequest(order.shippingQuoteRequestId);
      if (!originalRequest) return res.status(409).json({ message: 'Original shipping quote request not found' });

      const currentIndex = SHIPPING_QUOTES.findIndex(option => option.carrier.toLowerCase() === String(order.shippingMethod || '').toLowerCase());
      const requestedCarrier = typeof req.body?.carrier === 'string' ? req.body.carrier : '';
      const replacementOption = getShippingQuote(requestedCarrier)
        || SHIPPING_QUOTES[(currentIndex + 1 + SHIPPING_QUOTES.length) % SHIPPING_QUOTES.length];
      if (!replacementOption) return res.status(400).json({ message: 'Choose a supported shipping company' });
      const shippingAddress = shippingAddressSchema.parse(order.shippingAddress);

      const replacement = await db.transaction(async tx => {
        if (!Array.isArray(originalRequest.cartSnapshot)) throw new Error('Invalid shipping quote cart');
        await lockApprovedProductReferences(tx, originalRequest.cartSnapshot.map((item: any) => item?.productId));
        const [request] = await tx.insert(shippingQuoteRequests).values({
          userId,
          carrier: replacementOption.carrier,
          status: 'pending',
          shippingAddress,
          cartSnapshot: originalRequest.cartSnapshot,
          cartFingerprint: originalRequest.cartFingerprint,
          totalWeight: originalRequest.totalWeight,
          currency: 'NGN',
        }).returning();
        const [updatedOrder] = await tx.update(orders).set({
          shippingQuoteRequestId: request.id,
          shippingMethod: replacementOption.carrier.toLowerCase(),
          shippingPaymentStatus: 'awaiting_quote',
          shippingFinalAmount: null,
          shippingPaymentReference: null,
          shippingPaymentUrl: null,
          updatedAt: new Date(),
        }).where(and(
          eq(orders.id, orderId),
          eq(orders.userId, userId),
          eq(orders.paymentStatus, 'paid'),
          eq(orders.shippingPaymentStatus, 'rejected'),
          eq(orders.orderStatus, 'awaiting_shipping_quote'),
        )).returning({ id: orders.id });
        if (!updatedOrder) throw new Error('ORDER_NOT_RETRYABLE');
        return request;
      });

      const buyer = await storage.getUser(userId);
      for (const admin of await storage.getAdminUsers()) {
        await storage.createNotification({
          userId: admin.id,
          type: 'shipping_quote',
          title: 'Replacement shipping quote requested',
          message: `${buyer?.firstName || buyer?.email || 'A buyer'} requested a replacement ${replacement.carrier} quote for order #${orderId}.`,
          orderId,
        });
      }
      res.status(201).json(replacement);
    } catch (error) {
      console.error('Error retrying shipping quote:', error);
      if (error instanceof z.ZodError) return res.status(409).json({ message: 'The saved shipping address is incomplete' });
      if (error instanceof Error && error.message === 'ORDER_NOT_RETRYABLE') {
        return res.status(409).json({ message: 'A replacement quote has already been requested' });
      }
      res.status(500).json({ message: 'Failed to request a replacement shipping quote' });
    }
  });

  // Admin: review all requests and confirm or reject rates.
  app.get('/api/admin/shipping-quote-requests', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const requests = await storage.getAllShippingQuoteRequests();
      const enriched = await Promise.all(requests.map(async request => ({
        ...request,
        status: request.status === 'quoted' && request.expiresAt && request.expiresAt <= new Date()
          ? 'expired'
          : request.status,
        customer: await storage.getUser(request.userId).then(account => account ? {
          id: account.id, firstName: account.firstName, lastName: account.lastName,
          email: account.email, phone: account.phone,
        } : null),
      })));
      res.json(enriched);
    } catch (error) {
      console.error('Error fetching admin shipping quotes:', error);
      res.status(500).json({ message: 'Failed to fetch shipping quote requests' });
    }
  });

  app.patch('/api/admin/shipping-quote-requests/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    let quoteDecisionClaim: { id: number; originalStatus: string } | undefined;
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id)) return res.status(400).json({ message: 'Invalid quote request ID' });
      const existing = await storage.getShippingQuoteRequest(id);
      if (!existing) return res.status(404).json({ message: 'Shipping quote request not found' });
      const linkedOrder = await storage.getOrderByShippingQuoteRequestId(id);
      const canRecoverRefund = existing.status === 'reconciling'
        && !!linkedOrder?.shippingRefundStatus
        && Number(linkedOrder.shippingRefundAmount || 0) > 0;
      if (existing.status === 'reconciling' && !canRecoverRefund) {
        const staleBefore = Date.now() - 5 * 60 * 1000;
        if (existing.updatedAt && existing.updatedAt.getTime() < staleBefore) {
          await storage.releaseShippingQuoteDecision(id, existing.quotedAmount ? 'quoted' : 'pending');
          return res.status(409).json({ message: 'A stale shipping reconciliation was reset. Refresh and submit the decision again.' });
        }
        return res.status(409).json({ message: 'This shipping price is currently being reconciled. Please retry shortly.' });
      }
      const canReplaceExpiredBalance = existing.status === 'quoted'
        && linkedOrder?.shippingPaymentStatus === 'pending'
        && !linkedOrder.shippingPaymentReference
        && !!existing.expiresAt
        && existing.expiresAt <= new Date();
      if (existing.status !== 'pending' && !canReplaceExpiredBalance && !canRecoverRefund) {
        return res.status(409).json({ message: 'Only pending requests or unpaid expired balances can be reviewed' });
      }

      const decision = quoteDecisionSchema.parse(req.body);
      if (canRecoverRefund) {
        if (decision.status !== 'quoted'
          || Number(linkedOrder?.shippingFinalAmount) !== decision.quotedAmount
          || Number(linkedOrder?.shippingRefundAmount) <= 0) {
          return res.status(409).json({ message: 'Retry the same shipping price to resume the existing refund reconciliation' });
        }
      } else {
        if (!await storage.claimShippingQuoteDecision(id, existing.status)) {
          return res.status(409).json({ message: 'This quote changed or a shipping payment has started. Refresh before trying again.' });
        }
        quoteDecisionClaim = { id, originalStatus: existing.status };
      }
      const adminId = (req.user as any)?.id;
      let refundAmount = 0;
      let refundStatus: string | undefined;
      if (decision.status === 'quoted' && linkedOrder) {
        const deposit = Number(linkedOrder.shippingEstimatedAmount
          ?? (linkedOrder.shippingPaymentStatus === 'included' ? linkedOrder.shippingAmount : 0));
        refundAmount = Math.max(0, deposit - decision.quotedAmount);
        if (refundAmount > 0) {
          if (linkedOrder.paymentStatus !== 'paid' || !linkedOrder.paymentReference) {
            if (quoteDecisionClaim) await storage.releaseShippingQuoteDecision(id, existing.status);
            quoteDecisionClaim = undefined;
            return res.status(409).json({ message: 'Wait for the buyer payment to be confirmed before approving a lower final shipping price' });
          }
          const claimed = await storage.claimShippingRefund(
            linkedOrder.id,
            decision.quotedAmount.toFixed(2),
            refundAmount.toFixed(2),
          );
          if (!claimed) {
            const current = await storage.getOrder(linkedOrder.id);
            const sameReconciliation = Number(current?.shippingFinalAmount) === decision.quotedAmount
              && Number(current?.shippingRefundAmount) === refundAmount;
            if (!sameReconciliation || !current?.shippingRefundStatus) {
              if (quoteDecisionClaim) await storage.releaseShippingQuoteDecision(id, existing.status);
              quoteDecisionClaim = undefined;
              return res.status(409).json({ message: 'A different shipping adjustment is already being processed' });
            }
            if (current.shippingRefundStatus === 'processing') {
              const existingRefund = await getPaystackService().findRefund(linkedOrder.paymentReference, refundAmount);
              if (!existingRefund) {
                return res.status(409).json({ message: 'The shipping refund is still being processed. Please retry shortly.' });
              }
              refundStatus = String(existingRefund.status || 'pending');
              await storage.completeShippingRefundClaim(linkedOrder.id, refundStatus);
              await notifyOrderPayment(linkedOrder.id, 'shipping-refund');
            } else {
              refundStatus = current.shippingRefundStatus;
            }
          } else {
            quoteDecisionClaim = undefined;
            let refund;
            try {
              refund = await getPaystackService().createRefund(
                linkedOrder.paymentReference,
                refundAmount,
                `Shipping estimate adjustment for order #${linkedOrder.id}`,
              );
              if (!refund?.status) throw new Error('Paystack did not accept the shipping adjustment refund');
            } catch (error) {
              throw error;
            }
            refundStatus = String(refund.data?.status || 'pending');
            await storage.completeShippingRefundClaim(linkedOrder.id, refundStatus);
            await notifyOrderPayment(linkedOrder.id, 'shipping-refund');
          }
        }
      }
      const updated = decision.status === 'quoted'
        ? await storage.updateShippingQuoteRequest(id, {
            status: 'quoted',
            quotedAmount: decision.quotedAmount.toFixed(2),
            currency: 'NGN',
            estimatedDelivery: decision.estimatedDelivery,
            adminNotes: decision.adminNotes || null,
            confirmedBy: adminId,
            expiresAt: new Date(Date.now() + decision.validDays * 24 * 60 * 60 * 1000),
          })
        : await storage.updateShippingQuoteRequest(id, {
            status: 'rejected',
            adminNotes: decision.adminNotes,
            confirmedBy: adminId,
            expiresAt: null,
          });
      quoteDecisionClaim = undefined;

      if (linkedOrder) {
        const amountAlreadyCollected = Number(linkedOrder.shippingEstimatedAmount
          ?? (linkedOrder.shippingPaymentStatus === 'included' ? linkedOrder.shippingAmount : 0));
        const balanceDue = decision.status === 'quoted'
          ? Math.max(0, decision.quotedAmount - amountAlreadyCollected)
          : 0;
        const reconciledOrder = await storage.updateOrderShippingQuote(
          id,
          balanceDue.toFixed(2),
          decision.status === 'quoted'
            ? balanceDue > 0 ? 'pending' : 'included'
            : 'rejected',
          decision.status === 'quoted' && balanceDue === 0
            ? 'pending'
            : 'awaiting_shipping_quote',
          decision.status === 'quoted'
            ? {
                finalAmount: decision.quotedAmount.toFixed(2),
                refundAmount: refundAmount.toFixed(2),
                refundStatus: refundAmount > 0 ? refundStatus || 'pending' : 'not_required',
              }
            : undefined,
        );
        if (!reconciledOrder) {
          quoteDecisionClaim = undefined;
          return res.status(409).json({ message: 'The order was cancelled while the shipping price was being reconciled' });
        }
        if (decision.status === 'quoted' && balanceDue === 0 && await canAutomaticallyProcessOrder(linkedOrder.id)) {
          await storage.updateOrderStatus(linkedOrder.id, 'processing');
        }
      }

      await storage.createNotification({
        userId: existing.userId,
        type: 'shipping_quote',
        title: decision.status === 'quoted' ? `${existing.carrier} shipping quote ready` : `${existing.carrier} quote update`,
        message: decision.status === 'quoted'
          ? linkedOrder
            ? (() => {
                const collected = Number(linkedOrder.shippingEstimatedAmount
                  ?? (linkedOrder.shippingPaymentStatus === 'included' ? linkedOrder.shippingAmount : 0));
                const balance = Math.max(0, decision.quotedAmount - collected);
                const refund = Math.max(0, collected - decision.quotedAmount);
                if (refund > 0) {
                  return `Your final ${existing.carrier} shipping price for order #${linkedOrder.id} is ₦${decision.quotedAmount.toLocaleString()}. A ₦${refund.toLocaleString()} refund for the unused estimate has been queued to your original payment method.`;
                }
                return balance > 0
                  ? `Your final ${existing.carrier} shipping price for order #${linkedOrder.id} is ₦${decision.quotedAmount.toLocaleString()}. Your estimate has been credited; pay the ₦${balance.toLocaleString()} balance from My Orders.`
                  : `Your final ${existing.carrier} shipping price for order #${linkedOrder.id} is covered by the estimate already paid. Your order can move to fulfillment.`;
              })()
            : `Your shipping quote is ₦${decision.quotedAmount.toLocaleString()} and is valid for ${decision.validDays} day${decision.validDays === 1 ? '' : 's'}. Return to checkout to pay.`
          : `We could not confirm this shipping route. ${decision.adminNotes}`,
        ...(linkedOrder ? { orderId: linkedOrder.id } : {}),
      });
      res.json(updated);
    } catch (error) {
      if (quoteDecisionClaim) {
        await storage.releaseShippingQuoteDecision(quoteDecisionClaim.id, quoteDecisionClaim.originalStatus)
          .catch(releaseError => console.error('Failed to release shipping quote decision claim:', releaseError));
      }
      console.error('Error reviewing shipping quote:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Enter a valid NGN amount, delivery estimate, and validity period' });
      res.status(500).json({ message: 'Failed to update shipping quote request' });
    }
  });

  // Initialize Paystack payment
  // Read-only pricing: cart, shipping and payable NGN total come from the
  // server. This does not create an order or contact the payment provider.
  app.post('/api/orders/preview-total', isAuthenticated, requestRateLimit("checkout-pricing", 60, 60), async (req: any, res) => {
    try {
      const address = shippingAddressSchema.parse(req.body.shippingAddress);
      const carrier = getShippingQuote(req.body.shippingMethod);
      if (!carrier) return res.status(400).json({ message: "Choose a valid shipping method." });
      const cart = await storage.getCartItems(req.user.id);
      if (!cart.length) return res.status(400).json({ message: "Your cart is empty." });
      const subtotal = calculateCheckoutSubtotal(cart);
      let shippingAmount: number | null = carrier.price;
      let estimated = false;
      if (carrier.quoteRequired || shippingAmount === null) {
        const requests = await storage.getShippingQuoteRequestsForUser(req.user.id);
        const matches = (quote: any) => quote.carrier.toLowerCase() === carrier.carrier.toLowerCase()
          && quote.cartFingerprint === createCartFingerprint(cart) && addressesMatch(quote.shippingAddress, address);
        const quote = req.body.shippingQuoteId
          ? requests.find(item => item.id === Number(req.body.shippingQuoteId))
          : requests.find(item => matches(item) && item.status === "quoted" && item.expiresAt && item.expiresAt > new Date());
        if (quote && (!matches(quote) || !["pending", "quoted"].includes(quote.status))) {
          return res.status(409).json({ message: "Your quote no longer matches this checkout. Request a new shipping quote." });
        }
        if (quote?.status === "quoted") {
          if (!quote.expiresAt || quote.expiresAt <= new Date() || quote.currency !== "NGN") {
            return res.status(409).json({ message: "Your shipping quote expired. Request a new quote." });
          }
          shippingAmount = Number(quote.quotedAmount);
          if (!Number.isFinite(shippingAmount) || shippingAmount <= 0) {
            return res.status(409).json({ message: "The confirmed shipping amount is invalid. Request a new quote." });
          }
        } else {
          if (req.body.shippingQuoteId && !quote) return res.status(409).json({ message: "Shipping quote unavailable." });
          shippingAmount = calculateEstimatedShippingAmount(subtotal, carrier.carrier);
          estimated = true;
        }
      }
      const totalAmount = checkoutTotal(subtotal, Number(shippingAmount));
      res.set("Cache-Control", "no-store");
      res.json({ subtotal, shippingAmount, totalAmount, currency: "NGN", estimated });
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof CheckoutValidationError) {
        return res.status(400).json({ message: "Check your cart and complete the shipping address." });
      }
      res.status(503).json({ message: "The checkout total could not be calculated. Please retry." });
    }
  });

  app.post('/api/orders/initialize-payment', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const shippingAddress = shippingAddressSchema.parse(req.body.shippingAddress);
      const checkoutRequestId = z.string().trim().min(12).max(100)
        .regex(/^[A-Za-z0-9_-]+$/)
        .parse(req.body.checkoutRequestId);
      const shippingMethod = typeof req.body.shippingMethod === 'string' ? req.body.shippingMethod.toLowerCase() : '';
      const shippingQuote = getShippingQuote(shippingMethod);
      if (!shippingQuote) return res.status(400).json({ message: 'Invalid shipping method' });
      if (!isPaystackInitialized()) {
        return res.status(503).json({ message: 'Payment service not configured. Please contact administrator.' });
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(400).json({ message: 'User email required for payment' });
      }
      const [existingCheckout] = await db.select().from(orders).where(and(
        eq(orders.userId, userId),
        eq(orders.checkoutRequestId, checkoutRequestId),
      ));
      if (!existingCheckout) return res.status(410).json({message:"New orders require live, fully priced shipping. Return to checkout to fetch delivery services."});
      if (existingCheckout) {
        if (unpaidCheckoutExpired(existingCheckout)) {
          if (!await unpaidCheckoutCanClose(existingCheckout, completeVerifiedOrder)) {
            return res.status(409).json({ message: 'Payment status is being checked. Do not pay again. Check My Orders.' });
          }
          if (await closeUnpaidCheckout(existingCheckout.id, userId, "expired", new Date(Date.now() - 24 * 60 * 60 * 1000))) {
            await notifyOrderClosure(existingCheckout.id, "expired");
          }
          return res.status(409).json({ message: 'This unpaid checkout expired. Start a new checkout from your saved cart.' });
        }
        if (existingCheckout.paymentStatus !== 'pending' || !existingCheckout.paymentReference
          || ['cancelled', 'expired', 'payment_review'].includes(existingCheckout.orderStatus || '')) {
          return res.status(409).json({ message: 'This checkout request has already been completed or closed' });
        }
        if (req.body.expectedTotalAmount !== undefined
          && Math.round(Number(req.body.expectedTotalAmount) * 100) !== Math.round(Number(existingCheckout.totalAmount) * 100)) {
          return res.status(409).json({ message: 'The checkout price changed. Review the refreshed server total before paying.' });
        }
        if (existingCheckout.paymentUrl) {
          return res.json({
            order: existingCheckout,
            paymentUrl: existingCheckout.paymentUrl,
            reference: existingCheckout.paymentReference,
            awaitingShippingQuote: existingCheckout.orderStatus === 'awaiting_shipping_quote',
            estimatedShipping: !!existingCheckout.shippingEstimatedAmount,
          });
        }
        const retryData = await getPaystackService().initializeTransaction(
          user.email,
          Number(existingCheckout.totalAmount),
          existingCheckout.paymentReference,
          {
            orderId: existingCheckout.id,
            userId,
            shippingMethod: existingCheckout.shippingMethod,
            ...(existingCheckout.shippingQuoteRequestId ? { shippingQuoteId: existingCheckout.shippingQuoteRequestId } : {}),
          },
          `${req.protocol}://${req.get('host')}/api/payment/callback`,
          'NGN',
        );
        if (!retryData?.data?.authorization_url) throw new Error('Payment provider did not return a checkout URL');
        await db.update(orders).set({
          paymentUrl: retryData.data.authorization_url,
          updatedAt: new Date(),
        }).where(and(
          eq(orders.id, existingCheckout.id),
          eq(orders.paymentStatus, 'pending'),
        ));
        return res.json({
          order: existingCheckout,
          paymentUrl: retryData.data.authorization_url,
          reference: existingCheckout.paymentReference,
          awaitingShippingQuote: existingCheckout.orderStatus === 'awaiting_shipping_quote',
          estimatedShipping: !!existingCheckout.shippingEstimatedAmount,
        });
      }

      const cartItems = await storage.getCartItems(userId);
      if (cartItems.length === 0) return res.status(400).json({ message: 'Your cart is empty' });
      let subtotal: number;
      let shippingPrice: number;
      let shippingQuoteRequestId: number | undefined;
      let quotePending = false;
      try {
        subtotal = calculateCheckoutSubtotal(cartItems);
        if (shippingQuote.quoteRequired || shippingQuote.price === null) {
          shippingQuoteRequestId = Number(req.body.shippingQuoteId);
          if (!Number.isSafeInteger(shippingQuoteRequestId)) {
            const existingRequests = await storage.getShippingQuoteRequestsForUser(userId);
            const cartFingerprint = createCartFingerprint(cartItems);
            // Prefer a confirmed, unexpired quote. This makes returning buyers
            // fast while still binding the quote to the exact cart/address.
            const reusableConfirmed = existingRequests.find(request =>
              request.carrier.toLowerCase() === shippingMethod
              && request.status === 'quoted'
              && !!request.expiresAt && request.expiresAt > new Date()
              && request.cartFingerprint === cartFingerprint
              && addressesMatch(request.shippingAddress, shippingAddress)
            );
            const reusable = reusableConfirmed || existingRequests.find(request =>
              request.carrier.toLowerCase() === shippingMethod
              && request.status === 'pending'
              && request.cartFingerprint === cartFingerprint
              && addressesMatch(request.shippingAddress, shippingAddress)
            );
            const request = reusable || await storage.createShippingQuoteRequest({
              userId,
              carrier: shippingQuote.carrier,
              status: 'pending',
              shippingAddress,
              cartSnapshot: cartItems.map(item => ({
                productId: item.productId,
                name: item.product.name,
                quantity: item.quantity,
                selectedSize: item.selectedSize ?? null,
                unitPrice: Number(item.product.price).toFixed(2),
                weight: item.product.weight ?? null,
              })),
              cartFingerprint,
              totalWeight: cartItems.reduce((sum, item) => sum + Number(item.product.weight || 0) * item.quantity, 0).toFixed(2),
              currency: 'NGN',
            });
            shippingQuoteRequestId = request.id;
            if (!reusable) {
              const admins = await storage.getAdminUsers();
              await Promise.all(admins.map(admin =>
                storage.createNotification({
                  userId: admin.id,
                  type: 'shipping_quote',
                  title: 'New shipping quote request',
                  message: `${user.firstName || user.email || 'A buyer'} placed an order using an estimated ${shippingQuote.carrier} shipping price. Confirm the final rate.`,
                })
              ));
            }
          }
          const confirmed = await storage.getShippingQuoteRequest(shippingQuoteRequestId);
          if (!confirmed || confirmed.userId !== userId || confirmed.carrier.toLowerCase() !== shippingMethod) {
            return res.status(404).json({ message: 'Confirmed shipping quote not found' });
          }
          if (confirmed.cartFingerprint !== createCartFingerprint(cartItems)) {
            return res.status(409).json({ message: 'Your cart changed after this quote was requested. Please request a new quote.' });
          }
          if (!addressesMatch(confirmed.shippingAddress, shippingAddress)) {
            return res.status(409).json({ message: 'Your shipping address changed after this quote was requested. Please request a new quote.' });
          }
          if (confirmed.status === 'pending') {
            quotePending = true;
            shippingPrice = calculateEstimatedShippingAmount(subtotal, shippingMethod);
          } else if (confirmed.status === 'quoted' && confirmed.quotedAmount && confirmed.expiresAt && confirmed.expiresAt > new Date()) {
            if (confirmed.currency !== 'NGN') return res.status(409).json({ message: 'Shipping quote currency must be NGN' });
            shippingPrice = Number(confirmed.quotedAmount);
            if (!Number.isFinite(shippingPrice) || shippingPrice <= 0) throw new CheckoutValidationError('Shipping quote has an invalid amount');
          } else {
            return res.status(409).json({ message: 'This shipping quote is unavailable or has expired' });
          }
        } else {
          shippingPrice = shippingQuote.price;
        }
      } catch (error) {
        if (error instanceof CheckoutValidationError) return res.status(409).json({ message: error.message });
        throw error;
      }
      const totalAmount = checkoutTotal(subtotal, shippingPrice);
      if (req.body.expectedTotalAmount !== undefined
        && Math.round(Number(req.body.expectedTotalAmount) * 100) !== Math.round(totalAmount * 100)) {
        return res.status(409).json({ message: "The checkout price changed. Review the refreshed server total before paying." });
      }

      const reference = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Create order with pending payment (total stored in NGN)
      const orderData = {
        userId,
        totalAmount: totalAmount.toFixed(2),
        shippingAmount: shippingPrice.toFixed(2),
        shippingEstimatedAmount: quotePending ? shippingPrice.toFixed(2) : null,
        shippingAddress,
        shippingMethod,
        paymentStatus: 'pending',
        orderStatus: quotePending ? 'awaiting_shipping_quote' : 'pending',
        shippingPaymentStatus: quotePending ? 'awaiting_quote' : 'included',
        paymentReference: reference,
        checkoutRequestId,
      };

      const orderItemData = cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        priceAtTime: item.product.price,
        selectedSize: item.selectedSize ?? null,
      }));
      const order = shippingQuoteRequestId
        ? quotePending
          ? await storage.createOrderAwaitingShippingQuote(orderData, shippingQuoteRequestId, userId, orderItemData)
          : await storage.createOrderWithReservedShippingQuote(orderData, shippingQuoteRequestId, userId, orderItemData)
        : await storage.createOrderWithItems(orderData, orderItemData);
      if (!order) {
        return res.status(409).json({ message: 'This shipping quote has already been used or has expired. Please request a new quote.' });
      }

      // Initialize Paystack payment in buyer's currency
      const paystack = getPaystackService();
      const callbackUrl = `${req.protocol}://${req.get('host')}/api/payment/callback`;

      const metadata = {
        orderId: order.id,
        userId,
        shippingMethod,
        ...(shippingQuoteRequestId ? { shippingQuoteId: shippingQuoteRequestId } : {}),
        custom_fields: [
          { display_name: 'Order ID', variable_name: 'order_id', value: order.id.toString() },
        ],
      };

      let paymentData;
      let providerAcceptedPayment = false;
      try {
        paymentData = await paystack.initializeTransaction(
          user.email, totalAmount, reference,
          metadata, callbackUrl, 'NGN'
        );
        if (!paymentData?.data?.authorization_url) throw new Error('Payment provider did not return a checkout URL');
        providerAcceptedPayment = true;
        await db.update(orders).set({
          paymentUrl: paymentData.data.authorization_url,
          updatedAt: new Date(),
        }).where(and(eq(orders.id, order.id), eq(orders.paymentStatus, 'pending')));
      } catch (error) {
        const outcomeUnknown = error instanceof PaystackRequestError && error.ambiguous;
        if (shippingQuoteRequestId && !providerAcceptedPayment && !outcomeUnknown) {
          await storage.releaseReservedShippingQuoteOrder(order.id, shippingQuoteRequestId, userId);
        }
        throw error;
      }
      if (shippingQuoteRequestId && !quotePending) {
        await storage.updateShippingQuoteRequest(shippingQuoteRequestId, { status: 'used' });
      }

      res.json({
        order,
        paymentUrl: paymentData.data.authorization_url,
        reference: paymentData.data.reference,
        awaitingShippingQuote: quotePending,
        estimatedShipping: quotePending,
      });
    } catch (error) {
      console.error('Error initializing payment:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'A complete, valid shipping address is required' });
      res.status(500).json({ message: 'Failed to initialize payment. Please try again.' });
    }
  });

  // Payment verification and completion endpoint
  app.post('/api/orders/verify-payment', checkoutAccess, async (req: any, res) => {
    try {
      const { reference } = req.body;
      const userId = (req.user as any)?.id;
      if (typeof reference !== 'string' || !/^[A-Za-z0-9._-]{3,100}$/.test(reference)) {
        return res.status(400).json({ message: 'A valid payment reference is required' });
      }

      if (!isPaystackInitialized()) {
        return res.status(503).json({ message: 'Payment service not configured' });
      }

      const userOrders = await storage.getOrdersForUser(userId);
      const order = userOrders.find(o => o.paymentReference === reference);

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const verificationResult = await getPaystackService().verifyTransaction(reference);
      const mismatch = paymentVerificationError(order, verificationResult, reference);
      if (mismatch) return res.status(400).json({ message: mismatch });
      const newlyCompleted = await completeVerifiedOrder(order, reference);
      const confirmedOrder = await storage.getOrder(order.id);
      const needsReview = confirmedOrder?.orderStatus === "payment_review";

      res.json({ 
        success: true, 
        orderId: order.id,
        alreadyProcessed: !newlyCompleted,
        needsReview,
        message: needsReview ? 'Payment received after checkout closed. Afrolandx must review it before fulfillment.' : 'Payment verified and order confirmed',
      });
    } catch (error) {
      console.error('Error verifying payment:', error);
      res.status(500).json({ message: 'Failed to verify payment' });
    }
  });

  app.post('/api/orders/:id/initialize-shipping-payment', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const userId = (req.user as any)?.id;
      if (!Number.isSafeInteger(orderId)) return res.status(400).json({ message: 'Invalid order ID' });
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured' });

      const [order, user] = await Promise.all([storage.getOrder(orderId), storage.getUser(userId)]);
      if (!order || order.userId !== userId) return res.status(404).json({ message: 'Order not found' });
      if (!user?.email) return res.status(400).json({ message: 'User email required for payment' });
      if (order.paymentStatus !== 'paid') return res.status(409).json({ message: 'Pay for the order items before paying shipping' });
      if (order.shippingPaymentStatus !== 'pending') {
        return res.status(409).json({ message: order.shippingPaymentStatus === 'paid' ? 'Shipping is already paid' : 'Shipping quote is not ready for payment' });
      }
      if (!order.shippingQuoteRequestId) return res.status(409).json({ message: 'Shipping quote is missing' });

      const quote = await storage.getShippingQuoteRequest(order.shippingQuoteRequestId);
      if (!quote || quote.status !== 'quoted' || !quote.expiresAt || quote.expiresAt <= new Date()) {
        return res.status(409).json({ message: 'Shipping quote has expired. Please contact Afrolandx for an updated quote.' });
      }
      const shippingAmount = Number(order.shippingAmount);
      const finalQuotedAmount = Number(quote.quotedAmount);
      if (!Number.isFinite(shippingAmount) || shippingAmount <= 0 || !Number.isFinite(finalQuotedAmount) || shippingAmount > finalQuotedAmount) {
        return res.status(409).json({ message: 'Shipping balance does not match the confirmed quote' });
      }

      if (order.shippingPaymentReference) {
        if (order.shippingPaymentUrl) {
          return res.json({ paymentUrl: order.shippingPaymentUrl, reference: order.shippingPaymentReference, reused: true });
        }
        return res.status(409).json({ message: 'Shipping payment is already being prepared. Please try again shortly.' });
      }

      const reference = `shipping_${order.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const claim = await storage.claimShippingPaymentReference(order.id, userId, reference);
      if (claim !== 'claimed') {
        const current = await storage.getOrder(order.id);
        if (claim === 'busy' && current?.shippingPaymentUrl && current.shippingPaymentReference) {
          return res.json({ paymentUrl: current.shippingPaymentUrl, reference: current.shippingPaymentReference, reused: true });
        }
        return res.status(409).json({ message: 'Shipping payment is no longer available' });
      }

      try {
        const callbackUrl = `${req.protocol}://${req.get('host')}/api/payment/callback`;
        const paymentData = await getPaystackService().initializeTransaction(
          user.email,
          shippingAmount,
          reference,
          { orderId: order.id, userId, paymentType: 'shipping', shippingQuoteId: quote.id },
          callbackUrl,
          'NGN',
        );
        if (!paymentData?.data?.authorization_url) throw new Error('Payment provider did not return a checkout URL');
        await storage.saveShippingPaymentUrl(order.id, reference, paymentData.data.authorization_url);
        res.json({ paymentUrl: paymentData.data.authorization_url, reference: paymentData.data.reference });
      } catch (error) {
        await storage.clearShippingPaymentAttempt(order.id, userId, reference);
        throw error;
      }
    } catch (error) {
      console.error('Error initializing shipping payment:', error);
      res.status(500).json({ message: 'Failed to initialize shipping payment. Please try again.' });
    }
  });

  // Payment callback endpoint for Paystack redirects
  app.get('/api/payment/callback', async (req, res) => {
    try {
      const { reference, trxref } = req.query;
      const paymentReference = reference || trxref;

      if (typeof paymentReference !== 'string' || !/^[A-Za-z0-9._-]{3,100}$/.test(paymentReference)) {
        return res.redirect('/checkout?error=missing_reference');
      }

      if (!isPaystackInitialized()) {
        return res.redirect('/checkout?error=payment_service_unavailable');
      }

      // Verify payment with Paystack
      const paystack = getPaystackService();
      const verificationResult = await paystack.verifyTransaction(paymentReference as string);

      const orderId = Number(verificationResult.data.metadata?.orderId);
      if (!Number.isSafeInteger(orderId)) {
        return res.redirect('/checkout?error=order_not_found');
      }
      const order = await storage.getOrder(orderId);
      if (!order) return res.redirect('/checkout?error=order_not_found');
      if (verificationResult.data.metadata?.paymentType === 'shipping') {
        if (!await completeVerifiedShippingPayment(order, verificationResult, paymentReference)) {
          return res.redirect('/my-orders?shipping=failed');
        }
        return res.redirect(`/my-orders?shipping=success&orderId=${order.id}`);
      }
      const mismatch = paymentVerificationError(order, verificationResult, paymentReference);
      if (mismatch) return res.redirect('/checkout?error=payment_verification_failed');
      await completeVerifiedOrder(order, paymentReference);
      if ((await storage.getOrder(order.id))?.orderStatus === "payment_review") {
        return res.redirect("/my-orders?payment=review");
      }

      // Redirect to order success page after payment
      res.redirect(`/order-success?order_id=${orderId}&reference=${encodeURIComponent(paymentReference)}`);
    } catch (error) {
      console.error('Error processing payment callback:', error);
      res.redirect('/checkout?error=processing_failed');
    }
  });

  // Update order status (vendor only)
  app.patch('/api/orders/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      const trackingNumber = status === 'shipped'
        ? z.string().trim().min(3).max(120).parse(req.body.trackingNumber)
        : undefined;
      const userId = (req.user as any)?.id;

      const vendorAllowedStatuses = ['processing', 'shipped', 'delivered'];
      if (!status || !vendorAllowedStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Allowed values: ${vendorAllowedStatuses.join(', ')}` });
      }

      // Verify vendor owns products in this order
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      const [managedShipment] = await db.select({ id: shipments.id }).from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
      if (managedShipment && ['shipped', 'delivered'].includes(status)) {
        return res.status(409).json({ message: 'Use Shipping to mark your package ready. Only the assigned partner or an admin can confirm collection and delivery.' });
      }

      const orderItems = await storage.getOrderItemsWithProducts(orderId);
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor || vendor.status !== 'approved') {
        return res.status(403).json({ message: 'Access denied: Approved vendor account required' });
      }
      if (order.paymentStatus !== 'paid') return res.status(409).json({ message: 'Order payment has not been confirmed' });
      if (['cancelled', 'expired', 'payment_review'].includes(order.orderStatus || '')) {
        return res.status(409).json({ message: 'This checkout is closed or requires Afrolandx payment review before fulfillment.' });
      }
      if (!['included', 'paid'].includes(order.shippingPaymentStatus)) {
        return res.status(409).json({ message: 'Shipping must be quoted and paid before fulfillment can begin' });
      }
      if (order.orderStatus === 'awaiting_shipping_quote') {
        return res.status(409).json({ message: 'Afrolandx must confirm the final shipping price before fulfillment can begin' });
      }
      if (['shipped', 'delivered'].includes(status)
        && order.shippingEstimatedAmount
        && !order.shippingFinalAmount) {
        return res.status(409).json({ message: 'Afrolandx must confirm the final shipping price before dispatch' });
      }
      const allowedNextStatus: Record<string, string> = { pending: 'processing', processing: 'shipped', shipped: 'delivered' };
      if (allowedNextStatus[order.orderStatus || ''] !== status) {
        return res.status(409).json({ message: `Order cannot move from ${order.orderStatus} to ${status}` });
      }

      let vendorOwnsItems = false;
      const orderVendorIds = new Set<number>();
      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        if (product) orderVendorIds.add(product.vendorId);
        if (product?.vendorId === vendor.id) {
          vendorOwnsItems = true;
        }
      }

      if (!vendorOwnsItems) {
        return res.status(403).json({ message: 'Access denied: You can only update orders containing your products' });
      }
      if (orderVendorIds.size > 1) {
        return res.status(409).json({
          message: 'This order contains items from multiple vendors. Afrolandx must confirm the combined order status.',
        });
      }

      // Update order status
      if (status === 'shipped') {
        if (!await storage.markOrderShipped(orderId, 'processing', trackingNumber!)) {
          return res.status(409).json({ message: 'Order status changed before shipping could be recorded. Refresh and try again.' });
        }
      } else {
        if (!await storage.transitionOrderStatus(orderId, order.orderStatus || '', status)) {
          return res.status(409).json({ message: 'Order status changed before the update could be recorded. Refresh and try again.' });
        }
      }
      if (status === 'delivered') await releaseOrderEarnings(orderId);

      // Create customer notification based on status
      let notificationTitle = '';
      let notificationMessage = '';

      switch (status) {
        case 'processing':
          notificationTitle = 'Order Being Prepared! 📦';
          notificationMessage = `Your order #${orderId} is now being prepared by ${vendor.businessName}. We'll notify you when it ships.`;
          break;
        case 'shipped':
          notificationTitle = 'Order Shipped! 🚚';
          notificationMessage = `Great news! Your order #${orderId} has been shipped by ${vendor.businessName}. Tracking: ${trackingNumber}.`;
          break;
        case 'delivered':
          notificationTitle = 'Order Delivered! ✅';
          notificationMessage = `Your order #${orderId} from ${vendor.businessName} has been delivered. Thank you for your purchase!`;
          break;
      }

      if (notificationTitle && notificationMessage) {
        await storage.createNotification({
          userId: order.userId,
          title: notificationTitle,
          message: notificationMessage,
          type: 'order',
          orderId: order.id
        }).catch(error => console.error('Failed to notify buyer of order transition:', error));
      }
      await storage.createNotification({
        userId: vendor.userId,
        title: `Order #${orderId} marked ${status}`,
        message: `Your order update for #${orderId} was recorded as ${status}.`,
        type: 'order',
        orderId: order.id,
      }).catch(error => console.error('Failed to notify vendor of order transition:', error));

      res.json({ message: 'Order status updated successfully', trackingNumber });
    } catch (error) {
      console.error('Error updating order status:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'A tracking number is required before marking an order shipped' });
      }
      res.status(500).json({ message: 'Failed to update order status' });
    }
  });

  // Order routes
  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    res.status(405).json({ message: 'Orders must be created through the secure payment flow' });
  });

  app.get('/api/orders/my-orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const orders = await storage.getOrdersForUser(userId);
      const reviewStatuses = await getReviewStatusesForOrderItems(userId, orders.map((order: any) => order.id));
      // Enrich each order with items + product details
      const enriched = await Promise.all(orders.map(async (order) => {
        const rawItems = await storage.getOrderItemsWithProducts(order.id);
        const items = await Promise.all(rawItems.map(async (item) => {
          const product = await storage.getProduct(item.productId);
          const vendor = product ? await storage.getVendor(product.vendorId) : null;
          return {
            ...item,
            reviewStatus: reviewStatuses.get(`${order.id}:${item.productId}`) ?? null,
            productName: product?.name || 'Product',
            productImage: (product?.images as string[])?.[0] || product?.imageUrl || null,
            vendorName: vendor?.businessName || 'Unknown Vendor',
          };
        }));
        return { ...order, items };
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const orders = await storage.getOrdersForUser(userId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.get('/api/orders/:id', checkoutAccess, orderDetailsHandler);

  // Customer: cancel own order (only if pending or processing)
  app.patch('/api/orders/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId !== userId) return res.status(403).json({ message: 'Forbidden' });
      if (order.paymentStatus === 'pending') {
        if (!await unpaidCheckoutCanClose(order, completeVerifiedOrder)) {
          return res.status(409).json({ message: 'Payment is confirmed or still being checked. Do not pay again. Refresh My Orders.' });
        }
        const closed = await closeUnpaidCheckout(orderId, userId, "cancelled");
        if (!closed) return res.status(409).json({ message: 'Payment or order status changed. Refresh your orders before trying again.' });
        await notifyOrderClosure(orderId, "cancelled");
        return res.json({ message: 'Unpaid checkout cancelled. Any payment already in progress will require review.' });
      }
      if (!['awaiting_shipping_quote', 'pending', 'processing'].includes(order.orderStatus || '')) {
        return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
      }
      if (!await storage.cancelOrderIfNoActiveShippingPayment(orderId, userId)) {
        return res.status(409).json({ message: 'This order cannot be cancelled while a shipping payment is in progress' });
      }
      // Notify admins
      const admins = await storage.getAdminUsers();
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          title: '❌ Order Cancelled',
          message: `Customer cancelled Order #${orderId}.`,
          type: 'order',
        });
      }
      res.json({ message: 'Order cancelled successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to cancel order' });
    }
  });

  // Measurement routes
  // Customer: Submit measurements to a vendor
  app.post('/api/measurements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const measurementData = insertMeasurementSchema.parse({
        ...req.body,
        userId,
      });
      if (measurementData.productId) {
        const product = await storage.getProduct(measurementData.productId);
        if (!product || product.status !== 'approved') return res.status(400).json({ message: 'Invalid product' });
        if (measurementData.vendorId && measurementData.vendorId !== product.vendorId) {
          return res.status(400).json({ message: 'Vendor does not match product' });
        }
      }
      if (measurementData.orderId) {
        const order = await storage.getOrder(measurementData.orderId);
        if (!order || order.userId !== userId) return res.status(400).json({ message: 'Invalid order' });
        const items = await storage.getOrderItemsWithProducts(order.id);
        if (measurementData.productId && !items.some(item => item.productId === measurementData.productId)) {
          return res.status(400).json({ message: 'Product is not part of this order' });
        }
      }

      const measurement = await storage.createMeasurement(measurementData as any);

      // Create notification for the vendor
      if (measurementData.vendorId) {
        const vendor = await storage.getVendor(measurementData.vendorId);
        if (vendor) {
          const customer = await storage.getUser(userId);
          await storage.createNotification({
            userId: vendor.userId,
            type: 'measurement_received',
            title: 'New Measurement Received',
            message: `${customer?.firstName || 'A customer'} has submitted their measurements for your review.`,
          });
        }
      }

      res.json(measurement);
    } catch (error) {
      console.error('Error creating measurement:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid measurement data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create measurement' });
    }
  });

  // Customer: Get their own measurements
  app.get('/api/measurements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const measurements = await storage.getUserMeasurements(userId);
      res.json(measurements);
    } catch (error) {
      console.error('Error fetching measurements:', error);
      res.status(500).json({ message: 'Failed to fetch measurements' });
    }
  });

  // Get specific measurement
  app.get('/api/measurements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const measurementId = parseInt(req.params.id);
      const measurement = await storage.getMeasurement(measurementId);

      if (!measurement) {
        return res.status(404).json({ message: 'Measurement not found' });
      }

      // Check if user owns this measurement or is the vendor it was sent to
      const vendor = await storage.getVendorByUserId(userId);
      if (measurement.userId !== userId && measurement.vendorId !== vendor?.id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      res.json(measurement);
    } catch (error) {
      console.error('Error fetching measurement:', error);
      res.status(500).json({ message: 'Failed to fetch measurement' });
    }
  });

  // Customer: Delete their measurement
  app.delete('/api/measurements/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const measurementId = parseInt(req.params.id);
      const measurement = await storage.getMeasurement(measurementId);

      if (!measurement) {
        return res.status(404).json({ message: 'Measurement not found' });
      }

      if (measurement.userId !== userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await storage.deleteMeasurement(measurementId);
      res.json({ message: 'Measurement deleted successfully' });
    } catch (error) {
      console.error('Error deleting measurement:', error);
      res.status(500).json({ message: 'Failed to delete measurement' });
    }
  });

  // Vendor: Get all measurements sent to them
  app.get('/api/vendors/measurements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const vendor = await storage.getVendorByUserId(userId);

      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }

      const measurements = await storage.getVendorMeasurements(vendor.id);
      
      // Enrich with customer information
      const measurementsWithCustomers = await Promise.all(
        measurements.map(async (m) => {
          const customer = await storage.getUser(m.userId);
          return {
            ...m,
            customer: {
              firstName: customer?.firstName,
              lastName: customer?.lastName,
              email: customer?.email,
            }
          };
        })
      );

      res.json(measurementsWithCustomers);
    } catch (error) {
      console.error('Error fetching vendor measurements:', error);
      res.status(500).json({ message: 'Failed to fetch measurements' });
    }
  });

  // Vendor: Update measurement status
  app.patch('/api/vendors/measurements/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const measurementId = parseInt(req.params.id);
      const { status } = req.body;

      if (!status || !['pending', 'received', 'acknowledged'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const measurement = await storage.getMeasurement(measurementId);
      if (!measurement) {
        return res.status(404).json({ message: 'Measurement not found' });
      }

      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || measurement.vendorId !== vendor.id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await storage.updateMeasurementStatus(measurementId, status);

      // Notify customer that vendor acknowledged their measurements
      if (status === 'acknowledged') {
        await storage.createNotification({
          userId: measurement.userId,
          type: 'measurement_acknowledged',
          title: 'Measurements Acknowledged',
          message: 'Your measurements have been reviewed and acknowledged by the vendor.',
        });
      }

      res.json({ message: 'Measurement status updated successfully' });
    } catch (error) {
      console.error('Error updating measurement status:', error);
      res.status(500).json({ message: 'Failed to update measurement status' });
    }
  });

  // Payment webhook (Paystack) — handles async payment confirmations
  app.post('/api/webhooks/paystack', async (req, res) => {
    try {
      const secret = process.env.PAYSTACK_SECRET_KEY;
      const rawBody = (req as any).rawBody;
      const signature = req.headers['x-paystack-signature'];
      if (!secret || !Buffer.isBuffer(rawBody) || typeof signature !== 'string') {
        return res.status(401).json({ message: 'Webhook authentication unavailable' });
      }
      if (!isValidPaystackWebhookSignature(rawBody, signature, secret)) {
        return res.status(401).json({ message: 'Invalid signature' });
      }

      const { event, data } = req.body;

      if (event === 'charge.success') {
        const { reference } = data;
        if (typeof reference !== 'string' || !isPaystackInitialized()) return res.status(200).json({ message: 'Webhook ignored' });
        const verification = await getPaystackService().verifyTransaction(reference);
        const orderId = Number(verification.data?.metadata?.orderId);
        const order = Number.isSafeInteger(orderId) ? await storage.getOrder(orderId) : undefined;
        if (!order) return res.status(200).json({ message: 'Webhook ignored' });
        if (verification.data?.metadata?.paymentType === 'shipping') {
          await completeVerifiedShippingPayment(order, verification, reference);
          return res.status(200).json({ message: 'Webhook received' });
        }
        const mismatch = paymentVerificationError(order, verification, reference);
        if (mismatch) return res.status(200).json({ message: 'Webhook ignored' });
        await completeVerifiedOrder(order, reference);
      }
      if (event === 'refund.processed' || event === 'refund.failed') {
        const merchantNote = String(data?.merchant_note || data?.merchantNote || '');
        const providerReference = merchantNote.match(/refund_\d+_\d+_[a-f0-9]+/i)?.[0];
        if (providerReference) {
          if (event === 'refund.processed') {
            await finalizeNegativeAdjustment(providerReference, 'processed');
          } else {
            await failNegativeAdjustment(
              providerReference,
              String(data?.reason || data?.message || 'Paystack reported that the refund failed'),
            );
          }
        }
      }
      if (event === 'transfer.success' || event === 'transfer.failed' || event === 'transfer.reversed') {
        const reference = data?.reference;
        if (typeof reference !== 'string') return res.status(200).json({ message: 'Webhook ignored' });
        const [settlement] = await db.select().from(vendorSettlements)
          .where(eq(vendorSettlements.providerReference, reference));
        if (!settlement) return res.status(200).json({ message: 'Webhook ignored' });
        if (event === 'transfer.success' && settlement.status !== 'reversed') {
          await db.transaction(async tx => {
            await tx.update(vendorSettlements).set({
              status: 'paid',
              transferCode: data?.transfer_code || settlement.transferCode,
              paidAt: data?.transferred_at ? new Date(data.transferred_at) : new Date(),
              failureReason: null,
              updatedAt: new Date(),
            }).where(eq(vendorSettlements.id, settlement.id));
            await tx.update(vendorLedgerEntries).set({ status: 'settled' })
              .where(eq(vendorLedgerEntries.settlementId, settlement.id));
          });
        } else if (event === 'transfer.reversed') {
          await db.transaction(async tx => {
            await tx.update(vendorSettlements).set({
              status: 'reversed',
              failureReason: String(data?.reason || data?.message || event),
              updatedAt: new Date(),
            }).where(eq(vendorSettlements.id, settlement.id));
            await tx.update(vendorLedgerEntries).set({ settlementId: null, status: 'available' })
              .where(eq(vendorLedgerEntries.settlementId, settlement.id));
          });
        } else if (event === 'transfer.failed' && settlement.status !== 'paid' && settlement.status !== 'reversed') {
          await db.transaction(async tx => {
            await tx.update(vendorSettlements).set({
              status: 'failed',
              failureReason: String(data?.reason || data?.message || event),
              updatedAt: new Date(),
            }).where(eq(vendorSettlements.id, settlement.id));
            await tx.update(vendorLedgerEntries).set({ settlementId: null, status: 'available' })
              .where(eq(vendorLedgerEntries.settlementId, settlement.id));
          });
        }
      }

      if (event === 'transfer.success' || event === 'transfer.failed' || event === 'transfer.reversed') {
        const [settlement] = await db.select().from(vendorSettlements).where(eq(vendorSettlements.providerReference, data.reference));
        if (settlement) await notifyVendorSettlement(settlement.id);
      }
      res.status(200).json({ message: 'Webhook received' });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // Admin order tracking - simplified implementation using storage methods
  app.get('/api/admin/orders', isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Get all orders using storage method
      const allOrders = await storage.getAllOrders();
      const visibleBuyerIds = new Set((await storage.getAllUsers())
        .filter(account => canSeeManagedAccount((req as any).managementActor, account)).map(account => account.id));
      
      const ordersWithDetails = await Promise.all(
        allOrders.filter(order => visibleBuyerIds.has(order.userId)).map(async (order) => {
          const items = await storage.getOrderItemsWithProducts(order.id);
          const customer = await storage.getUser(order.userId);

          // Get vendor details for each item
          const itemsWithVendors = await Promise.all(
            items.map(async (item) => {
              const product = await storage.getProduct(item.productId);
              const vendor = product ? await storage.getVendor(product.vendorId) : null;
              return {
                ...item,
                 vendorName: vendor?.businessName || 'Unknown Vendor',
                 isLegacyVendor: vendor?.businessName === 'Adunni Fashion',
              };
            })
          );

          return {
            ...order,
            items: itemsWithVendors,
             isHistoricalLegacy: itemsWithVendors.length > 0 && itemsWithVendors.every(item => item.isLegacyVendor),
            customer: {
              id: customer?.id,
              email: customer?.email,
              firstName: customer?.firstName,
              lastName: customer?.lastName,
            }
          };
        })
      );

      res.json(ordersWithDetails);
    } catch (error) {
      console.error('Error fetching admin orders:', error);
      res.status(500).json({ message: 'Failed to fetch admin orders' });
    }
  });

  app.get('/api/admin/finance', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const [ledger, settlements, adjustments] = await Promise.all([
        db.select().from(vendorLedgerEntries).orderBy(desc(vendorLedgerEntries.createdAt)),
        db.select().from(vendorSettlements).orderBy(desc(vendorSettlements.createdAt)),
        db.select().from(orderFinancialAdjustments).orderBy(desc(orderFinancialAdjustments.createdAt)),
      ]);
      const vendorList = await storage.getAllVendors();
      const vendorNames = Object.fromEntries(vendorList.map(vendor => [vendor.id, vendor.businessName]));
      res.set('Cache-Control', 'no-store');
      res.json({
        commissionRate: 0.08,
        ledger: ledger.map(entry => ({ ...entry, vendorName: vendorNames[entry.vendorId] || 'Unknown vendor' })),
        settlements: settlements.map(settlement => ({ ...settlement, vendorName: vendorNames[settlement.vendorId] || 'Unknown vendor' })),
        adjustments,
      });
    } catch (error) {
      console.error('Error fetching admin finance:', error);
      res.status(500).json({ message: 'Failed to fetch finance records' });
    }
  });

  app.post('/api/admin/orders/:id/refunds', isAuthenticated, isAdmin, async (req: any, res) => {
    let adjustmentReference: string | undefined;
    let providerAccepted = false;
    try {
      const orderId = Number(req.params.id);
      const input = z.object({
        amount: z.coerce.number().positive().max(100000000),
        reason: z.string().trim().min(5).max(1000),
      }).parse(req.body);
      const order = await storage.getOrder(orderId);
      if (!order || order.paymentStatus !== 'paid' || !order.paymentReference) {
        return res.status(409).json({ message: 'A verified paid order is required' });
      }
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured' });
      adjustmentReference = createFinanceReference(`refund_${orderId}`);
      await claimNegativeAdjustment({
        orderId,
        kind: 'refund',
        amount: input.amount,
        providerReference: adjustmentReference,
        reason: input.reason,
        createdBy: (req.user as any)?.id,
      });
      const refund = await getPaystackService().createRefund(
        order.paymentReference,
        input.amount,
        `AfrolandX ${adjustmentReference}: ${input.reason}`,
      );
      if (!refund?.status) throw new Error('Paystack did not accept the refund');
      providerAccepted = true;
      const refundStatus = String(refund.data?.status || 'pending');
      if (['processed', 'success', 'successful'].includes(refundStatus.toLowerCase())) {
        await finalizeNegativeAdjustment(adjustmentReference, refundStatus);
      } else {
        await notifyFinancialAdjustment(adjustmentReference);
      }
      res.json({ message: 'Refund submitted', status: refundStatus, amount: input.amount });
    } catch (error) {
      console.error('Error creating merchandise refund:', error);
      if (adjustmentReference && !providerAccepted && (!(error instanceof PaystackRequestError) || !error.ambiguous)) {
        await failNegativeAdjustment(
          adjustmentReference,
          error instanceof Error ? error.message : 'Refund request failed',
        ).catch(updateError => console.error('Could not release failed refund claim:', updateError));
      }
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Enter a valid merchandise refund amount and reason' });
      res.status(409).json({
        message: error instanceof PaystackRequestError && error.ambiguous
          ? 'Paystack did not confirm the refund outcome. The amount remains locked for administrator reconciliation and will not be submitted again automatically.'
          : error instanceof Error ? error.message : 'Failed to create refund',
      });
    }
  });

  app.post('/api/admin/orders/:id/chargebacks', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const input = z.object({
        amount: z.coerce.number().positive().max(100000000),
        reference: z.string().trim().min(3).max(160),
        reason: z.string().trim().min(5).max(1000),
      }).parse(req.body);
      await recordNegativeAdjustment({
        orderId,
        kind: 'chargeback',
        amount: input.amount,
        providerReference: input.reference,
        reason: input.reason,
        createdBy: (req.user as any)?.id,
        status: 'confirmed',
      });
      res.json({ message: 'Chargeback recorded and allocated to vendor balances' });
    } catch (error) {
      console.error('Error recording chargeback:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Enter a valid chargeback amount, reference, and reason' });
      res.status(409).json({ message: error instanceof Error ? error.message : 'Failed to record chargeback' });
    }
  });

  app.post('/api/admin/vendors/:id/settlements', isAuthenticated, isAdmin, async (req: any, res) => {
    let settlementId: number | undefined;
    let transferSubmitted = false;
    try {
      const vendorId = Number(req.params.id);
      const vendor = await storage.getVendor(vendorId);
      if (!vendor || vendor.status !== 'approved' || vendor.verificationStatus !== 'verified') {
        return res.status(409).json({ message: 'An approved and verified vendor is required' });
      }
      const [account] = await db.select().from(vendorPayoutAccounts).where(and(
        eq(vendorPayoutAccounts.vendorId, vendorId),
        eq(vendorPayoutAccounts.status, 'verified'),
      ));
      if (!account) return res.status(409).json({ message: 'Vendor does not have a verified payout account' });
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured' });
      const created = await createSettlement(vendorId, account.id, (req.user as any)?.id);
      settlementId = created.settlement.id;
      const reference = createFinanceReference(`settlement_${settlementId}`);
      await db.update(vendorSettlements).set({
        status: 'processing',
        providerReference: reference,
        updatedAt: new Date(),
      }).where(eq(vendorSettlements.id, settlementId));
      const transfer = await getPaystackService().initiateTransfer(
        Number(created.settlement.netAmount),
        created.recipientCode,
        reference,
        `Afrolandx vendor settlement #${settlementId}`,
      );
      transferSubmitted = true;
      const providerStatus = ['success', 'successful'].includes(String(transfer.status).toLowerCase()) ? 'paid' : 'processing';
      const [updated] = await db.update(vendorSettlements).set({
        status: providerStatus,
        transferCode: transfer.transfer_code,
        failureReason: providerStatus === 'paid' ? null : `Paystack transfer status: ${String(transfer.status || 'pending')}`,
        paidAt: providerStatus === 'paid' ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(vendorSettlements.id, settlementId)).returning();
      if (providerStatus === 'paid') {
        await db.update(vendorLedgerEntries).set({ status: 'settled' })
          .where(eq(vendorLedgerEntries.settlementId, settlementId));
      }
      await notifyVendorSettlement(settlementId);
      res.json(updated);
    } catch (error) {
      console.error('Error creating vendor settlement:', error);
      if (settlementId) {
        const outcomeUnknown = transferSubmitted || (error instanceof PaystackRequestError && error.ambiguous);
        if (outcomeUnknown) {
          await db.update(vendorSettlements).set({
            status: 'processing',
            failureReason: 'Paystack transfer outcome requires reconciliation before retry',
            updatedAt: new Date(),
          }).where(eq(vendorSettlements.id, settlementId))
            .catch(updateError => console.error('Could not flag settlement for reconciliation:', updateError));
        } else {
          await db.transaction(async tx => {
            await tx.update(vendorSettlements).set({
              status: 'failed',
              failureReason: error instanceof Error ? error.message : 'Transfer failed',
              updatedAt: new Date(),
            }).where(eq(vendorSettlements.id, settlementId!));
            await tx.update(vendorLedgerEntries).set({
              settlementId: null,
              status: 'available',
            })
              .where(eq(vendorLedgerEntries.settlementId, settlementId!));
          }).catch(releaseError => console.error('Could not release failed settlement entries:', releaseError));
        }
        await notifyVendorSettlement(settlementId);
      }
      res.status(409).json({ message: error instanceof Error ? error.message : 'Failed to create vendor settlement' });
    }
  });

  app.post('/api/admin/settlements/:id/reconcile', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const settlementId = Number(req.params.id);
      if (!Number.isSafeInteger(settlementId)) return res.status(400).json({ message: 'Invalid settlement ID' });
      const [settlement] = await db.select().from(vendorSettlements)
        .where(eq(vendorSettlements.id, settlementId));
      if (!settlement?.providerReference) {
        return res.status(409).json({ message: 'This settlement does not have a Paystack transfer reference' });
      }
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured' });
      const transfer = await getPaystackService().verifyTransfer(settlement.providerReference);
      const status = String(transfer?.status || '').toLowerCase();
      if (['success', 'successful'].includes(status)) {
        await db.transaction(async tx => {
          await tx.update(vendorSettlements).set({
            status: 'paid',
            transferCode: transfer?.transfer_code || settlement.transferCode,
            paidAt: transfer?.transferred_at ? new Date(transfer.transferred_at) : settlement.paidAt || new Date(),
            failureReason: null,
            updatedAt: new Date(),
          }).where(eq(vendorSettlements.id, settlementId));
          await tx.update(vendorLedgerEntries).set({ status: 'settled' })
            .where(eq(vendorLedgerEntries.settlementId, settlementId));
        });
      } else if (status === 'failed' || status === 'reversed') {
        await db.transaction(async tx => {
          await tx.update(vendorSettlements).set({
            status,
            failureReason: String(transfer?.reason || `Paystack transfer ${status}`),
            updatedAt: new Date(),
          }).where(eq(vendorSettlements.id, settlementId));
          await tx.update(vendorLedgerEntries).set({ settlementId: null, status: 'available' })
            .where(eq(vendorLedgerEntries.settlementId, settlementId));
        });
      } else {
        await db.update(vendorSettlements).set({
          status: 'processing',
          failureReason: `Paystack transfer status: ${status || 'pending'}`,
          updatedAt: new Date(),
        }).where(eq(vendorSettlements.id, settlementId));
      }
      const [updated] = await db.select().from(vendorSettlements)
        .where(eq(vendorSettlements.id, settlementId));
      await notifyVendorSettlement(settlementId);
      res.json(updated);
    } catch (error) {
      console.error('Error reconciling settlement:', error);
      res.status(409).json({ message: error instanceof Error ? error.message : 'Settlement reconciliation failed' });
    }
  });

  app.post('/api/admin/adjustments/:id/reconcile', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const adjustmentId = Number(req.params.id);
      if (!Number.isSafeInteger(adjustmentId)) return res.status(400).json({ message: 'Invalid adjustment ID' });
      const [adjustment] = await db.select().from(orderFinancialAdjustments)
        .where(eq(orderFinancialAdjustments.id, adjustmentId));
      if (!adjustment || adjustment.kind !== 'refund' || adjustment.status !== 'processing') {
        return res.status(409).json({ message: 'A processing refund adjustment is required' });
      }
      const order = await storage.getOrder(adjustment.orderId);
      if (!order?.paymentReference) return res.status(409).json({ message: 'Original payment reference is unavailable' });
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured' });
      const refund = await getPaystackService().findRefund(
        order.paymentReference,
        Number(adjustment.amount),
        adjustment.providerReference,
      );
      if (refund) {
        const status = String(refund.status || 'pending').toLowerCase();
        if (['processed', 'success', 'successful'].includes(status)) {
          await finalizeNegativeAdjustment(adjustment.providerReference, status);
        } else if (['failed', 'rejected', 'cancelled'].includes(status)) {
          await failNegativeAdjustment(
            adjustment.providerReference,
            String(refund.reason || refund.message || `Paystack refund ${status}`),
          );
        }
      } else {
        const createdAt = adjustment.createdAt?.getTime() || Date.now();
        if (Date.now() - createdAt < 30 * 60 * 1000) {
          return res.status(409).json({ message: 'Refund is not visible yet. Wait 30 minutes before releasing an uncertain claim.' });
        }
        await failNegativeAdjustment(
          adjustment.providerReference,
          'No matching Paystack refund was found after the reconciliation waiting period',
        );
      }
      const [updated] = await db.select().from(orderFinancialAdjustments)
        .where(eq(orderFinancialAdjustments.id, adjustmentId));
      res.json(updated);
    } catch (error) {
      console.error('Error reconciling refund:', error);
      res.status(409).json({ message: error instanceof Error ? error.message : 'Refund reconciliation failed' });
    }
  });

  app.post('/api/admin/settlements/:id/finalize-otp', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const settlementId = Number(req.params.id);
      const { otp } = z.object({ otp: z.string().regex(/^\d{6}$/) }).parse(req.body);
      const [settlement] = await db.select().from(vendorSettlements)
        .where(eq(vendorSettlements.id, settlementId));
      if (!settlement || settlement.status !== 'processing' || !settlement.transferCode) {
        return res.status(409).json({ message: 'A processing OTP-enabled settlement is required' });
      }
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured' });
      const transfer = await getPaystackService().finalizeTransfer(settlement.transferCode, otp);
      const status = String(transfer?.status || '').toLowerCase();
      await db.update(vendorSettlements).set({
        status: ['success', 'successful'].includes(status) ? 'paid' : 'processing',
        failureReason: ['success', 'successful'].includes(status) ? null : `Paystack transfer status: ${status || 'pending'}`,
        paidAt: ['success', 'successful'].includes(status) ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(vendorSettlements.id, settlementId));
      if (['success', 'successful'].includes(status)) {
        await db.update(vendorLedgerEntries).set({ status: 'settled' })
          .where(eq(vendorLedgerEntries.settlementId, settlementId));
      }
      const [updated] = await db.select().from(vendorSettlements)
        .where(eq(vendorSettlements.id, settlementId));
      res.json(updated);
    } catch (error) {
      console.error('Error finalizing transfer OTP:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Enter the 6-digit Paystack transfer OTP' });
      res.status(409).json({ message: error instanceof Error ? error.message : 'Transfer OTP finalization failed' });
    }
  });

  // Shipping quotes (mock implementation)
  app.post('/api/shipping/quote', async (req, res) => {
    try {
      const { destination, weight } = req.body;

      // Partner rates are not published in the shipping plan, so quote-only
      // providers are returned transparently instead of being given invented prices.
      res.json(SHIPPING_QUOTES.map(quote => ({ ...quote, currency: 'NGN' })));
    } catch (error) {
      res.status(500).json({ message: 'Failed to get shipping quotes' });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      if (!Number.isSafeInteger(notificationId)) return res.status(400).json({ message: 'Invalid notification ID' });
      if (!await storage.markNotificationAsRead(notificationId, userId)) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  // Dismiss notification (delete it)
  app.delete('/api/notifications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      
      // Verify notification belongs to user for security
      await storage.dismissNotification(notificationId, userId);
      res.json({ message: 'Notification dismissed' });
    } catch (error) {
      console.error('Error dismissing notification:', error);
      res.status(500).json({ message: 'Failed to dismiss notification' });
    }
  });

  // Admin analytics
  app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [vendors, products, pendingProducts] = await Promise.all([
        storage.getAllVendors(),
        storage.getProducts({}),
        storage.getProducts({ status: 'pending' }),
      ]);

      const liveVendors = vendors.filter(v => !['Adunni Fashion', 'Test Vendor Co'].includes(v.businessName));
      const liveProducts = products.filter(product => product.status !== 'rejected');
      const stats = {
        totalVendors: liveVendors.length,
        totalProducts: liveProducts.length,
        pendingApprovals: pendingProducts.length,
        approvedVendors: liveVendors.filter(v => v.status === 'approved' && v.verificationStatus === 'verified').length,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch admin stats' });
    }
  });

  // Admin: update order fulfillment status with automatic notifications
  app.patch('/api/admin/orders/:id/tracking', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const trackingNumber = z.string().trim().min(3).max(120).parse(req.body.trackingNumber);
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      const [managedShipment] = await db.select({ id: shipments.id }).from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
      if (['cancelled', 'expired', 'payment_review'].includes(order.orderStatus || '')) {
        return res.status(409).json({ message: 'Closed checkouts cannot be reopened through ordinary status controls. Resolve any received payment before fulfillment.' });
      }
      if (managedShipment) return res.status(409).json({ message: 'Update tracking on the individual shipment in Shipping operations so its timeline stays accurate.' });
      if (!['shipped', 'delivered'].includes(order.orderStatus || '')) {
        return res.status(409).json({ message: 'Tracking can be added once an order is shipped' });
      }
      if (!await storage.updateOrderTracking(orderId, trackingNumber)) {
        return res.status(409).json({ message: 'Use the individual shipment timeline to update managed tracking.' });
      }
      await storage.createNotification({
        userId: order.userId,
        title: 'Tracking information updated',
        message: `Tracking for order #${orderId}: ${trackingNumber}`,
        type: 'order',
        orderId,
      }).catch(error => console.error('Failed to notify tracking update:', error));
      res.json({ trackingNumber });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'A valid tracking number is required' });
      res.status(500).json({ message: 'Failed to update tracking information' });
    }
  });

  // Advisory stalled-order scan. It only creates deduplicated notifications;
  // it never changes fulfillment, payments, inventory, or settlements.
  const scanStalledOrders = async () => {
    const now = Date.now();
    const ordersToCheck = await storage.getAllOrders();
    const admins = await storage.getAdminUsers();
    let alerts = 0;
    for (const order of ordersToCheck) {
      if (['delivered', 'cancelled'].includes(order.orderStatus || '') || order.paymentStatus !== 'paid') continue;
      const ageHours = (now - new Date(order.updatedAt || order.createdAt || now).getTime()) / 3600000;
      const stalled = (order.orderStatus === 'awaiting_shipping_quote' && ageHours > 24)
        || (order.orderStatus === 'processing' && ageHours > 72)
        || (order.orderStatus === 'shipped' && !order.trackingNumber && ageHours > 24)
        || (order.stockReservationStatus === 'failed');
      if (!stalled) continue;
      const stallReason = order.stockReservationStatus === 'failed'
        ? 'stock_failed'
        : order.orderStatus === 'awaiting_shipping_quote'
          ? 'shipping_quote'
          : order.orderStatus === 'shipped'
            ? 'missing_tracking'
            : 'processing';
      const stallType = `stalled_order:${stallReason}`;
      const message = order.stockReservationStatus === 'failed'
        ? `Order #${order.id} is paid but stock reservation failed and needs review.`
        : `Order #${order.id} has remained ${order.orderStatus} for ${Math.round(ageHours)} hours and needs review.`;
      for (const admin of admins) {
        const existing = (await storage.getUserNotifications(admin.id)).some(notification =>
          notification.orderId === order.id && notification.type === stallType);
        if (existing) continue;
        try {
          await storage.createNotification({
            userId: admin.id,
            type: stallType,
            orderId: order.id,
            title: 'Order needs attention',
            message,
          });
          alerts++;
        } catch (error: any) {
          if (error?.code !== '23505') console.error('Failed to create stalled order alert:', error);
        }
      }
    }
    return { scanned: ordersToCheck.length, alerts };
  };

  app.post('/api/admin/orders/stalled-scan', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      res.json(await scanStalledOrders());
    } catch (error) {
      console.error('Stalled-order scan failed:', error);
      res.status(500).json({ message: 'Failed to scan stalled orders' });
    }
  });

  const stalledOrderScanTimer = setInterval(() => {
    scanStalledOrders().catch(error => console.error('Scheduled stalled-order scan failed:', error));
  }, 15 * 60 * 1000);
  stalledOrderScanTimer.unref();

  app.patch('/api/admin/orders/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      const trackingNumber = status === 'shipped'
        ? z.string().trim().min(3).max(120).parse(req.body.trackingNumber)
        : undefined;
      const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      const [managedShipment] = await db.select({ id: shipments.id }).from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
      if (managedShipment && ['shipped', 'delivered'].includes(status)) {
        return res.status(409).json({ message: 'Update the individual shipments in Shipping operations. The order status follows their combined progress.' });
      }
      if (status !== 'cancelled' && !['included', 'paid'].includes(order.shippingPaymentStatus)) {
        return res.status(409).json({ message: 'Shipping must be quoted and paid before fulfillment can begin' });
      }
      if (status !== 'cancelled' && order.orderStatus === 'awaiting_shipping_quote') {
        return res.status(409).json({ message: 'The final shipping price must be confirmed before fulfillment can begin' });
      }

      if (status === 'cancelled') {
        if (!await storage.cancelOrderIfNoActiveShippingPayment(orderId)) {
          return res.status(409).json({ message: 'This order cannot be cancelled while a shipping payment is in progress' });
        }
      } else {
        if (status === 'shipped') {
          if (!await storage.markOrderShipped(orderId, 'processing', trackingNumber!)) {
            return res.status(409).json({ message: 'Only a processing order can be marked shipped. Refresh and try again.' });
          }
        } else if (status === 'delivered') {
          if (!await storage.transitionOrderStatus(orderId, 'shipped', 'delivered')) {
            return res.status(409).json({ message: 'Only an unmanaged shipped order can be marked delivered here. Use Shipping for individual shipments.' });
          }
        } else {
          if (!await storage.transitionOrderStatus(orderId, order.orderStatus || '', status)) {
            return res.status(409).json({ message: 'Order status changed before the update could be recorded. Refresh and try again.' });
          }
        }
        if (status === 'delivered') await releaseOrderEarnings(orderId);
      }

      // Automatically notify the customer when status changes
      const statusMessages: Record<string, { title: string; message: string }> = {
        processing: {
          title: '🔄 Order Being Processed',
          message: `Great news! Your Order #${orderId} is now being processed by our vendors.`,
        },
        shipped: {
          title: '🚚 Order Shipped!',
          message: `Your Order #${orderId} has been shipped. Tracking: ${trackingNumber}.`,
        },
        delivered: {
          title: '✅ Order Delivered!',
          message: `Your Order #${orderId} has been delivered successfully. Enjoy your African fashion! 🎉`,
        },
        cancelled: {
          title: '❌ Order Cancelled',
          message: `Your Order #${orderId} has been cancelled. If you have questions, please contact our support.`,
        },
      };

      if (statusMessages[status]) {
        await storage.createNotification({
          userId: order.userId,
          title: statusMessages[status].title,
          message: statusMessages[status].message,
          type: 'order',
        });
      }

      // Notify admins when delivered or cancelled (for their dashboard activity feed)
      if (status === 'delivered' || status === 'cancelled') {
        const admins = await storage.getAdminUsers();
        for (const admin of admins) {
          await storage.createNotification({
            userId: admin.id,
            title: status === 'delivered' ? `✅ Order #${orderId} Delivered` : `❌ Order #${orderId} Cancelled`,
            message: `Order #${orderId} worth ₦${parseFloat(order.totalAmount as string).toLocaleString()} has been marked as ${status}.`,
            type: 'order',
          });
        }
      }

      res.json({ message: 'Order status updated', status });
    } catch (error) {
      console.error('Error updating order status:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'A tracking number is required before marking an order shipped' });
      }
      res.status(500).json({ message: 'Failed to update order status' });
    }
  });

  // Admin: rich analytics endpoint
  app.get('/api/admin/analytics', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const [allOrders, allProducts, allVendors, allUsers] = await Promise.all([
        storage.getAllOrders(),
        storage.getProducts({}),
        storage.getAllVendors(),
        storage.getAllUsers(),
      ]);

      const orderVendorRows = await db
        .select({ orderId: orderItems.orderId, vendorName: vendors.businessName })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .innerJoin(vendors, eq(products.vendorId, vendors.id));
      const orderVendorNames = new Map<number, string[]>();
      for (const row of orderVendorRows) {
        const names = orderVendorNames.get(row.orderId) ?? [];
        names.push(row.vendorName);
        orderVendorNames.set(row.orderId, names);
      }
      const classifiedOrders = allOrders.map(order => {
        const vendorNames = orderVendorNames.get(order.id) ?? [];
        return {
          order,
          isHistoricalLegacy: vendorNames.length > 0 && vendorNames.every(name => name === 'Adunni Fashion'),
        };
      });
      const actualOrders = classifiedOrders.filter(entry => !entry.isHistoricalLegacy).map(entry => entry.order);
      const historicalOrders = classifiedOrders.filter(entry => entry.isHistoricalLegacy).map(entry => entry.order);

      // Revenue metrics
      const paidOrders = actualOrders.filter(o =>
        (o.paymentStatus === 'paid' || o.paymentStatus === 'completed')
        && Boolean(o.paymentReference?.trim())
      );
      const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount as string || '0'), 0);
      const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

      // Orders by status
      const ordersByStatus = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => ({
        status,
        count: actualOrders.filter(o => o.orderStatus === status).length,
      }));

      // Revenue trend – last 30 days bucketed by day
      const now = new Date();
      const revenueTrend: Array<{ date: string; revenue: number; orders: number }> = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayOrders = paidOrders.filter(o => {
          const od = new Date(o.createdAt as any).toISOString().split('T')[0];
          return od === dateStr;
        });
        revenueTrend.push({
          date: dateStr,
          revenue: dayOrders.reduce((s, o) => s + parseFloat(o.totalAmount as string || '0'), 0),
          orders: dayOrders.length,
        });
      }

      // Low stock alerts
      const lowStockProducts = allProducts
        .filter(p => p.status === 'approved' && (p.stock ?? 0) <= 5)
        .map(p => ({ id: p.id, name: p.name, quantity: p.stock ?? 0, price: p.price }));

      // Top products by inventory value
      const approvedProducts = allProducts.filter(p => p.status === 'approved');
      const topProductsByValue = [...approvedProducts]
        .sort((a, b) => (parseFloat(b.price) * (b.stock ?? 0)) - (parseFloat(a.price) * (a.stock ?? 0)))
        .slice(0, 8)
        .map(p => ({ id: p.id, name: p.name, price: p.price, quantity: p.stock ?? 0, value: parseFloat(p.price) * (p.stock ?? 0) }));

      // Vendor performance (products & revenue proxy)
      const vendorPerformance = await Promise.all(allVendors.filter(v =>
        v.status === 'approved'
        && v.verificationStatus === 'verified'
        && !['Adunni Fashion', 'Test Vendor Co'].includes(v.businessName)
      ).map(async v => {
        const vProducts = allProducts.filter(p => p.vendorId === v.id && p.status === 'approved');
        return {
          id: v.id,
          businessName: v.businessName,
          productCount: vProducts.length,
          totalInventoryValue: vProducts.reduce((s, p) => s + parseFloat(p.price) * (p.stock ?? 0), 0),
          featuredCount: vProducts.filter(p => p.featured).length,
        };
      }));
      vendorPerformance.sort((a, b) => b.totalInventoryValue - a.totalInventoryValue);

      // Geographic distribution from shipping addresses
      const countryMap: Record<string, number> = {};
      for (const o of actualOrders) {
        try {
          const addr = typeof o.shippingAddress === 'string' ? JSON.parse(o.shippingAddress) : o.shippingAddress;
          const country = addr?.country || 'Unknown';
          countryMap[country] = (countryMap[country] || 0) + 1;
        } catch (_) {}
      }
      const geoDistribution = Object.entries(countryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([country, count]) => ({ country, count }));

      // Customer segments
      const newUsersThisMonth = allUsers.filter(u => {
        const d = new Date(u.createdAt as any);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;

      res.json({
        totalRevenue,
        avgOrderValue,
        totalOrders: actualOrders.length,
        historicalOrders: historicalOrders.length,
        paidOrders: paidOrders.length,
        fulfillmentRate: paidOrders.length > 0 ? Math.round((paidOrders.filter(o => o.orderStatus === 'delivered').length / paidOrders.length) * 100) : 0,
        ordersByStatus,
        revenueTrend,
        lowStockProducts,
        topProductsByValue,
        vendorPerformance: vendorPerformance.slice(0, 8),
        geoDistribution,
        totalCustomers: allUsers.length,
        newCustomersThisMonth: newUsersThisMonth,
        totalApprovedProducts: approvedProducts.length,
        totalInventoryValue: approvedProducts.reduce((s, p) => s + parseFloat(p.price) * (p.stock ?? 0), 0),
      });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // Admin endpoint to refresh AWS credentials
  app.post('/api/admin/refresh-cloud-storage', isAuthenticated, isAdmin, async (req, res) => {
    try {
      console.log('Admin requested cloud storage reinitialization...');
      reinitializeCloudStorage();
      
      const isEnabled = isCloudStorageEnabled();
      const connection = await getCloudStorageConnectionStatus();
      res.json({ 
        message: 'Cloud storage reinitialization completed',
        cloudStorageEnabled: isEnabled,
        ...connection,
        productPhotoStorage: await getR2ProductPhotoStatus(),
      });
    } catch (error) {
      console.error('Error reinitializing cloud storage:', error);
      res.status(500).json({ message: 'Failed to reinitialize cloud storage' });
    }
  });

  // Admin endpoint to check cloud storage status
  app.get('/api/admin/cloud-storage-status', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const isEnabled = isCloudStorageEnabled();
      const hasCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
      const connection = await getCloudStorageConnectionStatus();
      res.json({
        cloudStorageEnabled: isEnabled,
        hasCredentials,
        hasSessionToken: !!process.env.AWS_SESSION_TOKEN,
        ...connection,
        productPhotoStorage: await getR2ProductPhotoStatus(),
      });
    } catch (error) {
      console.error('Error checking cloud storage status:', error);
      res.status(500).json({ message: 'Failed to check cloud storage status' });
    }
  });

  // Chatbot endpoint with input validation
  const chatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(5000),
  });

  const chatRequestSchema = z.object({
    messages: z.array(chatMessageSchema).min(1).max(50),
  });

  app.post('/api/chat', requestRateLimit("public-ai", 20, 60), requestRateLimit("public-ai-daily", 200, 86400), async (req, res) => {
    try {
      // Validate request body to prevent injection of system messages or malformed data
      const validationResult = chatRequestSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request format', 
          errors: validationResult.error.errors 
        });
      }

      const { messages } = validationResult.data;
      const chatbot = getChatbotService();
      const response = await chatbot.generateResponse(messages);
      
      res.json({ response });
    } catch (error: any) {
      console.error('Error in chatbot endpoint:', error?.message ?? error);
      // Return a 200 with a user-friendly message so the frontend can display it cleanly
      res.json({ response: "I'm having a brief technical issue. Please try your question again in a moment!" });
    }
  });

  // Messaging endpoints
  app.post('/api/messages', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const validationResult = insertMessageSchema.safeParse({
        ...req.body,
        senderId: userId,
      });

      if (!validationResult.success) {
        return res.status(400).json({ message: 'Invalid message data', errors: validationResult.error.errors });
      }

      const message = await storage.sendMessage(validationResult.data);

      await storage.createNotification({
        userId: message.recipientId,
        type: 'new_message',
        title: 'New Message',
        message: `You have a new message`,
      });

      res.status(201).json(message);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  app.get('/api/messages/conversations', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ message: 'Failed to fetch conversations' });
    }
  });

  app.get('/api/messages/conversation/:otherUserId', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { otherUserId } = req.params;
      const messages = await storage.getConversationMessages(userId, otherUserId);
      
      await storage.markMessagesAsRead(userId, otherUserId);

      res.json(messages);
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  app.get('/api/messages/unread-count', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Error fetching unread message count:', error);
      res.status(500).json({ message: 'Failed to fetch unread count' });
    }
  });

  // Body scanning endpoints
  app.get('/api/body-scan/status', getServiceStatus);
  app.post('/api/body-scan/initiate', isAuthenticated, initiateScan);
  app.get('/api/body-scan/results/:sessionId', isAuthenticated, getScanResults);

  // ============================================
  // FEATURE 1: Bespoke Lookbook Studio
  // ============================================
  
  app.post('/api/occasions', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const occasion = await storage.createOccasionProfile({ ...req.body, userId });
      res.status(201).json(occasion);
    } catch (error) {
      console.error('Error creating occasion:', error);
      res.status(500).json({ message: 'Failed to create occasion' });
    }
  });

  app.get('/api/occasions', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const occasions = await storage.getUserOccasions(userId);
      res.json(occasions);
    } catch (error) {
      console.error('Error fetching occasions:', error);
      res.status(500).json({ message: 'Failed to fetch occasions' });
    }
  });

  app.post('/api/lookbooks/generate', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const input = z.object({
        occasionId: z.number().int().positive().optional(),
        eventType: z.string().trim().max(100).optional(),
        budget: z.number().positive().finite().max(1_000_000_000).optional(),
        styleNotes: z.string().trim().max(1000).optional(),
        familySize: z.string().trim().max(30).optional(),
        eventLocation: z.string().trim().max(100).optional(),
      }).safeParse(req.body);
      if (!input.success || (!input.data.styleNotes && !input.data.eventType)) {
        return res.status(400).json({ message: 'Describe your style or choose an event type.' });
      }
      const { occasionId, eventType, budget, styleNotes, familySize, eventLocation } = input.data;
      if (occasionId) {
        const occasion = await storage.getOccasion(occasionId);
        if (!occasion || occasion.userId !== userId) {
          return res.status(404).json({ message: 'Occasion not found' });
        }
      }

      const [availableProducts, vendorsForCatalog] = await Promise.all([
        storage.getProducts({ status: 'approved' }),
        storage.getAllVendors(),
      ]);
      const approvedVendorIds = new Set(vendorsForCatalog.filter(v => v.status === 'approved').map(v => v.id));
      const catalog = availableProducts
        .filter(p => approvedVendorIds.has(p.vendorId) && Number.isFinite(Number(p.price)) &&
          Number(p.price) >= 0 && (budget === undefined || Number(p.price) <= budget))
        .slice(0, 30);
      if (!catalog.length) {
        return res.status(422).json({ message: 'No products match that budget right now.' });
      }
      const productCatalog = catalog.map(p => ({
        id: p.id,
        name: p.name,
        priceNGN: p.price,
        categoryId: p.categoryId,
        description: p.description?.substring(0, 80) || '',
      }));

      const prompt = `You are an expert African fashion stylist for Afrolandx. Create a personalised outfit selection.

USER REQUEST:
${styleNotes ? `"${styleNotes}"` : '(no description provided)'}
Event Type: ${eventType || 'general'}
Event Location: ${eventLocation || 'not specified'}
Group Size: ${familySize || 'not specified'} (recommend one outfit, not one per attendee)
Budget for this outfit: ${budget ? `up to ₦${budget} NGN` : 'no budget limit'}

AVAILABLE PRODUCTS:
${JSON.stringify(productCatalog)}

INSTRUCTIONS:
- Select 1-5 products from the available catalog that work together as a cohesive outfit
- Prioritise products that best match the user's description and occasion
- Prices are in Nigerian naira (NGN). Keep the TOTAL of the selected products within the NGN budget if specified
- Write a specific, encouraging reason for each pick (mention colours, occasion fit, or cultural significance)
- Return ONLY a valid JSON array, no other text:
[{"productId": <number>, "reason": "<specific reason why this fits the request>"}]`;

      let items: ReturnType<typeof buildLookbookItems>;
      try {
        const aiResponse = await getChatbotService().generateResponse([{ role: 'user', content: prompt }]);
        items = buildLookbookItems(aiResponse, catalog, budget);
      } catch (e) {
        console.error('AI lookbook generation failed:', e);
        return res.status(503).json({ message: 'Could not generate a matching lookbook right now. Please try again.' });
      }

      const lookbook = await storage.createLookbookRecommendation({
        userId,
        occasionId,
        bundleItems: items.items,
        totalPrice: items.totalPrice.toString(),
        status: 'generated',
      });
      
      res.status(201).json(lookbook);
    } catch (error) {
      console.error('Error generating lookbook:', error);
      res.status(500).json({ message: 'Failed to generate lookbook' });
    }
  });

  app.get('/api/lookbooks', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const lookbooks = await storage.getUserLookbooks(userId);
      res.json(lookbooks);
    } catch (error) {
      console.error('Error fetching lookbooks:', error);
      res.status(500).json({ message: 'Failed to fetch lookbooks' });
    }
  });

  app.post('/api/lookbooks/:id/accept', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid lookbook ID' });
      if (!await storage.updateLookbookStatus(id, userId, 'accepted')) {
        return res.status(404).json({ message: 'Lookbook not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error accepting lookbook:', error);
      res.status(500).json({ message: 'Failed to accept lookbook' });
    }
  });

  // ============================================
  // FEATURE 2: Smart Fit Confidence Score
  // ============================================
  
  app.get('/api/products/:id/fit-score', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const userId = req.user?.id;
      
      // Get user's measurements if available (only for authenticated users)
      let userMeasurements;
      if (userId) {
        const measurements = await storage.getUserMeasurements(userId);
        userMeasurements = measurements[0]; // Most recent
      }
      
      const fitScore = await storage.calculateFitScore(productId, userMeasurements);
      const feedback = await storage.getProductFeedback(productId);
      
      res.json({ 
        fitScore, 
        totalReviews: feedback.length,
        recommendation: fitScore >= 85 ? 'Excellent fit' : fitScore >= 70 ? 'Good fit' : 'Consider measurements',
        hasPersonalizedScore: !!userMeasurements
      });
    } catch (error) {
      console.error('Error calculating fit score:', error);
      res.status(500).json({ message: 'Failed to calculate fit score' });
    }
  });

  app.post('/api/experience-feedback', async (req, res) => {
    try {
      const parsed = insertExperienceFeedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Please choose how you feel before submitting feedback.',
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const [feedback] = await db.insert(experienceFeedback).values({
        ...parsed.data,
        comment: parsed.data.comment || null,
        userId: req.user?.id ?? null,
      }).returning({
        id: experienceFeedback.id,
        mood: experienceFeedback.mood,
        comment: experienceFeedback.comment,
        pagePath: experienceFeedback.pagePath,
        createdAt: experienceFeedback.createdAt,
      });

      try {
        await sendExperienceFeedbackNotification({
          mood: feedback.mood as "sad" | "indifferent" | "happy",
          comment: feedback.comment,
          pagePath: feedback.pagePath,
          createdAt: feedback.createdAt,
        });
      } catch (notificationError) {
        console.error('Experience feedback was saved, but support notification failed:', notificationError);
      }

      res.status(201).json({
        id: feedback.id,
        mood: feedback.mood,
        createdAt: feedback.createdAt,
        message: 'Thank you for sharing your experience with Afrolandx.',
      });
    } catch (error) {
      console.error('Error submitting experience feedback:', error);
      res.status(500).json({ message: 'We could not save your feedback. Please try again.' });
    }
  });

  // ============================================
  // FEATURE 3: Measurement Health Alerts
  // ============================================
  
  app.get('/api/vendor/measurement-alerts', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved') return res.status(403).json({ message: 'Approved vendor access required' });
      
      const alerts = await storage.getVendorMeasurementAlerts(vendor.id);
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching measurement alerts:', error);
      res.status(500).json({ message: 'Failed to fetch alerts' });
    }
  });

  app.post('/api/vendor/measurement-alerts/:id/acknowledge', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved') return res.status(403).json({ message: 'Approved vendor access required' });
      
      const id = parseInt(req.params.id);
      await storage.acknowledgeMeasurementAlert(id, vendor.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({ message: 'Failed to acknowledge alert' });
    }
  });

  // ============================================
  // FEATURE 4: Vendor Workshop Dashboard
  // ============================================
  
  app.get('/api/vendor/workshop/orders', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved') return res.status(403).json({ message: 'Approved vendor access required' });
      
      const vendorOrders = await storage.getVendorOrders(vendor.id);
      
      // Get production steps for each order
      const ordersWithSteps = await Promise.all(vendorOrders.map(async (order) => {
        const steps = await storage.getOrderProductionSteps(order.id);
        const items = await storage.getOrderItemsWithProducts(order.id);
        return { ...order, productionSteps: steps, items };
      }));
      
      res.json(ordersWithSteps);
    } catch (error) {
      console.error('Error fetching workshop orders:', error);
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.post('/api/vendor/workshop/orders/:orderId/steps', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved') return res.status(403).json({ message: 'Approved vendor access required' });
      
      const orderId = parseInt(req.params.orderId);
      const { stage, notes, orderItemId } = req.body;
      if (!Number.isSafeInteger(orderId)) return res.status(400).json({ message: 'Invalid order ID' });
      const order = await storage.getOrder(orderId);
      if (!order || order.paymentStatus !== 'paid') return res.status(404).json({ message: 'Paid order not found' });
      if (!['included', 'paid'].includes(order.shippingPaymentStatus)) {
        return res.status(409).json({ message: 'Shipping must be paid before production can begin' });
      }
      if (order.orderStatus === 'awaiting_shipping_quote') {
        return res.status(409).json({ message: 'The final shipping price must be confirmed before production can begin' });
      }
      const items = await storage.getOrderItemsWithProducts(orderId);
      const vendorItems = [];
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (product?.vendorId === vendor.id) vendorItems.push(item);
      }
      if (vendorItems.length === 0) return res.status(403).json({ message: 'This order does not contain your products' });
      if (orderItemId !== undefined && !vendorItems.some(item => item.id === Number(orderItemId))) {
        return res.status(403).json({ message: 'Order item does not belong to this vendor' });
      }

      const stepData = insertProductionStepSchema.parse({
        orderId,
        orderItemId: orderItemId === undefined ? null : Number(orderItemId),
        stage,
        notes: typeof notes === 'string' ? notes.trim().slice(0, 1000) : null,
        completedBy: userId,
      });
      const step = await storage.createProductionStep(stepData);
      res.status(201).json(step);
    } catch (error) {
      console.error('Error creating production step:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid production step', errors: error.errors });
      res.status(500).json({ message: 'Failed to create step' });
    }
  });

  app.patch('/api/vendor/workshop/steps/:id/complete', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved') return res.status(403).json({ message: 'Approved vendor access required' });
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      const step = await storage.getProductionStep(id);
      if (!step) return res.status(404).json({ message: 'Production step not found' });
      const order = await storage.getOrder(step.orderId);
      if (!order || order.paymentStatus !== 'paid' || !['included', 'paid'].includes(order.shippingPaymentStatus)) {
        return res.status(409).json({ message: 'Shipping must be paid before production can continue' });
      }
      if (order.orderStatus === 'awaiting_shipping_quote') {
        return res.status(409).json({ message: 'The final shipping price must be confirmed before production can continue' });
      }
      const items = await storage.getOrderItemsWithProducts(step.orderId);
      const relevantItems = step.orderItemId ? items.filter(item => item.id === step.orderItemId) : items;
      let ownsStep = false;
      for (const item of relevantItems) {
        const product = await storage.getProduct(item.productId);
        if (product?.vendorId === vendor.id) ownsStep = true;
      }
      if (!ownsStep) return res.status(403).json({ message: 'Production step does not belong to this vendor' });
      await storage.updateProductionStep(id, new Date(), typeof notes === 'string' ? notes.trim().slice(0, 1000) : undefined);
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing step:', error);
      res.status(500).json({ message: 'Failed to complete step' });
    }
  });

  // Vendor resources
  app.get('/api/vendor/resources', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor) return res.status(403).json({ message: 'Not a vendor' });
      
      const resources = await storage.getVendorResources(vendor.id);
      const lowStock = await storage.getLowStockResources(vendor.id);
      
      res.json({ resources, lowStockAlerts: lowStock });
    } catch (error) {
      console.error('Error fetching resources:', error);
      res.status(500).json({ message: 'Failed to fetch resources' });
    }
  });

  app.post('/api/vendor/resources', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor) return res.status(403).json({ message: 'Not a vendor' });
      
      const resourceData = insertVendorResourceSchema.parse({ ...req.body, vendorId: vendor.id });
      const resource = await storage.createVendorResource(resourceData);
      res.status(201).json(resource);
    } catch (error) {
      console.error('Error creating resource:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid resource data', errors: error.errors });
      res.status(500).json({ message: 'Failed to create resource' });
    }
  });

  // ============================================
  // FEATURE 5: Event Outfit Planner
  // ============================================
  
  app.get('/api/events/collections', async (req, res) => {
    try {
      const { eventType } = req.query;
      const collections = await storage.getEventCollections(eventType as string);
      
      // Enhance with product details
      const enhanced = await Promise.all(collections.map(async (collection) => {
        const productIds = (collection.productIds as number[]) || [];
        const collectionProducts = await Promise.all(
          productIds.map(id => storage.getProduct(id))
        );
        return { ...collection, title: collection.name, products: collectionProducts.filter(Boolean) };
      }));
      
      res.json(enhanced);
    } catch (error) {
      console.error('Error fetching event collections:', error);
      res.status(500).json({ message: 'Failed to fetch collections' });
    }
  });

  app.post('/api/events/collections', isAdmin, async (req, res) => {
    try {
      const collection = await storage.createEventCollection(req.body);
      res.status(201).json(collection);
    } catch (error) {
      console.error('Error creating event collection:', error);
      res.status(500).json({ message: 'Failed to create collection' });
    }
  });

  app.get('/api/events/recommend', async (req: any, res) => {
    try {
      const userId = req.user?.id ?? null;
      const { eventType, budget, familySize } = req.query;

      // Try pre-seeded collections first
      let collections = await storage.getEventCollections(eventType as string);

      // ---------- Dynamic fallback: build collections from real products ----------
      if (collections.length === 0) {
        const allProducts = await storage.getProducts({ status: 'approved' });

        // Keyword map per event type → used to score/filter products
        const eventKeywords: Record<string, string[]> = {
          wedding:         ['agbada','aso oke','lace','gele','bride','groom','traditional','bridal','velvet','ankara'],
          naming_ceremony: ['ankara','baby','wrapper','george','lace','iro','buba'],
          festival:        ['festival','masquerade','native','ankara','adire','aso oke','tie dye','batik'],
          chieftaincy:     ['agbada','chief','royal','velvet','cap','beads','coral'],
          party:           ['ankara','kaftan','senator','native','lace','skirt'],
          burial:          ['ankara','lace','wrapper','iro','buba','george'],
          graduation:      ['senator','native','kaftan','lace','ankara'],
          engagement:      ['lace','george','silk','velvet','bridal','aso oke'],
          corporate:       ['senator','kaftan','native','suit','formal'],
          religious:       ['lace','ankara','george','wrapper','iro','buba'],
          others:          ['ankara','native','lace','senator','kaftan'],
        };

        const keywords = eventKeywords[(eventType as string)?.toLowerCase()] ?? eventKeywords.others;

        // Score every product by keyword match
        const scored = allProducts
          .map(p => {
            const text = `${p.name} ${p.description ?? ''}`.toLowerCase();
            const score = keywords.filter(k => text.includes(k)).length;
            return { product: p, score };
          })
          .sort((a, b) => b.score - a.score);

        // Take best 12 products, split into up to 3 collections of 4
        const top = scored.slice(0, 12).map(s => s.product);
        const chunkSize = 4;
        const chunks: typeof top[] = [];
        for (let i = 0; i < top.length; i += chunkSize) chunks.push(top.slice(i, i + chunkSize));

        const eventLabel: Record<string, string> = {
          wedding: 'Wedding', naming_ceremony: 'Naming Ceremony', festival: 'Festival',
          chieftaincy: 'Chieftaincy', party: 'Party', burial: 'Burial',
          graduation: 'Graduation', engagement: 'Engagement', corporate: 'Corporate', religious: 'Religious', others: 'Special Event',
        };
        const label = eventLabel[(eventType as string)] ?? 'Event';

        const collectionNames = [
          `${label} Essentials`, `${label} Premium Selection`, `${label} Complete Package`,
        ];
        const collectionDescs = [
          `A curated selection of traditional pieces perfect for your ${label.toLowerCase()}.`,
          `Premium authentic African wear handpicked for ${label.toLowerCase()} occasions.`,
          `Everything you need to dress your whole family for the ${label.toLowerCase()}.`,
        ];

        // Build synthetic collection objects
        collections = chunks.map((chunk, idx) => ({
          id: -(idx + 1), // negative IDs signal synthetic collections
          name: collectionNames[idx] ?? `${label} Collection ${idx + 1}`,
          description: collectionDescs[idx] ?? '',
          eventType: eventType as string,
          productIds: chunk.map(p => p.id),
          createdAt: new Date(),
        }) as any);
      }
      // ---------- End dynamic fallback ----------

      // Get user measurements if logged in
      const measurements = userId ? await storage.getUserMeasurements(userId) : [];
      const hasMeasurements = measurements.length > 0;

      // Enhance collections with product details + fit scores + totals
      const recommendations = await Promise.all(collections.map(async (collection) => {
        const productIds = (collection.productIds as number[]) || [];
        const collectionProducts = await Promise.all(
          productIds.map(async (id) => {
            const product = await storage.getProduct(id);
            if (!product) return null;
            const fitScore = hasMeasurements ? await storage.calculateFitScore(id, measurements[0]) : undefined;
            return { ...product, fitScore };
          })
        );

        const validProducts = collectionProducts.filter(Boolean) as any[];
        const totalPrice = validProducts.reduce((sum, p) => sum + parseFloat(p?.price || '0'), 0);
        const avgFitScore = hasMeasurements && validProducts.length > 0
          ? validProducts.reduce((sum, p) => sum + (p?.fitScore ?? 85), 0) / validProducts.length
          : undefined;

        return {
          ...collection,
          title: collection.name,
          products: validProducts,
          totalPrice,
          avgFitScore,
        };
      }));

      // Filter by budget if specified
      const budgetNum = budget ? parseFloat(budget as string) : null;
      const filtered = budgetNum
        ? recommendations.filter(r => r.totalPrice <= budgetNum)
        : recommendations;

      res.json(filtered.filter(r => r.products.length > 0));
    } catch (error) {
      console.error('Error getting event recommendations:', error);
      res.status(500).json({ message: 'Failed to get recommendations' });
    }
  });

  // ============================================
  // FEATURE 6: Cultural Story Capsules
  // ============================================
  
  app.get('/api/products/:id/stories', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const stories = await storage.getProductStories(productId);
      res.json(stories);
    } catch (error) {
      console.error('Error fetching product stories:', error);
      res.status(500).json({ message: 'Failed to fetch stories' });
    }
  });

  app.post('/api/products/:id/stories', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const productId = parseInt(req.params.id);
      
      // Verify user owns this product (is the vendor)
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved' || vendor.id !== product.vendorId) {
        return res.status(403).json({ message: 'Not authorized to add stories to this product' });
      }
      const storyData = insertProductStorySchema.parse({ ...req.body, productId });
      const story = await storage.createProductStory(storyData);
      res.status(201).json(story);
    } catch (error) {
      console.error('Error creating product story:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid story data', errors: error.errors });
      res.status(500).json({ message: 'Failed to create story' });
    }
  });

  // ============================================
  // FEATURE 7: Loyalty & Rewards Program
  // ============================================
  
  app.get('/api/loyalty', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const account = await storage.getOrCreateLoyaltyAccount(userId);
      const history = await storage.getLoyaltyHistory(userId);
      
      res.json({ account, history: history.slice(0, 20) });
    } catch (error) {
      console.error('Error fetching loyalty account:', error);
      res.status(500).json({ message: 'Failed to fetch loyalty account' });
    }
  });

  app.post('/api/loyalty/redeem', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const { points } = req.body;
      const success = await storage.redeemLoyaltyPoints(userId, points);
      
      if (!success) {
        return res.status(400).json({ message: 'Insufficient points' });
      }
      
      // Calculate discount (100 points = ₦500 discount)
      const discountAmount = (points / 100) * 500;
      
      res.json({ success: true, discountAmount });
    } catch (error) {
      console.error('Error redeeming points:', error);
      res.status(500).json({ message: 'Failed to redeem points' });
    }
  });

  app.get('/api/loyalty/referral-code', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const code = await storage.generateReferralCode(userId);
      res.json({ referralCode: code });
    } catch (error) {
      console.error('Error generating referral code:', error);
      res.status(500).json({ message: 'Failed to generate referral code' });
    }
  });

  app.post('/api/loyalty/apply-referral', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const { referralCode } = req.body;
      const success = await storage.applyReferralCode(userId, referralCode);
      
      if (!success) {
        return res.status(400).json({ message: 'Invalid or already used referral code' });
      }
      
      res.json({ success: true, message: 'Referral code applied! You earned 100 bonus points.' });
    } catch (error) {
      console.error('Error applying referral code:', error);
      res.status(500).json({ message: 'Failed to apply referral code' });
    }
  });

  // ============================================
  // FEATURE 7b: Cultural Quizzes
  // ============================================
  
  app.get('/api/quizzes', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const quizzes = await storage.getActiveQuizzes();
      
      // Mark which quizzes user has completed
      const enhanced = await Promise.all(quizzes.map(async (quiz) => {
        const completed = await storage.hasUserCompletedQuiz(userId, quiz.id);
        return { ...quiz, completed };
      }));
      
      res.json(enhanced);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      res.status(500).json({ message: 'Failed to fetch quizzes' });
    }
  });

  app.get('/api/quizzes/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quiz = await storage.getQuiz(id);
      
      if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
      
      res.json(quiz);
    } catch (error) {
      console.error('Error fetching quiz:', error);
      res.status(500).json({ message: 'Failed to fetch quiz' });
    }
  });

  app.post('/api/quizzes/:id/submit', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const quizId = parseInt(req.params.id);
      const { answers } = req.body;
      
      // Check if already completed
      const alreadyCompleted = await storage.hasUserCompletedQuiz(userId, quizId);
      if (alreadyCompleted) {
        return res.status(400).json({ message: 'You have already completed this quiz' });
      }
      
      const quiz = await storage.getQuiz(quizId);
      if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
      
      // Calculate score
      const questions = quiz.questions as any[];
      let correctCount = 0;
      answers.forEach((answer: number, index: number) => {
        if (questions[index] && questions[index].correctIndex === answer) {
          correctCount++;
        }
      });
      
      const score = Math.round((correctCount / questions.length) * 100);
      const passed = score >= 70;
      const pointsEarned = passed ? (quiz.rewardPoints || 10) : 0;
      
      const attempt = await storage.submitQuizAttempt({
        userId,
        quizId,
        answers,
        score,
        passed,
        pointsEarned,
      });
      
      res.json({ 
        attempt, 
        score, 
        passed, 
        pointsEarned,
        correctCount,
        totalQuestions: questions.length
      });
    } catch (error) {
      console.error('Error submitting quiz:', error);
      res.status(500).json({ message: 'Failed to submit quiz' });
    }
  });

  app.post('/api/admin/quizzes', isAdmin, async (req, res) => {
    try {
      const quiz = await storage.createCulturalQuiz(req.body);
      res.status(201).json(quiz);
    } catch (error) {
      console.error('Error creating quiz:', error);
      res.status(500).json({ message: 'Failed to create quiz' });
    }
  });

  // ============================================
  // FEATURE 8: Live Fabric Viewer
  // ============================================
  
  app.get('/api/products/:id/fabric-assets', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const assets = await storage.getProductFabricAssets(productId);
      res.json(assets);
    } catch (error) {
      console.error('Error fetching fabric assets:', error);
      res.status(500).json({ message: 'Failed to fetch fabric assets' });
    }
  });

  app.post('/api/products/:id/fabric-assets', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const productId = parseInt(req.params.id);
      
      // Verify ownership
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved' || vendor.id !== product.vendorId) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      const assetData = insertFabricAssetSchema.parse({ ...req.body, productId });
      const asset = await storage.createFabricAsset(assetData);
      res.status(201).json(asset);
    } catch (error) {
      console.error('Error creating fabric asset:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid fabric asset', errors: error.errors });
      res.status(500).json({ message: 'Failed to create fabric asset' });
    }
  });

  // ============================================
  // FEATURE 9: Designer Collaboration Hub
  // ============================================
  
  app.get('/api/collab-drops', async (req, res) => {
    try {
      const { status } = req.query;
      const requestedStatus = typeof status === 'string' ? status : undefined;
      if (requestedStatus && !['upcoming', 'live', 'ended'].includes(requestedStatus)) {
        return res.status(400).json({ message: 'Invalid collaboration status' });
      }
      const allDrops = await storage.getCollabDrops(requestedStatus);
      const drops = allDrops.filter(drop => drop.status !== 'cancelled');
      
      // Enhance with product and designer details
      const enhanced = await Promise.all(drops.map(async (drop) => {
        const designer = await storage.getVendor(drop.designerId);
        const artisan = drop.artisanId ? await storage.getVendor(drop.artisanId) : null;
        const productIds = (drop.productIds as number[]) || [];
        const dropProducts = await Promise.all(productIds.map(id => storage.getProduct(id)));
        
        return {
          ...drop,
          title: drop.name,
          teaserImageUrl: drop.coverImage,
          designer,
          artisan,
          products: dropProducts.filter(Boolean),
        };
      }));
      
      res.json(enhanced);
    } catch (error) {
      console.error('Error fetching collab drops:', error);
      res.status(500).json({ message: 'Failed to fetch drops' });
    }
  });

  app.get('/api/collab-drops/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid drop ID' });
      const drop = await storage.getCollabDrop(id);
      
      if (!drop || drop.status === 'cancelled') return res.status(404).json({ message: 'Drop not found' });
      
      const designer = await storage.getVendor(drop.designerId);
      const artisan = drop.artisanId ? await storage.getVendor(drop.artisanId) : null;
      const productIds = (drop.productIds as number[]) || [];
      const dropProducts = await Promise.all(productIds.map(id => storage.getProduct(id)));
      const rsvps = await storage.getDropRsvps(id);
      
      res.json({
        ...drop,
        title: drop.name,
        teaserImageUrl: drop.coverImage,
        designer,
        artisan,
        products: dropProducts.filter(Boolean),
        rsvpCount: rsvps.length,
      });
    } catch (error) {
      console.error('Error fetching collab drop:', error);
      res.status(500).json({ message: 'Failed to fetch drop' });
    }
  });

  // AI-powered collab drop suggestion based on free-text user query
  app.post('/api/collab-drops/ai-suggest', requestRateLimit("public-ai", 20, 60), requestRateLimit("public-ai-daily", 200, 86400), async (req, res) => {
    try {
      const { query } = req.body as { query: string };
      if (!query || query.trim().length < 3 || query.trim().length > 300) {
        return res.status(400).json({ message: 'Please provide a search query.' });
      }

      const allDrops = (await storage.getCollabDrops()).filter(drop => drop.status !== 'cancelled');
      if (allDrops.length === 0) return res.json({ dropIds: [], explanation: 'No drops available yet.' });

      const chatbotService = getChatbotService();
      const dropSummary = allDrops.map(d => ({
        id: d.id,
        name: d.name,
        description: (d.description || '').substring(0, 120),
        status: d.status,
        isExclusive: d.isExclusive,
        minLoyaltyTier: d.minLoyaltyTier,
      }));

      const prompt = `You are an African fashion expert. A user is searching for a collaboration drop.

USER QUERY: "${query}"

AVAILABLE DROPS:
${JSON.stringify(dropSummary)}

Return a JSON object with:
- "dropIds": array of matching drop IDs (best matches first, max 5)
- "explanation": one sentence explaining why these match

Return ONLY valid JSON:
{"dropIds": [1, 2], "explanation": "These drops match because..."}`;

      const aiResponse = await chatbotService.generateResponse([{ role: 'user', content: prompt }]);
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const availableIds = new Set(allDrops.map(drop => drop.id));
        const dropIds = Array.isArray(parsed?.dropIds)
          ? parsed.dropIds.map(Number).filter((id: number) => Number.isSafeInteger(id) && availableIds.has(id)).slice(0, 5)
          : [];
        const explanation = typeof parsed?.explanation === 'string'
          ? parsed.explanation.slice(0, 500)
          : 'Showing matching collaboration drops.';
        return res.json({ dropIds, explanation });
      }
      res.json({ dropIds: allDrops.map(d => d.id), explanation: 'Showing all available drops.' });
    } catch (error) {
      console.error('Error in AI collab suggest:', error);
      res.status(500).json({ message: 'AI suggestion failed. Try a different query.' });
    }
  });

  app.post('/api/collab-drops', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor || vendor.status !== 'approved') return res.status(403).json({ message: 'Approved vendor access required' });

      const input = insertCollabDropSchema.parse({
        ...req.body,
        designerId: vendor.id,
        status: 'upcoming',
      });
      if (!(input.dropStartTime instanceof Date) || input.dropStartTime <= new Date()) {
        return res.status(400).json({ message: 'Drop start time must be in the future' });
      }
      if (input.dropEndTime && input.dropEndTime <= input.dropStartTime) {
        return res.status(400).json({ message: 'Drop end time must be after the start time' });
      }
      if (input.artisanId) {
        const artisan = await storage.getVendor(input.artisanId);
        if (!artisan || artisan.status !== 'approved') return res.status(400).json({ message: 'Choose an approved artisan' });
      }
      const productIds = Array.isArray(input.productIds) ? input.productIds.map(Number) : [];
      if (productIds.length > 50 || productIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
        return res.status(400).json({ message: 'Invalid collaboration products' });
      }
      for (const productId of productIds) {
        const product = await storage.getProduct(productId);
        if (!product || product.vendorId !== vendor.id) {
          return res.status(403).json({ message: 'Collaboration drops may only include your products' });
        }
      }
      const drop = await storage.createCollabDrop({ ...input, productIds });
      res.status(201).json(drop);
    } catch (error) {
      console.error('Error creating collab drop:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid collaboration drop', errors: error.errors });
      res.status(500).json({ message: 'Failed to create drop' });
    }
  });

  app.post('/api/collab-drops/:id/rsvp', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const dropId = parseInt(req.params.id);
      if (!Number.isSafeInteger(dropId) || dropId <= 0) return res.status(400).json({ message: 'Invalid drop ID' });
      const drop = await storage.getCollabDrop(dropId);
      
      if (!drop) return res.status(404).json({ message: 'Drop not found' });
      const now = new Date();
      if (drop.status === 'cancelled' || drop.status === 'ended' || (drop.dropEndTime && drop.dropEndTime <= now)) {
        return res.status(409).json({ message: 'This collaboration drop is no longer accepting RSVPs' });
      }
      if (drop.status === 'live' || drop.dropStartTime <= now) {
        return res.status(409).json({ message: 'RSVPs close when the collaboration drop goes live' });
      }
      
      // Check if already RSVPed
      const hasRsvped = await storage.hasUserRsvped(userId, dropId);
      if (hasRsvped) {
        return res.status(400).json({ message: 'Already RSVPed' });
      }
      
      // Check RSVP cap
      if (drop.rsvpCap && (drop.rsvpCount || 0) >= drop.rsvpCap) {
        return res.status(400).json({ message: 'RSVP capacity reached' });
      }
      
      // Check loyalty tier if exclusive
      if (drop.isExclusive && drop.minLoyaltyTier) {
        const loyaltyAccount = await storage.getLoyaltyAccount(userId);
        const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
        const userTierIndex = tierOrder.indexOf(loyaltyAccount?.tier || 'bronze');
        const requiredTierIndex = tierOrder.indexOf(drop.minLoyaltyTier);
        
        if (userTierIndex < requiredTierIndex) {
          return res.status(403).json({ 
            message: `This drop requires ${drop.minLoyaltyTier} tier or higher` 
          });
        }
      }
      
      const rsvp = await storage.createDropRsvp({ dropId, userId, status: 'confirmed' });
      res.status(201).json(rsvp);
    } catch (error) {
      console.error('Error creating RSVP:', error);
      if (error instanceof Error && error.message === 'RSVP_ALREADY_EXISTS') {
        return res.status(409).json({ message: 'Already RSVPed' });
      }
      if (error instanceof Error && error.message === 'RSVP_CAPACITY_REACHED') {
        return res.status(409).json({ message: 'RSVP capacity reached' });
      }
      res.status(500).json({ message: 'Failed to RSVP' });
    }
  });

  app.get('/api/my-rsvps', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const rsvps = await storage.getUserDropRsvps(userId);
      
      // Enhance with drop details
      const enhanced = await Promise.all(rsvps.map(async (rsvp) => {
        const drop = await storage.getCollabDrop(rsvp.dropId);
        return { ...rsvp, drop };
      }));
      
      res.json(enhanced);
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
      res.status(500).json({ message: 'Failed to fetch RSVPs' });
    }
  });

  // ==========================================
  // OpenStreetMap (Overpass + Nominatim) - Free, No API Key Required
  // ==========================================

  // Simple in-memory cache for places API (TTL: 60 minutes)
  const placesCache = new Map<string, { data: any; timestamp: number }>();
  const CACHE_TTL = 60 * 60 * 1000; // 60 minutes

  function getCachedPlaces(key: string): any | null {
    const cached = placesCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    if (cached) placesCache.delete(key);
    return null;
  }

  function setCachedPlaces(key: string, data: any): void {
    if (placesCache.size >= 500) {
      const oldestKey = placesCache.keys().next().value;
      if (oldestKey) placesCache.delete(oldestKey);
    }
    placesCache.set(key, { data, timestamp: Date.now() });
  }

  // Human-readable labels for fallback Nominatim searches
  const PLACE_CATEGORY_LABELS: Record<string, string> = {
    hotel: 'hotels',
    shopping_mall: 'shopping malls',
    restaurant: 'restaurants',
    tourist_attraction: 'tourist attractions',
    airport: 'airports',
    car_rental: 'car rental',
    cafe: 'cafes',
    night_club: 'nightclubs bars',
  };

  // OSM tag sets per category
  const OSM_CATEGORY_TAGS: Record<string, string[]> = {
    hotel:            ['tourism=hotel', 'tourism=hostel', 'tourism=motel', 'tourism=guest_house'],
    shopping_mall:    ['shop=mall', 'shop=supermarket', 'shop=department_store', 'amenity=marketplace'],
    restaurant:       ['amenity=restaurant', 'amenity=fast_food', 'amenity=food_court'],
    tourist_attraction: ['tourism=attraction', 'tourism=museum', 'tourism=theme_park', 'historic=monument', 'historic=ruins'],
    airport:          ['aeroway=aerodrome'],
    car_rental:       ['amenity=car_rental'],
    cafe:             ['amenity=cafe'],
    night_club:       ['amenity=nightclub', 'amenity=bar', 'amenity=pub'],
  };

  // Transform an OSM element into the standard Place format
  function osmToPlace(el: any, fallbackCity: string, fallbackCountry: string): any | null {
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || tags['brand'];
    if (!name) return null;

    const lat: number = el.lat ?? el.center?.lat;
    const lon: number = el.lon ?? el.center?.lon;
    if (!lat || !lon) return null;

    const addrParts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:suburb'],
      tags['addr:city'] || fallbackCity,
      fallbackCountry,
    ].filter(Boolean);

    const primaryType = tags.tourism || tags.amenity || tags.shop || tags.aeroway || tags.historic || 'place';

    return {
      id: `${el.type}/${el.id}`,
      displayName: { text: name },
      formattedAddress: addrParts.join(', '),
      location: { latitude: lat, longitude: lon },
      types: [primaryType],
      primaryType,
      internationalPhoneNumber: tags.phone || tags['contact:phone'],
      websiteUri: tags.website || tags['contact:website'] || tags['url'],
      currentOpeningHours: tags.opening_hours
        ? { openNow: null, weekdayDescriptions: [tags.opening_hours] }
        : undefined,
      editorialSummary: tags.description ? { text: tags.description } : undefined,
    };
  }

  // Alternative Overpass endpoints for load balancing / fallback
  // lz4 mirror is often less congested; kumi and private.coffee as additional fallbacks
  const OVERPASS_ENDPOINTS = [
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  // Run an Overpass QL query with automatic fallback across endpoints
  // Throws a special RateLimitError when all endpoints return 429
  class OverpassRateLimitError extends Error {
    constructor() { super('Overpass rate limited (429)'); this.name = 'OverpassRateLimitError'; }
  }

  async function overpassQuery(ql: string): Promise<any[]> {
    let rateLimitCount = 0;
    let lastError: Error = new Error('All Overpass endpoints failed');
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const controller = new AbortController();
        // 30s fetch timeout — QL already sets [timeout:25] so server-side deadline is shorter
        const timer = setTimeout(() => controller.abort(), 30000);
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(ql)}`,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.status === 429 || resp.status === 504) {
          rateLimitCount++;
          lastError = new OverpassRateLimitError();
          continue; // skip this endpoint, try next immediately
        }
        if (!resp.ok) {
          lastError = new Error(`Overpass ${resp.status} at ${endpoint}`);
          continue;
        }
        const json = await resp.json();
        return json.elements || [];
      } catch (e: any) {
        if (e.name === 'OverpassRateLimitError') throw e;
        lastError = e;
        console.warn(`Overpass endpoint failed (${endpoint}):`, e.message);
      }
    }
    if (rateLimitCount > 0) throw new OverpassRateLimitError();
    throw lastError;
  }

  // Keyword search terms per category for Nominatim viewbox search
  const NOMINATIM_CATEGORY_KEYWORDS: Record<string, string[]> = {
    hotel:              ['hotel', 'guest house'],
    shopping_mall:      ['mall', 'market'],
    restaurant:         ['restaurant'],
    tourist_attraction: ['museum', 'attraction'],
    airport:            ['airport'],
    car_rental:         ['car rental'],
    cafe:               ['cafe'],
    night_club:         ['nightclub', 'bar'],
  };

  // Nominatim viewbox-based category search (no API key, 1 req/s limit respected)
  // Uses bounding box around lat/lng so results are geographically constrained
  async function nominatimCategorySearch(
    categoryId: string, lat: number, lng: number, radius: number
  ): Promise<any[]> {
    const keywords = (NOMINATIM_CATEGORY_KEYWORDS[categoryId] || []).slice(0, 2);
    if (keywords.length === 0) return [];

    // Build viewbox (deg): radius metres → approx degrees (1 deg lat ≈ 111 km)
    const delta = (radius / 1000) / 111;
    const viewbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

    const all: any[] = [];
    for (let i = 0; i < keywords.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 1100)); // respect 1 req/s
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', keywords[i]);
      url.searchParams.set('viewbox', viewbox);
      url.searchParams.set('bounded', '1');
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '25');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('extratags', '1');
      try {
        const resp = await fetch(url.toString(), {
          headers: { 'User-Agent': 'Afrolandx/1.0 (info@afrolandx.com)' },
          signal: AbortSignal.timeout(12000),
        });
        if (!resp.ok) continue;
        const data: any[] = await resp.json();
        all.push(...data);
      } catch { continue; }
    }
    const seen = new Set<string>();
    return all
      .filter(r => { const key = String(r.place_id); if (seen.has(key)) return false; seen.add(key); return true; })
      .map((r: any) => ({
        id: `nominatim/${r.place_id}`,
        displayName: { text: r.name || r.display_name.split(',')[0] },
        formattedAddress: r.display_name,
        location: { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) },
        types: [r.type || r.class || 'place'],
        primaryType: r.type || r.class || 'place',
        internationalPhoneNumber: r.extratags?.phone,
        websiteUri: r.extratags?.website,
        currentOpeningHours: r.extratags?.opening_hours
          ? { weekdayDescriptions: [r.extratags.opening_hours] }
          : undefined,
      }))
      .filter((p: any) => p.displayName.text);
  }

  // Build Overpass QL for a category within radius
  function buildOverpassQuery(tags: string[], lat: number, lon: number, radius: number): string {
    // Cap radius at 5 km — smaller queries are faster and less likely to be rate-limited
    const r = Math.min(radius, 5000);
    const parts = tags.flatMap(tag => {
      const [k, v] = tag.split('=');
      return [
        `node["${k}"="${v}"](around:${r},${lat},${lon});`,
        `way["${k}"="${v}"](around:${r},${lat},${lon});`,
      ];
    });
    // timeout:25 gives the server a hard deadline well within our 30s fetch window
    // out tags center — returns only OSM tags + centroid (much smaller payload than out body)
    return `[out:json][timeout:25];\n(\n${parts.join('\n')}\n);\nout tags center;`;
  }
  
  // Wikipedia photo cache (separate from places cache to avoid re-fetching)
  const wikiPhotoCache = new Map<string, string | null>();

  // Batch-fetch Wikipedia thumbnail photos for a list of places (single API call, up to 50 titles)
  async function enrichWithWikipediaPhotos(places: any[]): Promise<any[]> {
    // Build list of unique names not yet in cache
    const uncached = places
      .map(p => p.displayName.text as string)
      .filter((name, i, arr) => arr.indexOf(name) === i && !wikiPhotoCache.has(name));

    if (uncached.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < uncached.length; i += 50) batches.push(uncached.slice(i, i + 50));

      for (const batch of batches) {
        try {
          const titlesParam = batch.map(t => encodeURIComponent(t)).join('|');
          const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=500&titles=${titlesParam}&format=json&formatversion=2&redirects=1`;
          const resp = await fetch(url, {
            headers: { 'User-Agent': 'Afrolandx/1.0 (info@afrolandx.com)' },
            signal: AbortSignal.timeout(8000),
          });
          if (!resp.ok) { batch.forEach(n => wikiPhotoCache.set(n, null)); continue; }
          const data = await resp.json();
          const pages: any[] = data.query?.pages || [];
          // Build resolved-title → thumbnail map (Wikipedia may redirect titles)
          const photoMap = new Map<string, string>();
          for (const page of pages) {
            if (page.thumbnail?.source) {
              photoMap.set(page.title.toLowerCase(), page.thumbnail.source);
            }
          }
          // Handle redirects: map original title → resolved title
          const redirects: any[] = data.query?.redirects || [];
          const redirectMap = new Map(redirects.map((r: any) => [r.from.toLowerCase(), r.to.toLowerCase()]));
          for (const name of batch) {
            const resolved = redirectMap.get(name.toLowerCase()) || name.toLowerCase();
            wikiPhotoCache.set(name, photoMap.get(resolved) || null);
          }
        } catch {
          batch.forEach(n => wikiPhotoCache.set(n, null));
        }
      }
    }

    return places.map(p => ({
      ...p,
      photoUri: wikiPhotoCache.get(p.displayName.text) || undefined,
    }));
  }

  // Search for places across Africa using OpenStreetMap (Nominatim) — free, no API key
  app.get('/api/places/search', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { query, type, lat, lng, radius = '10000', city = '', country = '' } = req.query;

      if (!query && !type) {
        return res.status(400).json({ message: 'Query or type parameter required' });
      }

      const cacheKey = `osm:${query}:${type}:${lat}:${lng}:${radius}`;
      const cachedData = getCachedPlaces(cacheKey);
      if (cachedData) return res.json(cachedData);

      const radiusNum = Math.min(parseInt(radius as string) || 10000, 50000);
      const latNum = parseFloat(lat as string);
      const lngNum = parseFloat(lng as string);

      let places: any[] = [];

      // Helper: Nominatim free-text search (used as primary for queries, fallback for categories)
      const nominatimSearch = async (q: string): Promise<any[]> => {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=20&addressdetails=1&extratags=1`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Afrolandx/1.0 (info@afrolandx.com)' },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`Nominatim error: ${resp.status}`);
        const results: any[] = await resp.json();
        return results.map((r: any) => ({
          id: `nominatim/${r.place_id}`,
          displayName: { text: r.name || r.display_name.split(',')[0] },
          formattedAddress: r.display_name,
          location: { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) },
          types: [r.type || r.class || 'place'],
          primaryType: r.type || r.class || 'place',
          internationalPhoneNumber: r.extratags?.phone,
          websiteUri: r.extratags?.website,
          currentOpeningHours: r.extratags?.opening_hours
            ? { openNow: null, weekdayDescriptions: [r.extratags.opening_hours] }
            : undefined,
        })).filter((p: any) => p.displayName.text);
      };

      if (type && OSM_CATEGORY_TAGS[type as string]) {
        // Category search: Nominatim viewbox only — Overpass removed (too unreliable / rate-limited)
        if (!lat || !lng || isNaN(latNum) || isNaN(lngNum)) {
          return res.status(400).json({ message: 'lat/lng required for category search' });
        }
        const category = PLACE_CATEGORY_LABELS[type as string] || (type as string).replace(/_/g, ' ');

        try {
          places = await nominatimCategorySearch(type as string, latNum, lngNum, radiusNum);
        } catch (nomErr: any) {
          console.warn('Nominatim category search failed:', nomErr.message);
          places = [];
        }

        // Fallback: plain text search if viewbox search returned nothing
        if (places.length === 0) {
          try {
            places = await nominatimSearch(`${category} in ${city || ''} ${country || ''}`.trim());
          } catch { places = []; }
        }

        places = places.slice(0, 35);
      } else if (query) {
        // Free-text search via Nominatim
        places = await nominatimSearch(query as string);
      }

      // Enrich places with Wikipedia thumbnail photos (single batch API call)
      if (places.length > 0) {
        places = await enrichWithWikipediaPhotos(places);
      }

      const result = { places };
      setCachedPlaces(cacheKey, result);
      res.json(result);
    } catch (error: any) {
      console.error('Error searching places (OSM):', error);
      // Return empty result rather than an error to avoid breaking UI
      res.json({ places: [], warning: 'Location search temporarily unavailable' });
    }
  });

  // Get place details by OSM ID (type/id) using Nominatim lookup
  app.get('/api/places/:osmType/:osmId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { osmType, osmId } = req.params;
      if (!['node', 'way', 'relation', 'nominatim'].includes(osmType)) {
        return res.status(400).json({ message: 'Invalid place type' });
      }

      const cacheKey = `detail:${osmType}/${osmId}`;
      const cached = getCachedPlaces(cacheKey);
      if (cached) return res.json(cached);

      if (osmType === 'nominatim') {
        const url = `https://nominatim.openstreetmap.org/details?place_id=${osmId}&format=json&addressdetails=1&extratags=1`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Afrolandx/1.0 (info@afrolandx.com)' },
          signal: AbortSignal.timeout(10000),
        });
        const data = await resp.json();
        setCachedPlaces(cacheKey, data);
        return res.json(data);
      }

      const osmTypeChar = osmType === 'node' ? 'N' : osmType === 'way' ? 'W' : 'R';
      const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${osmTypeChar}${osmId}&format=json&addressdetails=1&extratags=1`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Afrolandx/1.0 (info@afrolandx.com)' },
        signal: AbortSignal.timeout(10000),
      });
      const results: any[] = await resp.json();
      const data = results[0] || null;
      if (data) setCachedPlaces(cacheKey, data);
      res.json(data || {});
    } catch (error: any) {
      console.error('Error fetching place details (OSM):', error);
      res.status(500).json({ message: 'Failed to fetch place details' });
    }
  });

  // ══ Discover Page Monetization Routes ════════════════════════════════════

  // Admin: list all discover inquiries
  app.get('/api/discover/inquiries', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { discoverInquiries } = await import('@shared/schema');
      const { db } = await import('./db');
      const { desc } = await import('drizzle-orm');
      const inquiries = await db.select().from(discoverInquiries).orderBy(desc(discoverInquiries.createdAt));
      res.json(inquiries);
    } catch (err) {
      console.error('[discover/inquiries GET]', err);
      res.status(500).json({ message: 'Failed to fetch inquiries' });
    }
  });

  // Admin: update inquiry status
  app.patch('/api/discover/inquiries/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { discoverInquiries } = await import('@shared/schema');
      const { db } = await import('./db');
      const { eq } = await import('drizzle-orm');
      const id = parseInt(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid inquiry ID' });
      const { status } = req.body;
      if (!['pending', 'reviewed', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      const [updated] = await db.update(discoverInquiries).set({ status }).where(eq(discoverInquiries.id, id)).returning({ id: discoverInquiries.id });
      if (!updated) return res.status(404).json({ message: 'Inquiry not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: 'Failed to update inquiry status' });
    }
  });

  // Admin: list all premium subscriptions
  app.get('/api/discover/premium', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { discoverPremium } = await import('@shared/schema');
      const { db } = await import('./db');
      const { desc } = await import('drizzle-orm');
      const subs = await db.select().from(discoverPremium).orderBy(desc(discoverPremium.createdAt));
      res.json(subs);
    } catch (err) {
      console.error('[discover/premium GET]', err);
      res.status(500).json({ message: 'Failed to fetch premium subscriptions' });
    }
  });

  // Save any inquiry (guide registration, business claim, deal listing, destination feature)
  app.post('/api/discover/inquiries', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { discoverInquiries } = await import('@shared/schema');
      const { db } = await import('./db');
      const input = z.object({
        type: z.enum(['guide_registration', 'business_claim', 'deal_listing', 'destination_feature']),
        name: z.string().trim().min(2).max(255),
        email: z.string().trim().email().max(255).transform(value => value.toLowerCase()),
        phone: z.string().trim().max(64).optional().nullable(),
        details: z.record(z.string(), z.string().max(3000)).refine(
          value => JSON.stringify(value).length <= 12000,
          'Inquiry details are too long',
        ),
      }).parse(req.body);
      const [inquiry] = await db.insert(discoverInquiries).values({ ...input, status: 'pending' }).returning();
      res.json({ success: true, inquiry });
    } catch (err) {
      console.error('[discover/inquiries]', err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: 'Please check your inquiry details', errors: err.errors });
      res.status(500).json({ message: 'Failed to save inquiry' });
    }
  });

  // Discover is an internal preview. Never initiate new customer charges
  // until actual reservations, cancellations and refunds are supported.
  app.post('/api/discover/bookings/initialize', isAuthenticated, isAdmin, (_req, res) =>
    res.status(503).json({ message: 'Discover bookings are not available yet.' }));
  app.post('/api/discover/premium/initialize', isAuthenticated, isAdmin, (_req, res) =>
    res.status(503).json({ message: 'Discover premium is not available yet.' }));

  // Retain verification for payments initialized before Discover was hidden.
  app.post('/api/discover/payment/verify', async (req, res) => {
    try {
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured.' });
      const { reference } = z.object({
        reference: z.string().regex(/^discover_(booking|premium)_\d+_[a-f0-9]{8}$/),
      }).parse(req.body);
      const { discoverBookings, discoverPremium } = await import('@shared/schema');
      const { db } = await import('./db');
      const isBooking = reference.startsWith('discover_booking_');
      const [record] = isBooking
        ? await db.select().from(discoverBookings).where(eq(discoverBookings.paymentReference, reference))
        : await db.select().from(discoverPremium).where(eq(discoverPremium.paymentReference, reference));
      if (!record) return res.status(404).json({ message: 'Payment record not found' });
      if (record.paymentStatus === 'paid' || record.paymentStatus === 'active') {
        return res.json({ success: true, status: record.paymentStatus, type: isBooking ? 'booking' : 'premium' });
      }

      const verification = await getPaystackService().verifyTransaction(reference);
      const expectedAmount = isBooking ? Number((record as any).totalAmountNgn) : 2500;
      const expectedMetadataId = isBooking ? (record as any).id : (record as any).id;
      const metadataId = isBooking ? Number(verification.data.metadata?.bookingId) : Number(verification.data.metadata?.subscriptionId);
      const expectedEmail = String((record as any).guestEmail || '').toLowerCase();
      const verifiedEmail = String(verification.data.customer?.email || verification.data.metadata?.guestEmail || '').toLowerCase();
      if (
        verification.data.status !== 'success'
        || verification.data.reference !== reference
        || verification.data.currency !== 'NGN'
        || verification.data.amount !== Math.round(expectedAmount * 100)
        || metadataId !== expectedMetadataId
        || verifiedEmail !== expectedEmail
      ) {
        return res.status(409).json({ message: 'Payment details could not be matched to this purchase' });
      }

      if (isBooking) {
        await db.update(discoverBookings)
          .set({ paymentStatus: 'paid' })
          .where(and(eq(discoverBookings.id, (record as any).id), eq(discoverBookings.paymentStatus, 'pending')));
        return res.json({ success: true, status: 'paid', type: 'booking' });
      }
      const subscriptionStart = new Date();
      const subscriptionEnd = new Date(subscriptionStart);
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
      await db.update(discoverPremium)
        .set({ paymentStatus: 'active', subscriptionStart, subscriptionEnd })
        .where(and(eq(discoverPremium.id, (record as any).id), eq(discoverPremium.paymentStatus, 'pending')));
      res.json({ success: true, status: 'active', type: 'premium' });
    } catch (err) {
      console.error('[discover/payment/verify]', err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: 'Invalid payment reference' });
      res.status(err instanceof PaystackRequestError ? 502 : 500).json({ message: 'Verification failed' });
    }
  });

  const httpServer = createServer(app);
  const stopCheckoutExpiry = startUnpaidCheckoutExpiry(completeVerifiedOrder);
  httpServer.once("close", stopCheckoutExpiry);
  return httpServer;
}
