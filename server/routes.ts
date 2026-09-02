import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, sanitizeUser } from "./auth";
import { getPaystackService, isPaystackInitialized } from "./paystack";
import { getChatbotService } from "./chatbot";
import { initiateScan, getScanResults, getServiceStatus } from "./bodyscan";
import {
  insertVendorSchema, insertProductSchema, insertCartItemSchema, insertMeasurementSchema,
  insertMessageSchema, insertProductionStepSchema, insertVendorResourceSchema,
  insertProductStorySchema, insertFabricAssetSchema, orders, orderItems, products, vendors,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { getCloudStorageService, isCloudStorageEnabled, reinitializeCloudStorage } from "./cloudStorage";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  calculateCheckoutTotal,
  CheckoutValidationError,
  findOwnedCartItem,
  getShippingQuote,
  isValidPaystackWebhookSignature,
  paymentVerificationError,
  SHIPPING_QUOTES,
} from "./order-security";
import { createVerifiedOrderCompleter } from "./order-processing";

const shippingAddressSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  address1: z.string().trim().min(3).max(250),
  address2: z.string().trim().max(250).optional().default(''),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(30),
  country: z.string().trim().min(2).max(100),
});

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

// Fallback local storage for when cloud storage is not available
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/products';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `product-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const localUpload = multer({
  storage: localStorage,
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

  // Geo/currency detection — proxied server-side to avoid CORS
  app.get('/api/geo', async (req: any, res) => {
    try {
      // Cache control — client can cache for 24h
      res.set('Cache-Control', 'public, max-age=86400');

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

  const completeVerifiedOrder = createVerifiedOrderCompleter(storage);

  // Admin user management routes
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(sanitizeUser));
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Permanently delete a user/customer and their account-owned data (admin only).
  app.delete('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: 'User ID is required' });
      }
      if (userId === req.user.id) {
        return res.status(400).json({ message: 'You cannot delete your own admin account' });
      }

      const deleted = await storage.deleteUser(userId);
      if (!deleted) return res.status(404).json({ message: 'User not found' });
      res.json({ message: 'User and associated account data deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Update user roles (admin only)
  app.patch('/api/admin/users/:userId/roles', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { roles } = req.body;
      
      if (!Array.isArray(roles) || !roles.every(role => ['customer', 'vendor', 'admin'].includes(role))) {
        return res.status(400).json({ message: 'Invalid roles array' });
      }

      await storage.updateUserRoles(userId, roles);
      res.json({ message: 'User roles updated successfully' });
    } catch (error) {
      console.error('Error updating user roles:', error);
      res.status(500).json({ message: 'Failed to update user roles' });
    }
  });

  // Add role to user (admin only)
  app.post('/api/admin/users/:userId/roles/:role', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId, role } = req.params;
      
      if (!['customer', 'vendor', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      
      await storage.addUserRole(userId, role);
      res.json({ message: 'Role added successfully' });
    } catch (error) {
      console.error('Error adding user role:', error);
      res.status(500).json({ message: 'Failed to add user role' });
    }
  });

  // Remove role from user (admin only)
  app.delete('/api/admin/users/:userId/roles/:role', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId, role } = req.params;
      
      if (!['customer', 'vendor', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      
      await storage.removeUserRole(userId, role);
      res.json({ message: 'Role removed successfully' });
    } catch (error) {
      console.error('Error removing user role:', error);
      res.status(500).json({ message: 'Failed to remove user role' });
    }
  });

  // Grant admin privileges to users
  app.post('/api/admin/grant-admin', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      await storage.addUserRole(userId, 'admin');
      res.json({ message: 'Admin privileges granted successfully' });
    } catch (error) {
      console.error('Error granting admin privileges:', error);
      res.status(500).json({ message: 'Failed to grant admin privileges' });
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
        phone: z.string().trim().min(7).max(30),
        cacNumber: z.string().trim().min(3).max(60),
        description: z.string().trim().min(10).max(2000),
      }).parse(req.body);
      const vendorData = insertVendorSchema.parse({
        ...vendorInput,
        userId,
        status: 'pending',
      });

      const vendor = await storage.createVendor(vendorData);
      await storage.addUserRole(userId, 'vendor');
      res.json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
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
        cacNumber: z.string().trim().min(3).max(60).optional(),
        description: z.string().trim().min(10).max(2000).optional(),
      }).parse(req.body);
      if (Object.keys(profile).length === 0) return res.status(400).json({ message: 'At least one profile field is required' });
      await storage.updateVendorProfile(vendor.id, profile);
      const updated = await storage.getVendorByUserId(userId);
      res.json(updated);
    } catch (error) {
      console.error('Error updating vendor profile:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Invalid vendor profile', errors: error.errors });
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

  // Admin: list all vendors
  app.get('/api/vendors', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const vendors = await storage.getAllVendors();
      const enriched = await Promise.all(vendors.map(async (v) => {
        const user = await storage.getUser(v.userId);
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
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch vendors' });
    }
  });

  // Admin: get single vendor with details
  app.get('/api/vendors/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const vendorId = parseInt(req.params.id);
      const allVendors = await storage.getAllVendors();
      const vendor = allVendors.find(v => v.id === vendorId);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      const user = await storage.getUser(vendor.userId);
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

  app.patch('/api/vendors/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const vendorId = parseInt(req.params.id);
      const { status } = req.body;
      if (!Number.isSafeInteger(vendorId)) return res.status(400).json({ message: 'Invalid vendor ID' });
      if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
        return res.status(400).json({ message: 'Invalid vendor status' });
      }
      const vendor = await storage.getVendor(vendorId);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
      await storage.updateVendorStatus(vendorId, status);
      if (status === 'approved') {
        // Keep the authorization role in sync for legacy/manual vendor records.
        await storage.addUserRole(vendor.userId, 'vendor');
      }
      const updatedVendor = await storage.getVendor(vendorId);
      res.json({ message: 'Vendor status updated', vendor: updatedVendor });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update vendor status' });
    }
  });

  // Product routes
  app.post('/api/products', isAuthenticated, isVendor, async (req: any, res) => {
    const uploadHandler = isCloudStorageEnabled() ? upload.array('images', 5) : localUpload.array('images', 5);
    
    uploadHandler(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      try {
        // Validate required fields are present
        if (!req.body.name || !req.body.shortDescription || !req.body.description || req.body.price === undefined || req.body.stock === undefined || !req.body.categoryId) {
          return res.status(400).json({ 
            message: 'Missing required fields', 
            required: ['name', 'shortDescription', 'description', 'price', 'stock', 'categoryId']
          });
        }
        
        const files = req.files as Express.Multer.File[];
        let imageUrls: string[] = [];

        // Process image uploads with robust fallback
        if (files && files.length > 0) {
          try {
            if (isCloudStorageEnabled()) {
              // Try cloud storage first
              const cloudStorage = getCloudStorageService();
              const uploadPromises = files.map(file => 
                cloudStorage.uploadImage(file.buffer, file.mimetype, 'products')
              );
              imageUrls = await Promise.all(uploadPromises);
              console.log('Successfully uploaded images to cloud storage');
            } else {
              // Cloud storage disabled — localUpload (diskStorage) already saved files to disk.
              // Just generate the serving URLs from the filenames multer assigned.
              for (const file of files) {
                if (file.filename) {
                  // diskStorage: file already saved at uploads/products/<filename>
                  imageUrls.push(`/uploads/${file.filename}`);
                } else if (file.buffer) {
                  // memoryStorage fallback (safety net)
                  const fsMod = await import('fs');
                  const pathMod = await import('path');
                  const sharpMod = await import('sharp');
                  const uploadDir = pathMod.join(process.cwd(), 'uploads', 'products');
                  if (!fsMod.existsSync(uploadDir)) fsMod.mkdirSync(uploadDir, { recursive: true });
                  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                  const filename = `product-${uniqueSuffix}.jpg`;
                  const optimizedBuffer = await sharpMod.default(file.buffer)
                    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 85, progressive: true })
                    .toBuffer();
                  fsMod.writeFileSync(pathMod.join(uploadDir, filename), optimizedBuffer);
                  imageUrls.push(`/uploads/${filename}`);
                }
              }
              console.log(`Saved ${imageUrls.length} image(s) locally via diskStorage`);
            }
          } catch (error: any) {
            console.error('Cloud storage failed, falling back to local storage:', error);
            
            // Check if it's an AWS credential issue and provide specific feedback
            if (error.message?.includes('AWS credentials expired')) {
              console.error('AWS session token has expired. Image will be saved locally until credentials are refreshed.');
            } else if (error.message?.includes('Invalid AWS credentials')) {
              console.error('AWS credentials are invalid. Image will be saved locally until credentials are fixed.');
            }
            
            // Fallback to local storage with optimization
            const fs = await import('fs');
            const path = await import('path');
            const sharp = await import('sharp');
            
            imageUrls = [];
            for (const file of files) {
              const uploadDir = path.join(process.cwd(), 'uploads', 'products');
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              
              // Optimize image before saving locally
              const optimizedBuffer = await sharp.default(file.buffer)
                .resize(800, 800, { 
                  fit: 'inside', 
                  withoutEnlargement: true 
                })
                .jpeg({ 
                  quality: 85,
                  progressive: true 
                })
                .toBuffer();
              
              const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
              const filename = `product-${uniqueSuffix}.jpg`;
              const filepath = path.join(uploadDir, filename);
              
              fs.writeFileSync(filepath, optimizedBuffer);
              imageUrls.push(`/uploads/${filename}`);
            }
            console.log('Successfully saved optimized images locally as fallback');
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
          returnPolicy: req.body.returnPolicy && req.body.returnPolicy.trim() ? req.body.returnPolicy.trim() : null,
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
      if (vendorId) filters.vendorId = parseInt(vendorId as string);
      if (featured) filters.featured = featured === 'true';
      if (search) filters.search = search as string;
      if (minPrice) filters.minPrice = parseFloat(minPrice as string);
      if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);
      if (gender && gender !== 'all') filters.gender = gender as string;
      if (originCountry && originCountry !== 'all') filters.originCountry = originCountry as string;

      const products = await storage.getProducts(filters);
      res.json(products);
    } catch (error) {
      console.error('Products error:', error);
      res.status(500).json({ message: 'Failed to fetch products' });
    }
  });

  app.get('/api/products/with-details', async (req, res) => {
    try {
      const products = (await storage.getProductsWithVendor()).filter(product => product.status === 'approved');
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch products with details' });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if (product.status !== 'approved') return res.status(404).json({ message: 'Product not found' });
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch product' });
    }
  });

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
      if (returnPolicy !== undefined) updates.returnPolicy = returnPolicy && returnPolicy.trim() ? returnPolicy.trim() : null;
      if (metaTitle !== undefined) updates.metaTitle = metaTitle && metaTitle.trim() ? metaTitle.trim() : null;
      if (metaDescription !== undefined) updates.metaDescription = metaDescription && metaDescription.trim() ? metaDescription.trim() : null;
      if (requiresMeasurements !== undefined) updates.requiresMeasurements = requiresMeasurements === true || requiresMeasurements === 'true';
      if (tags !== undefined) {
        try {
          updates.tags = z.array(z.string().trim().min(1).max(60)).max(30).parse(typeof tags === 'string' ? JSON.parse(tags) : tags);
        } catch {
          return res.status(400).json({ message: 'Tags must be a valid list of up to 30 keywords' });
        }
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
    const uploadHandler = isCloudStorageEnabled() ? upload.array('images', 10) : localUpload.array('images', 10);
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
          if (isCloudStorageEnabled()) {
            const cloudStorage = getCloudStorageService();
            newImageUrls = await Promise.all(files.map(f => cloudStorage.uploadImage(f.buffer, f.mimetype, 'products')));
          } else {
            for (const file of files) {
              if (file.filename) {
                newImageUrls.push(`/uploads/${file.filename}`);
              } else if (file.buffer) {
                const fsMod = await import('fs');
                const pathMod = await import('path');
                const sharpMod = await import('sharp');
                const uploadDir = pathMod.join(process.cwd(), 'uploads', 'products');
                if (!fsMod.existsSync(uploadDir)) fsMod.mkdirSync(uploadDir, { recursive: true });
                const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
                const optimized = await sharpMod.default(file.buffer)
                  .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                  .jpeg({ quality: 85, progressive: true }).toBuffer();
                fsMod.writeFileSync(pathMod.join(uploadDir, filename), optimized);
                newImageUrls.push(`/uploads/${filename}`);
              }
            }
          }
        } catch (uploadErr: any) {
          // Fallback to local
          const fs = await import('fs');
          const path = await import('path');
          const sharp = await import('sharp');
          newImageUrls = [];
          for (const file of files) {
            const uploadDir = path.join(process.cwd(), 'uploads', 'products');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
            const optimized = await sharp.default(file.buffer || Buffer.alloc(0))
              .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 85, progressive: true }).toBuffer();
            fs.writeFileSync(path.join(uploadDir, filename), optimized);
            newImageUrls.push(`/uploads/${filename}`);
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

  app.patch('/api/products/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { status } = req.body;
      if (!Number.isSafeInteger(productId)) return res.status(400).json({ message: 'Invalid product ID' });
      if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid product status' });
      if (!await storage.getProduct(productId)) return res.status(404).json({ message: 'Product not found' });
      await storage.updateProductStatus(productId, status);
      res.json({ message: 'Product status updated' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update product status' });
    }
  });

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

  app.patch('/api/products/:id/featured', isAuthenticated, isAdmin, async (req, res) => {
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
  app.post('/api/cart', isAuthenticated, async (req: any, res) => {
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
      } else {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Failed to add to cart' });
      }
    }
  });

  app.get('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const cartItems = await storage.getCartItems(userId);
      res.json(cartItems);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch cart items' });
    }
  });

  app.patch('/api/cart/:id', isAuthenticated, async (req: any, res) => {
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

  app.delete('/api/cart/:id', isAuthenticated, async (req: any, res) => {
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

  app.delete('/api/cart', isAuthenticated, async (req: any, res) => {
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
      res.json(SHIPPING_QUOTES.map(quote => ({ ...quote, currency: 'NGN' })));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch shipping quotes' });
    }
  });

  // Initialize Paystack payment
  app.post('/api/orders/initialize-payment', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const shippingAddress = shippingAddressSchema.parse(req.body.shippingAddress);
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

      const cartItems = await storage.getCartItems(userId);
      if (cartItems.length === 0) return res.status(400).json({ message: 'Your cart is empty' });
      let checkoutTotal: ReturnType<typeof calculateCheckoutTotal>;
      try {
        checkoutTotal = calculateCheckoutTotal(cartItems, shippingMethod);
      } catch (error) {
        if (error instanceof CheckoutValidationError) {
          return res.status(409).json({ message: error.message });
        }
        throw error;
      }
      const { totalAmount } = checkoutTotal;

      const reference = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Create order with pending payment (total stored in NGN)
      const orderData = {
        userId,
        totalAmount: totalAmount.toFixed(2),
        shippingAmount: shippingQuote.price.toFixed(2),
        shippingAddress,
        shippingMethod,
        paymentStatus: 'pending',
        orderStatus: 'pending',
        paymentReference: reference
      };

      const order = await storage.createOrder(orderData);

      for (const item of cartItems) {
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtTime: item.product.price,
          selectedSize: item.selectedSize ?? null,
        });
      }

      // Initialize Paystack payment in buyer's currency
      const paystack = getPaystackService();
      const callbackUrl = `${req.protocol}://${req.get('host')}/api/payment/callback`;

      const metadata = {
        orderId: order.id,
        userId,
        shippingMethod,
        custom_fields: [
          { display_name: 'Order ID', variable_name: 'order_id', value: order.id.toString() },
        ],
      };

      const paymentData = await paystack.initializeTransaction(
        user.email, totalAmount, reference,
        metadata, callbackUrl, 'NGN'
      );

      res.json({
        order,
        paymentUrl: paymentData.data.authorization_url,
        reference: paymentData.data.reference,
      });
    } catch (error) {
      console.error('Error initializing payment:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'A complete, valid shipping address is required' });
      res.status(500).json({ message: 'Failed to initialize payment. Please try again.' });
    }
  });

  // Payment verification and completion endpoint
  app.post('/api/orders/verify-payment', isAuthenticated, async (req: any, res) => {
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

      res.json({ 
        success: true, 
        orderId: order.id,
        alreadyProcessed: !newlyCompleted,
        message: 'Payment verified and order confirmed',
      });
    } catch (error) {
      console.error('Error verifying payment:', error);
      res.status(500).json({ message: 'Failed to verify payment' });
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
      const mismatch = paymentVerificationError(order, verificationResult, paymentReference);
      if (mismatch) return res.redirect('/checkout?error=payment_verification_failed');
      await completeVerifiedOrder(order, paymentReference);

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

      const orderItems = await storage.getOrderItemsWithProducts(orderId);
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor || vendor.status !== 'approved') {
        return res.status(403).json({ message: 'Access denied: Approved vendor account required' });
      }
      if (order.paymentStatus !== 'paid') return res.status(409).json({ message: 'Order payment has not been confirmed' });
      const allowedNextStatus: Record<string, string> = { pending: 'processing', processing: 'shipped', shipped: 'delivered' };
      if (allowedNextStatus[order.orderStatus || ''] !== status) {
        return res.status(409).json({ message: `Order cannot move from ${order.orderStatus} to ${status}` });
      }

      let vendorOwnsItems = false;
      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        if (product?.vendorId === vendor.id) {
          vendorOwnsItems = true;
          break;
        }
      }

      if (!vendorOwnsItems) {
        return res.status(403).json({ message: 'Access denied: You can only update orders containing your products' });
      }

      // Update order status
      await storage.updateOrderStatus(orderId, status);

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
          notificationMessage = `Great news! Your order #${orderId} has been shipped by ${vendor.businessName}. It should arrive soon.`;
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
        });
      }

      res.json({ message: 'Order status updated successfully' });
    } catch (error) {
      console.error('Error updating order status:', error);
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
      // Enrich each order with items + product details
      const enriched = await Promise.all(orders.map(async (order) => {
        const rawItems = await storage.getOrderItemsWithProducts(order.id);
        const items = await Promise.all(rawItems.map(async (item) => {
          const product = await storage.getProduct(item.productId);
          const vendor = product ? await storage.getVendor(product.vendorId) : null;
          return {
            ...item,
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

  app.get('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId !== userId) return res.status(404).json({ message: 'Order not found' });
      // Return with items
      const rawItems = await storage.getOrderItemsWithProducts(orderId);
      const items = await Promise.all(rawItems.map(async (item) => {
        const product = await storage.getProduct(item.productId);
        const vendor = product ? await storage.getVendor(product.vendorId) : null;
        return {
          ...item,
          productName: product?.name || 'Product',
          productImage: (product?.images as string[])?.[0] || product?.imageUrl || null,
          vendorName: vendor?.businessName || 'Unknown Vendor',
        };
      }));
      res.json({ ...order, items });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch order' });
    }
  });

  // Customer: cancel own order (only if pending or processing)
  app.patch('/api/orders/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.userId !== userId) return res.status(403).json({ message: 'Forbidden' });
      if (!['pending', 'processing'].includes(order.orderStatus || '')) {
        return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
      }
      await storage.updateOrderStatus(orderId, 'cancelled');
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
        const mismatch = paymentVerificationError(order, verification, reference);
        if (mismatch) return res.status(200).json({ message: 'Webhook ignored' });
        await completeVerifiedOrder(order, reference);
      }

      res.status(200).json({ message: 'Webhook received' });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // Vendor order tracking - simplified implementation using storage methods
  app.get('/api/vendors/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }

      // Get all vendor products to filter orders
      const vendorProducts = await storage.getProducts({ vendorId: vendor.id });
      const vendorProductIds = vendorProducts.map(p => p.id);

      if (vendorProductIds.length === 0) {
        return res.json([]);
      }

      // Get all orders and filter for vendor-relevant ones
      const allOrders = await storage.getAllOrders();
      const vendorOrders = [];

      for (const order of allOrders) {
        const orderItems = await storage.getOrderItemsWithProducts(order.id);
        const vendorItems = orderItems.filter(item => vendorProductIds.includes(item.productId));
        
        if (vendorItems.length > 0) {
          const customer = await storage.getUser(order.userId);
          const vendorTotal = vendorItems.reduce((sum, item) => 
            sum + (parseFloat(item.priceAtTime) * item.quantity), 0
          );

          vendorOrders.push({
            ...order,
            items: vendorItems,
            customer: {
              firstName: customer?.firstName,
              lastName: customer?.lastName,
              email: customer?.email,
            },
            vendorTotal
          });
        }
      }

      res.json(vendorOrders);
    } catch (error) {
      console.error('Error fetching vendor orders:', error);
      res.status(500).json({ message: 'Failed to fetch vendor orders' });
    }
  });

  // Admin order tracking - simplified implementation using storage methods
  app.get('/api/admin/orders', isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Get all orders using storage method
      const allOrders = await storage.getAllOrders();
      
      const ordersWithDetails = await Promise.all(
        allOrders.map(async (order) => {
          const items = await storage.getOrderItemsWithProducts(order.id);
          const customer = await storage.getUser(order.userId);

          // Get vendor details for each item
          const itemsWithVendors = await Promise.all(
            items.map(async (item) => {
              const product = await storage.getProduct(item.productId);
              const vendor = product ? await storage.getVendor(product.vendorId) : null;
              return {
                ...item,
                vendorName: vendor?.businessName || 'Unknown Vendor'
              };
            })
          );

          return {
            ...order,
            items: itemsWithVendors,
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

  // Shipping quotes (mock implementation)
  app.post('/api/shipping/quote', async (req, res) => {
    try {
      const { destination, weight } = req.body;

      // Mock shipping rates (in production, integrate with actual APIs)
      const quotes = [
        {
          carrier: 'UPS',
          service: 'UPS Worldwide Express',
          price: 5000,
          duration: '5-7 business days',
        },
        {
          carrier: 'FedEx',
          service: 'FedEx International Priority',
          price: 6500,
          duration: '3-5 business days',
        },
        {
          carrier: 'DHL',
          service: 'DHL Express Worldwide',
          price: 8000,
          duration: '2-4 business days',
        },
      ];

      res.json(quotes);
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

      const stats = {
        totalVendors: vendors.length,
        totalProducts: products.length,
        pendingApprovals: pendingProducts.length,
        approvedVendors: vendors.filter(v => v.status === 'approved').length,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch admin stats' });
    }
  });

  // Admin: update order fulfillment status with automatic notifications
  app.patch('/api/admin/orders/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;
      const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      await storage.updateOrderStatus(orderId, status);

      // Automatically notify the customer when status changes
      const statusMessages: Record<string, { title: string; message: string }> = {
        processing: {
          title: '🔄 Order Being Processed',
          message: `Great news! Your Order #${orderId} is now being processed by our vendors.`,
        },
        shipped: {
          title: '🚚 Order Shipped!',
          message: `Your Order #${orderId} has been shipped and is on its way to you. Expected delivery: 3–5 business days.`,
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

      // Revenue metrics
      const paidOrders = allOrders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'completed');
      const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount as string || '0'), 0);
      const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

      // Orders by status
      const ordersByStatus = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => ({
        status,
        count: allOrders.filter(o => o.orderStatus === status).length,
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
      const vendorPerformance = await Promise.all(allVendors.filter(v => v.status === 'approved').map(async v => {
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
      for (const o of allOrders) {
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
        totalOrders: allOrders.length,
        paidOrders: paidOrders.length,
        fulfillmentRate: allOrders.length > 0 ? Math.round((allOrders.filter(o => o.orderStatus === 'delivered').length / allOrders.length) * 100) : 0,
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
      res.json({ 
        message: 'Cloud storage reinitialization completed',
        cloudStorageEnabled: isEnabled,
        status: isEnabled ? 'AWS credentials refreshed successfully' : 'Cloud storage not available - check credentials'
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
      
      res.json({
        cloudStorageEnabled: isEnabled,
        hasCredentials,
        awsRegion: process.env.AWS_REGION || 'us-east-1',
        bucketName: process.env.AWS_S3_BUCKET || 'Not configured',
        hasSessionToken: !!process.env.AWS_SESSION_TOKEN,
        status: isEnabled ? 'Active' : (hasCredentials ? 'Credentials may be expired' : 'Not configured')
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

  app.post('/api/chat', async (req, res) => {
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
      
      const { occasionId, eventType, budget, styleNotes } = req.body;
      
      // Get available products
      const allProducts = await storage.getProducts({ status: 'approved' });
      
      // Use AI to generate adaptive outfit recommendations
      const chatbotService = getChatbotService();
      const productCatalog = allProducts.slice(0, 30).map(p => ({
        id: p.id,
        name: p.name,
        price: `$${p.price}`,
        categoryId: p.categoryId,
        description: p.description?.substring(0, 80) || '',
      }));

      const prompt = `You are an expert African fashion stylist for Afrolandx. Create a personalised outfit selection.

USER REQUEST:
${styleNotes ? `"${styleNotes}"` : '(no description provided)'}
Event Type: ${eventType || 'general'}
Budget: ${budget ? `up to $${budget}` : 'no budget limit'}

AVAILABLE PRODUCTS:
${JSON.stringify(productCatalog)}

INSTRUCTIONS:
- Select 3-5 products that work together as a complete, cohesive outfit
- Prioritise products that best match the user's description and occasion
- Stay within budget if specified
- Write a specific, encouraging reason for each pick (mention colours, occasion fit, or cultural significance)
- Return ONLY a valid JSON array, no other text:
[{"productId": <number>, "reason": "<specific reason why this fits the request>"}]`;
      
      let bundleItems: any[] = [];
      try {
        const aiResponse = await chatbotService.generateResponse([{ role: 'user', content: prompt }]);
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          bundleItems = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('AI lookbook generation failed, using fallback:', e);
      }

      // Fallback: pick first 4 products if AI returned nothing
      if (bundleItems.length === 0) {
        bundleItems = allProducts.slice(0, 4).map(p => ({ productId: p.id, reason: 'Recommended for you' }));
      }
      
      // Enhance bundle items with product details
      const enhancedItems = await Promise.all(bundleItems.map(async (item: any) => {
        const product = await storage.getProduct(item.productId);
        if (!product) return null;
        const imageUrl = (Array.isArray(product.images) && product.images[0]) || product.imageUrl || null;
        return { ...item, name: product.name, price: product.price, imageUrl };
      }));
      
      const filteredItems = enhancedItems.filter(Boolean);
      const totalPrice = filteredItems.reduce((sum, item: any) => sum + parseFloat(item.price || '0'), 0);
      
      const lookbook = await storage.createLookbookRecommendation({
        userId,
        occasionId,
        bundleItems: filteredItems,
        totalPrice: totalPrice.toString(),
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
      const id = parseInt(req.params.id);
      await storage.updateLookbookStatus(id, 'accepted');
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

  app.post('/api/orders/:orderId/feedback', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const orderId = parseInt(req.params.orderId);
      const { productId, fitRating, alterationNeeded, alterationDetails, overallRating, comment } = req.body;
      
      const feedback = await storage.createOrderFeedback({
        orderId,
        productId,
        userId,
        fitRating,
        alterationNeeded,
        alterationDetails,
        overallRating,
        comment,
      });
      
      // Award loyalty points for leaving a review
      await storage.addLoyaltyPoints(userId, 50, 'review', 'Points for leaving a product review', orderId, 'order');
      
      res.status(201).json(feedback);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ message: 'Failed to submit feedback' });
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
      const drops = await storage.getCollabDrops(status as string);
      
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
      const drop = await storage.getCollabDrop(id);
      
      if (!drop) return res.status(404).json({ message: 'Drop not found' });
      
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
  app.post('/api/collab-drops/ai-suggest', async (req, res) => {
    try {
      const { query } = req.body as { query: string };
      if (!query || query.trim().length < 3) {
        return res.status(400).json({ message: 'Please provide a search query.' });
      }

      const allDrops = await storage.getCollabDrops();
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
        return res.json(parsed);
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
      if (!vendor) return res.status(403).json({ message: 'Not a vendor' });
      
      const drop = await storage.createCollabDrop({ ...req.body, designerId: vendor.id });
      res.status(201).json(drop);
    } catch (error) {
      console.error('Error creating collab drop:', error);
      res.status(500).json({ message: 'Failed to create drop' });
    }
  });

  app.post('/api/collab-drops/:id/rsvp', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const dropId = parseInt(req.params.id);
      const drop = await storage.getCollabDrop(dropId);
      
      if (!drop) return res.status(404).json({ message: 'Drop not found' });
      
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
  app.get('/api/places/search', async (req, res) => {
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
  app.get('/api/places/:osmType/:osmId', async (req, res) => {
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

  // Fix products whose images use CDNs that block hotlinking (Amazon, Pinterest, Jumia).
  // Runs silently on startup; no-ops once all images are already on allowlisted hosts.
  (async () => {
    const BLOCKED_IMAGE_DOMAINS = ['amazon.com', 'pinimg.com', 'jumia.is'];
    const BROKEN_URL_PATTERNS = ['share.google', 'drive.google', 'docs.google'];
    const AGBADA_RELIABLE = 'https://www.abbiexpress.com/cdn/shop/files/abbiexpress-african-s-men-s-wear-m-african-men-agbada-embroidery-45379580789035.jpg?v=1717126713&width=1946';
    try {
      const all = await storage.getProducts();
      for (const p of all) {
        // 1. Clear broken imageUrl values (Google share links etc.) that shadow the images[] array
        if (p.imageUrl && BROKEN_URL_PATTERNS.some(pat => p.imageUrl!.includes(pat))) {
          await db.update(products).set({ imageUrl: null } as any).where(eq(products.id, p.id));
          console.log(`[img-fix] Cleared bad imageUrl for product #${p.id} "${p.name}"`);
        }
        // 2. Replace images[] that use CDNs which block hotlinking
        if (!Array.isArray(p.images)) continue;
        const hasBlocked = p.images.some((u): u is string =>
          typeof u === 'string' && BLOCKED_IMAGE_DOMAINS.some(d => u.includes(d))
        );
        if (!hasBlocked) continue;
        await storage.updateProductImages(p.id, [AGBADA_RELIABLE]);
        console.log(`[img-fix] Updated images for product #${p.id} "${p.name}" to reliable CDN`);
      }
    } catch (e) {
      console.error('[img-fix] error:', e);
    }
  })();

  // Seed event_collections and collab_drops tables if empty.
  // Safe to re-run: checks row count before inserting.
  (async () => {
    try {
      const existingCollections = await storage.getEventCollections();
      if (existingCollections.length === 0) {
        const collections = [
          {
            name: 'Royal Agbada Wedding Set',
            eventType: 'wedding',
            description: 'A full matching Agbada ensemble for groom, groomsmen and family – rich embroidery, flowing fabric, timeless royalty.',
            productIds: [1, 3, 4, 5],
            familyGrouping: 'groomsmen',
            genderTarget: 'male',
            priceRange: { min: 120, max: 500 },
            featured: true,
          },
          {
            name: 'Coral Beads Bridal Package',
            eventType: 'wedding',
            description: 'Authentic Benin coral bead sets for the bride, mothers and bridal party – the ultimate symbol of grace and heritage.',
            productIds: [6, 7, 8, 9],
            familyGrouping: 'bridal_party',
            genderTarget: 'female',
            priceRange: { min: 80, max: 350 },
            featured: true,
          },
          {
            name: 'Festival Aso-Ebi Collection',
            eventType: 'festival',
            description: 'Vibrant coordinated Aso-Ebi outfits for cultural festivals – bring your entire family group together in colour and style.',
            productIds: [3, 4, 8, 9, 10],
            familyGrouping: 'family',
            genderTarget: 'unisex',
            priceRange: { min: 60, max: 280 },
            featured: false,
          },
          {
            name: 'Naming Ceremony Welcome Set',
            eventType: 'naming_ceremony',
            description: 'Elegant attire for parents and grandparents celebrating the arrival of a new life – soft tones, cultural pride.',
            productIds: [4, 5, 6, 7],
            familyGrouping: 'family',
            genderTarget: 'unisex',
            priceRange: { min: 50, max: 200 },
            featured: false,
          },
          {
            name: 'Chieftaincy Title Regalia',
            eventType: 'chieftaincy',
            description: 'Full ceremonial regalia for a chieftaincy installation – commanding presence, intricate hand-embroidery, authentic beadwork.',
            productIds: [1, 6, 7],
            familyGrouping: 'couple',
            genderTarget: 'unisex',
            priceRange: { min: 200, max: 800 },
            featured: true,
          },
        ] as const;
        for (const col of collections) {
          await storage.createEventCollection(col as any);
        }
        console.log(`[seed] Inserted ${collections.length} event collections`);
      }

      const existingDrops = await storage.getCollabDrops();
      if (existingDrops.length === 0) {
        const now = new Date();
        const drops = [
          {
            designerId: 1,
            artisanId: null,
            name: 'Adire x Ankara: The Lagos Drop',
            description: 'A groundbreaking fusion of hand-dyed Adire and modern Ankara prints — only 50 pieces available. RSVP to secure your spot when the drop goes live.',
            dropStartTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            dropEndTime: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
            rsvpCap: 50,
            rsvpCount: 12,
            productIds: [3, 4],
            status: 'upcoming',
            isExclusive: false,
            minLoyaltyTier: null,
            coverImage: 'https://www.abbiexpress.com/cdn/shop/files/abbiexpress-african-s-men-s-wear-m-african-men-agbada-embroidery-45379580789035.jpg?v=1717126713&width=1946',
          },
          {
            designerId: 1,
            artisanId: null,
            name: 'Gold & Coral: Heritage Edition',
            description: 'Live now — our most celebrated collaboration featuring 24-carat gold thread Agbada paired with authentic Benin coral bead accessories. Strictly limited.',
            dropStartTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // started 2h ago
            dropEndTime: new Date(now.getTime() + 22 * 60 * 60 * 1000),
            rsvpCap: 30,
            rsvpCount: 28,
            productIds: [1, 6, 7],
            status: 'live',
            isExclusive: true,
            minLoyaltyTier: 'silver',
            coverImage: 'https://www.abbiexpress.com/cdn/shop/files/abbiexpress-african-s-men-s-wear-m-african-men-agbada-embroidery-45379580789035.jpg?v=1717126713&width=1946',
          },
          {
            designerId: 1,
            artisanId: null,
            name: 'Ekiti Indigo Summer Series',
            description: 'Upcoming drop — hand-spun indigo from Ekiti artisans reimagined for the modern wardrobe. Set your reminder now.',
            dropStartTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
            dropEndTime: new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000),
            rsvpCap: 100,
            rsvpCount: 5,
            productIds: [5, 9, 10],
            status: 'upcoming',
            isExclusive: false,
            minLoyaltyTier: null,
            coverImage: 'https://www.abbiexpress.com/cdn/shop/files/abbiexpress-african-s-men-s-wear-m-african-men-agbada-embroidery-45379580789035.jpg?v=1717126713&width=1946',
          },
        ];
        for (const drop of drops) {
          await storage.createCollabDrop(drop as any);
        }
        console.log(`[seed] Inserted ${drops.length} collab drops`);
      }
    } catch (e) {
      console.error('[seed] error:', e);
    }
  })();

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
      const { status } = req.body;
      if (!['pending', 'reviewed', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      await db.update(discoverInquiries).set({ status }).where(eq(discoverInquiries.id, id));
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
  app.post('/api/discover/inquiries', async (req, res) => {
    try {
      const { discoverInquiries } = await import('@shared/schema');
      const { db } = await import('./db');
      const { type, name, email, phone, details } = req.body;
      if (!type || !name || !email) {
        return res.status(400).json({ message: 'type, name and email are required' });
      }
      const [inquiry] = await db.insert(discoverInquiries).values({ type, name, email, phone, details, status: 'pending' }).returning();
      res.json({ success: true, inquiry });
    } catch (err) {
      console.error('[discover/inquiries]', err);
      res.status(500).json({ message: 'Failed to save inquiry' });
    }
  });

  // Initialize a deal booking + Paystack payment
  app.post('/api/discover/bookings/initialize', async (req: any, res) => {
    try {
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured.' });
      const { discoverBookings } = await import('@shared/schema');
      const { db } = await import('./db');
      const { dealTitle, dealType, guestName, guestEmail, guestCount, bookingDate, totalAmountNgn } = req.body;
      if (!dealTitle || !guestEmail || !guestName || !bookingDate || !totalAmountNgn) {
        return res.status(400).json({ message: 'Missing required booking fields' });
      }
      const reference = `discover_booking_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`;
      const [booking] = await db.insert(discoverBookings).values({
        userId: req.user?.id || null,
        dealTitle, dealType, guestName, guestEmail,
        guestCount: parseInt(guestCount) || 1,
        bookingDate, totalAmountNgn: parseInt(totalAmountNgn),
        paymentReference: reference, paymentStatus: 'pending',
      }).returning();
      const paystack = getPaystackService();
      const callbackUrl = `${req.protocol}://${req.get('host')}/discover?booking_ref=${reference}`;
      const txn = await paystack.initializeTransaction(
        guestEmail,
        parseInt(totalAmountNgn),
        reference,
        { bookingId: booking.id, dealTitle, guestName },
        callbackUrl,
        'NGN'
      );
      res.json({ success: true, bookingId: booking.id, authorizationUrl: txn.data.authorization_url, reference });
    } catch (err) {
      console.error('[discover/bookings/initialize]', err);
      res.status(500).json({ message: 'Failed to initialize booking payment' });
    }
  });

  // Initialize Premium subscription payment
  app.post('/api/discover/premium/initialize', async (req: any, res) => {
    try {
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured.' });
      const { discoverPremium } = await import('@shared/schema');
      const { db } = await import('./db');
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email required' });
      const reference = `discover_premium_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`;
      const now = new Date();
      const monthLater = new Date(now); monthLater.setMonth(monthLater.getMonth() + 1);
      const [sub] = await db.insert(discoverPremium).values({
        userId: req.user?.id || null,
        guestEmail: email,
        paymentReference: reference,
        paymentStatus: 'pending',
        subscriptionStart: now,
        subscriptionEnd: monthLater,
      }).returning();
      const paystack = getPaystackService();
      const callbackUrl = `${req.protocol}://${req.get('host')}/discover?premium_ref=${reference}`;
      const txn = await paystack.initializeTransaction(
        email,
        2500, // ₦2,500 face value (function converts to kobo)
        reference,
        { subscriptionId: sub.id, plan: 'Explorer Premium Monthly' },
        callbackUrl,
        'NGN'
      );
      res.json({ success: true, subscriptionId: sub.id, authorizationUrl: txn.data.authorization_url, reference });
    } catch (err) {
      console.error('[discover/premium/initialize]', err);
      res.status(500).json({ message: 'Failed to initialize premium payment' });
    }
  });

  // Verify discover payment (booking or premium)
  app.post('/api/discover/payment/verify', async (req, res) => {
    try {
      if (!isPaystackInitialized()) return res.status(503).json({ message: 'Payment service not configured.' });
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ message: 'reference required' });
      const paystack = getPaystackService();
      const verification = await paystack.verifyTransaction(reference);
      if (verification.data.status !== 'success') {
        return res.status(400).json({ message: 'Payment not successful', status: verification.data.status });
      }
      const { discoverBookings, discoverPremium } = await import('@shared/schema');
      const { db } = await import('./db');
      const { eq } = await import('drizzle-orm');
      if (reference.includes('booking')) {
        await db.update(discoverBookings).set({ paymentStatus: 'paid' }).where(eq(discoverBookings.paymentReference, reference));
      } else if (reference.includes('premium')) {
        await db.update(discoverPremium).set({ paymentStatus: 'active' }).where(eq(discoverPremium.paymentReference, reference));
      }
      res.json({ success: true, status: 'paid' });
    } catch (err) {
      console.error('[discover/payment/verify]', err);
      res.status(500).json({ message: 'Verification failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
