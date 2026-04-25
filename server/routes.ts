import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { getPaystackService, isPaystackInitialized } from "./paystack";
import { getChatbotService } from "./chatbot";
import { initiateScan, getScanResults, getServiceStatus } from "./bodyscan";
import { insertVendorSchema, insertProductSchema, insertCartItemSchema, insertOrderSchema, insertMeasurementSchema, insertMessageSchema, orders, orderItems, products, vendors } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { getCloudStorageService, isCloudStorageEnabled, reinitializeCloudStorage } from "./cloudStorage";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

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
    const filePath = path.join(process.cwd(), 'uploads', 'products', filename);
    
    if (fs.existsSync(filePath)) {
      try {
        const { imageProcessor } = await import('./imageProcessor');
        
        // Get optimization parameters from query
        const width = req.query.w ? parseInt(req.query.w as string) : 800;
        const height = req.query.h ? parseInt(req.query.h as string) : 800;
        const quality = req.query.q ? parseInt(req.query.q as string) : 85;
        const format = (req.query.f as string) || 'jpeg';
        
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
    const filePath = path.join(process.cwd(), 'uploads', 'products', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Image not found' });
    }

    try {
      const { imageProcessor } = await import('./imageProcessor');
      
      // Parse optimization parameters
      const width = req.query.w ? parseInt(req.query.w as string) : undefined;
      const height = req.query.h ? parseInt(req.query.h as string) : undefined;
      const quality = req.query.q ? parseInt(req.query.q as string) : 85;
      const format = (req.query.f as string) || 'jpeg';
      
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

      if (!geoRes.ok) return res.json({ error: 'geo_unavailable' });
      const data = await geoRes.json() as any;

      res.json({
        country_code: data.country_code,
        country_name: data.country_name,
        currency: data.currency,
        currency_name: data.currency_name,
      });
    } catch {
      res.json({ error: 'geo_unavailable' });
    }
  });

  // Exchange rates proxy
  app.get('/api/exchange-rates', async (_req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=3600');
      const rRes = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(5000),
      });
      if (!rRes.ok) return res.json({ error: 'rates_unavailable' });
      const data = await rRes.json() as any;
      res.json({ rates: data.rates });
    } catch {
      res.json({ error: 'rates_unavailable' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
      
      res.json(updatedUser);
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

  // Admin user management routes
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
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
        { name: 'Traditional Wear', slug: 'traditional-wear', description: 'Authentic Nigerian traditional clothing' },
        { name: 'Aso Oke', slug: 'aso-oke', description: 'Handwoven traditional fabrics' },
        { name: 'Beads & Jewelry', slug: 'beads-jewelry', description: 'Traditional Nigerian beads and jewelry' },
        { name: 'Accessories', slug: 'accessories', description: 'Fashion accessories and items' },
      ];

      const categories = [];
      for (const cat of defaultCategories) {
        const category = await storage.createCategory(cat);
        categories.push(category);
      }

      res.json({ message: 'Categories initialized', categories });
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
      const vendorData = insertVendorSchema.parse({
        ...req.body,
        userId,
      });

      // Add vendor role to user
      await storage.addUserRole(userId, 'vendor');

      const vendor = await storage.createVendor(vendorData);
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

  app.get('/api/vendors', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const vendors = await storage.getAllVendors();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch vendors' });
    }
  });

  app.get('/api/vendors/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const vendor = await storage.getVendorByUserId(userId);
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch vendor info' });
    }
  });

  app.patch('/api/vendors/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const vendorId = parseInt(req.params.id);
      const { status } = req.body;

      await storage.updateVendorStatus(vendorId, status);
      res.json({ message: 'Vendor status updated' });
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
        if (!req.body.name || !req.body.description || !req.body.price || !req.body.stock || !req.body.categoryId) {
          return res.status(400).json({ 
            message: 'Missing required fields', 
            required: ['name', 'description', 'price', 'stock', 'categoryId'] 
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
              // Cloud storage disabled — save from memory buffer to disk
              const fsMod = await import('fs');
              const pathMod = await import('path');
              const sharpMod = await import('sharp');
              const uploadDir = pathMod.join(process.cwd(), 'uploads', 'products');
              if (!fsMod.existsSync(uploadDir)) fsMod.mkdirSync(uploadDir, { recursive: true });

              for (const file of files) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = `product-${uniqueSuffix}.jpg`;
                const filepath = pathMod.join(uploadDir, filename);
                const optimizedBuffer = await sharpMod.default(file.buffer)
                  .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                  .jpeg({ quality: 85, progressive: true })
                  .toBuffer();
                fsMod.writeFileSync(filepath, optimizedBuffer);
                imageUrls.push(`/uploads/${filename}`);
              }
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

        const productData = {
          name: req.body.name.trim(),
          description: req.body.description.trim(),
          price: req.body.price,
          stock: parseInt(req.body.stock),
          categoryId: parseInt(req.body.categoryId),
          weight: req.body.weight && req.body.weight.trim() ? req.body.weight.trim() : undefined,
          imageUrl: req.body.imageUrl && req.body.imageUrl.trim() ? req.body.imageUrl.trim() : undefined,
          images: imageUrls,
          vendorId: req.vendor.id,
        };

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
        status = 'approved', 
        categoryId, 
        vendorId, 
        featured, 
        search, 
        minPrice, 
        maxPrice 
      } = req.query;
      
      const filters: any = { status };
      if (categoryId) filters.categoryId = parseInt(categoryId as string);
      if (vendorId) filters.vendorId = parseInt(vendorId as string);
      if (featured) filters.featured = featured === 'true';
      if (search) filters.search = search as string;
      if (minPrice) filters.minPrice = parseFloat(minPrice as string);
      if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);

      const products = await storage.getProducts(filters);
      res.json(products);
    } catch (error) {
      console.error('Products error:', error);
      res.status(500).json({ message: 'Failed to fetch products' });
    }
  });

  app.get('/api/products/with-details', async (req, res) => {
    try {
      const products = await storage.getProductsWithVendor();
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
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch product' });
    }
  });

  app.patch('/api/products/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const { status } = req.body;

      await storage.updateProductStatus(productId, status);
      res.json({ message: 'Product status updated' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update product status' });
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

  app.patch('/api/cart/:id', isAuthenticated, async (req, res) => {
    try {
      const cartItemId = parseInt(req.params.id);
      const { quantity } = req.body;

      await storage.updateCartItemQuantity(cartItemId, quantity);
      res.json({ message: 'Cart item updated' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update cart item' });
    }
  });

  app.delete('/api/cart/:id', isAuthenticated, async (req, res) => {
    try {
      const cartItemId = parseInt(req.params.id);
      await storage.removeFromCart(cartItemId);
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
      // Return available shipping methods for Nigeria
      const shippingQuotes = [
        {
          carrier: 'UPS',
          service: 'UPS Standard',
          price: 2500,
          duration: '3-5 business days'
        },
        {
          carrier: 'FedEx',
          service: 'FedEx Express',
          price: 3000,
          duration: '2-3 business days'
        },
        {
          carrier: 'DHL',
          service: 'DHL Express',
          price: 3500,
          duration: '1-2 business days'
        }
      ];
      res.json(shippingQuotes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch shipping quotes' });
    }
  });

  // Initialize Paystack (when secret key is provided)
  app.post('/api/paystack/initialize', isAuthenticated, async (req: any, res) => {
    try {
      const { secretKey } = req.body;
      
      if (!secretKey) {
        return res.status(400).json({ message: 'Paystack secret key required' });
      }

      // Initialize Paystack service
      const { initializePaystack } = await import('./paystack');
      initializePaystack(secretKey);
      
      res.json({ message: 'Paystack initialized successfully' });
    } catch (error) {
      console.error('Error initializing Paystack:', error);
      res.status(500).json({ message: 'Failed to initialize Paystack' });
    }
  });

  // Initialize Paystack payment
  app.post('/api/orders/initialize-payment', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const { totalAmount, shippingAmount, shippingAddress, shippingMethod } = req.body;

      if (!isPaystackInitialized()) {
        return res.status(503).json({ message: 'Payment service not configured. Please contact administrator.' });
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(400).json({ message: 'User email required for payment' });
      }

      // Generate payment reference
      const reference = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      // Create order with pending payment
      const orderData = {
        userId,
        totalAmount,
        shippingAmount: shippingAmount || '0',
        shippingAddress,
        shippingMethod,
        paymentStatus: 'pending',
        orderStatus: 'pending',
        paymentReference: reference
      };

      const order = await storage.createOrder(orderData);

      // Create order items from cart
      const cartItems = await storage.getCartItems(userId);
      for (const item of cartItems) {
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtTime: item.product.price,
        });
      }

      // Initialize Paystack payment
      const paystack = getPaystackService();
      const callbackUrl = `${req.protocol}://${req.get('host')}/api/payment/callback`;
      const paymentData = await paystack.initializeTransaction(
        user.email,
        parseFloat(totalAmount),
        reference,
        {
          orderId: order.id,
          userId,
          shippingMethod,
          custom_fields: [
            {
              display_name: "Order ID",
              variable_name: "order_id",
              value: order.id.toString()
            }
          ]
        },
        callbackUrl
      );

      res.json({
        order,
        paymentUrl: paymentData.data.authorization_url,
        reference: paymentData.data.reference
      });
    } catch (error) {
      console.error('Error initializing payment:', error);
      res.status(500).json({ message: 'Failed to initialize payment' });
    }
  });

  // Payment verification and completion endpoint
  app.post('/api/orders/verify-payment', isAuthenticated, async (req: any, res) => {
    try {
      const { reference } = req.body;
      const userId = (req.user as any)?.id;

      if (!isPaystackInitialized()) {
        return res.status(503).json({ message: 'Payment service not configured' });
      }

      // Verify payment with Paystack
      const paystack = getPaystackService();
      const verificationResult = await paystack.verifyTransaction(reference);

      if (!verificationResult.status || verificationResult.data.status !== 'success') {
        return res.status(400).json({ message: 'Payment verification failed' });
      }

      // Find order by payment reference
      const orders = await storage.getOrdersForUser(userId);
      const order = orders.find(o => o.paymentReference === reference);

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Update order status
      await storage.updatePaymentStatus(order.id, 'completed', reference);
      await storage.updateOrderStatus(order.id, 'confirmed');

      // Clear user's cart
      await storage.clearCart(userId);

      // Get order items for stock reduction and notifications
      const orderItems = await storage.getOrderItemsWithProducts(order.id);
      
      // Reduce stock for each purchased item
      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        if (product && product.stock >= item.quantity) {
          await storage.updateProductStock(item.productId, product.stock - item.quantity);
        }
      }
      
      // Notify vendors and admins
      const notifiedVendors = new Set<number>();
      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        if (product && !notifiedVendors.has(product.vendorId)) {
          const vendor = await storage.getVendor(product.vendorId);
          if (vendor) {
            await storage.createNotification({
              userId: vendor.userId,
              title: 'New Order Received!',
              message: `You have a new order (#${order.id}) worth $${parseFloat(order.totalAmount).toLocaleString()}. Check your vendor dashboard.`,
              type: 'order'
            });
            notifiedVendors.add(product.vendorId);
          }
        }
      }

      const adminUsers = await storage.getAdminUsers();
      for (const admin of adminUsers) {
        await storage.createNotification({
          userId: admin.id,
          title: 'New Order Placed',
          message: `Order #${order.id} worth $${parseFloat(order.totalAmount).toLocaleString()} has been placed and payment confirmed.`,
          type: 'order'
        });
      }

      res.json({ 
        success: true, 
        orderId: order.id,
        message: 'Payment verified and order confirmed' 
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

      if (!paymentReference) {
        return res.redirect('/checkout?error=missing_reference');
      }

      if (!isPaystackInitialized()) {
        return res.redirect('/checkout?error=payment_service_unavailable');
      }

      // Verify payment with Paystack
      const paystack = getPaystackService();
      const verificationResult = await paystack.verifyTransaction(paymentReference as string);

      if (!verificationResult.status || verificationResult.data.status !== 'success') {
        return res.redirect('/checkout?error=payment_failed');
      }

      // Get order ID from metadata
      const orderId = verificationResult.data.metadata?.orderId || 
                     verificationResult.data.metadata?.custom_fields?.find((field: any) => field.variable_name === 'order_id')?.value;

      if (!orderId) {
        return res.redirect('/checkout?error=order_not_found');
      }

      // Update order status
      await storage.updatePaymentStatus(parseInt(orderId), 'completed', paymentReference as string);
      await storage.updateOrderStatus(parseInt(orderId), 'confirmed');

      // Get user ID from order
      const order = await storage.getOrder(parseInt(orderId));
      if (order) {
        // Clear user's cart
        await storage.clearCart(order.userId);

        // Get order items for stock reduction and notifications
        const orderItems = await storage.getOrderItemsWithProducts(order.id);
        
        // Reduce stock for each purchased item
        for (const item of orderItems) {
          const product = await storage.getProduct(item.productId);
          if (product && product.stock >= item.quantity) {
            await storage.updateProductStock(item.productId, product.stock - item.quantity);
          }
        }
        
        // Create notifications for vendors and admins
        const vendorNotifications = new Set<number>();
        
        for (const item of orderItems) {
          const product = await storage.getProduct(item.productId);
          if (product && !vendorNotifications.has(product.vendorId)) {
            const vendor = await storage.getVendor(product.vendorId);
            if (vendor) {
              await storage.createNotification({
                userId: vendor.userId,
                title: 'New Order Received! 🎉',
                message: `You have a new order (#${order.id}) worth $${parseFloat(order.totalAmount).toLocaleString()}. Check your vendor dashboard for details.`,
                type: 'order'
              });
              vendorNotifications.add(product.vendorId);
            }
          }
        }

        // Notify all admins
        const adminUsers = await storage.getAdminUsers();
        for (const admin of adminUsers) {
          await storage.createNotification({
            userId: admin.id,
            title: 'New Order Placed! 📦',
            message: `Order #${order.id} worth $${parseFloat(order.totalAmount).toLocaleString()} has been placed and payment confirmed.`,
            type: 'order'
          });
        }
      }

      // Redirect to My Orders page after successful payment
      res.redirect(`/my-orders?payment=success&orderId=${orderId}&reference=${paymentReference}`);
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

      // Verify vendor owns products in this order
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const orderItems = await storage.getOrderItemsWithProducts(orderId);
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor) {
        return res.status(403).json({ message: 'Access denied: Vendor account required' });
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
    try {
      const userId = (req.user as any)?.id;
      const orderData = insertOrderSchema.parse({
        ...req.body,
        userId,
      });

      const order = await storage.createOrder(orderData);

      // Create order items from cart and collect vendor information
      const cartItems = await storage.getCartItems(userId);
      const vendorProductMap: { [key: string]: any[] } = {};
      
      for (const item of cartItems) {
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtTime: item.product.price,
        });

        // Get vendor information for this product
        const product = await storage.getProduct(item.productId);
        if (product) {
          const vendor = await storage.getVendor(product.vendorId);
          if (vendor) {
            const vendorId = vendor.userId;
            if (!vendorProductMap[vendorId]) {
              vendorProductMap[vendorId] = [];
            }
            vendorProductMap[vendorId].push({
              product: item.product,
              quantity: item.quantity,
              totalPrice: parseFloat(item.product.price) * item.quantity
            });
          }
        }
      }

      // Notify each vendor about their products sold
      for (const vendorId in vendorProductMap) {
        const products = vendorProductMap[vendorId];
        const totalVendorAmount = products.reduce((sum: number, p: any) => sum + p.totalPrice, 0);
        const productNames = products.map((p: any) => p.product.name).join(', ');
        
        try {
          await storage.createNotification({
            userId: vendorId,
            type: 'product_sold',
            title: 'Products Sold!',
            message: `Your products (${productNames}) have been purchased in order #${order.id}. Total value: $${totalVendorAmount.toLocaleString()}`,
            orderId: order.id,
            isRead: false
          });
        } catch (notificationError) {
          console.error('Error creating vendor notification:', notificationError);
        }
      }

      // Notify all admins about the new order
      try {
        const adminUsers = await storage.getAdminUsers();
        for (const admin of adminUsers) {
          await storage.createNotification({
            userId: admin.id,
            type: 'order_placed',
            title: 'New Order Placed',
            message: `A new order #${order.id} has been placed by a customer. Total amount: $${parseFloat(order.totalAmount).toLocaleString()}`,
            orderId: order.id,
            isRead: false
          });
        }
      } catch (notificationError) {
        console.error('Error creating admin notifications:', notificationError);
      }

      // Clear cart after order creation
      await storage.clearCart(userId);

      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Failed to create order' });
      }
    }
  });

  app.get('/api/orders/my-orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const orders = await storage.getOrdersForUser(userId);
      res.json(orders);
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

  app.get('/api/orders/:id', isAuthenticated, async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch order' });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationAsRead(notificationId);
      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to mark notification as read' });
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
      // Verify webhook signature
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (secret) {
        const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
        if (hash !== req.headers['x-paystack-signature']) {
          return res.status(401).json({ message: 'Invalid signature' });
        }
      }

      const { event, data } = req.body;

      if (event === 'charge.success') {
        const { reference } = data;

        if (isPaystackInitialized()) {
          const paystack = getPaystackService();
          const verification = await paystack.verifyTransaction(reference);

          if (verification?.data?.status === 'success') {
            // Find order by payment reference
            const orderId = verification.data.metadata?.orderId;
            if (orderId) {
              const order = await storage.getOrder(orderId);
              if (order && order.paymentStatus !== 'completed') {
                await storage.updatePaymentStatus(orderId, 'completed', reference);
                await storage.updateOrderStatus(orderId, 'confirmed');
                await storage.clearCart(order.userId);

                const orderItems = await storage.getOrderItemsWithProducts(orderId);
                const notifiedVendors = new Set<number>();
                for (const item of orderItems) {
                  const product = await storage.getProduct(item.productId);
                  if (product && product.stock >= item.quantity) {
                    await storage.updateProductStock(item.productId, product.stock - item.quantity);
                  }
                  if (product && !notifiedVendors.has(product.vendorId)) {
                    const vendor = await storage.getVendor(product.vendorId);
                    if (vendor) {
                      await storage.createNotification({
                        userId: vendor.userId,
                        title: 'Payment Confirmed',
                        message: `Payment confirmed for order #${orderId}. Worth $${parseFloat(order.totalAmount).toLocaleString()}.`,
                        type: 'order'
                      });
                      notifiedVendors.add(product.vendorId);
                    }
                  }
                }
              }
            }
          }
        }
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

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationAsRead(notificationId);
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
    } catch (error) {
      console.error('Error in chatbot endpoint:', error);
      res.status(500).json({ message: 'Failed to generate response' });
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
      
      // Use AI to generate outfit recommendations
      const chatbotService = getChatbotService();
      const prompt = `You are a Nigerian fashion stylist. Based on the following occasion:
        Event Type: ${eventType}
        Budget: ${budget ? `$${budget}` : 'No limit'}
        Style Notes: ${styleNotes || 'None'}
        
        Select 3-5 items from this product catalog that would create a perfect outfit:
        ${JSON.stringify(allProducts.slice(0, 20).map(p => ({ id: p.id, name: p.name, price: p.price, category: p.categoryId })))}
        
        Return a JSON array of product IDs with reasons, like: [{"productId": 1, "reason": "Perfect Agbada for wedding"}]`;
      
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
        return product ? { ...item, name: product.name, price: product.price, imageUrl: product.imageUrl } : null;
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
      if (!vendor) return res.status(403).json({ message: 'Not a vendor' });
      
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
      if (!vendor) return res.status(403).json({ message: 'Not a vendor' });
      
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
      if (!vendor) return res.status(403).json({ message: 'Not a vendor' });
      
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
      if (!vendor) return res.status(403).json({ message: 'Not a vendor' });
      
      const orderId = parseInt(req.params.orderId);
      const { stage, notes, orderItemId } = req.body;
      
      const step = await storage.createProductionStep({
        orderId,
        orderItemId,
        stage,
        notes,
        completedBy: userId,
      });
      
      res.status(201).json(step);
    } catch (error) {
      console.error('Error creating production step:', error);
      res.status(500).json({ message: 'Failed to create step' });
    }
  });

  app.patch('/api/vendor/workshop/steps/:id/complete', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      
      await storage.updateProductionStep(id, new Date(), notes);
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
      
      const resource = await storage.createVendorResource({ ...req.body, vendorId: vendor.id });
      res.status(201).json(resource);
    } catch (error) {
      console.error('Error creating resource:', error);
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
        return { ...collection, products: collectionProducts.filter(Boolean) };
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

  app.get('/api/events/recommend', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      
      const { eventType, budget, familySize } = req.query;
      
      // Get collections for this event type
      const collections = await storage.getEventCollections(eventType as string);
      
      // Get user's measurements
      const measurements = await storage.getUserMeasurements(userId);
      const hasMeasurements = measurements.length > 0;
      
      // Enhance collections with fit compatibility
      const recommendations = await Promise.all(collections.map(async (collection) => {
        const productIds = (collection.productIds as number[]) || [];
        const collectionProducts = await Promise.all(
          productIds.map(async (id) => {
            const product = await storage.getProduct(id);
            if (!product) return null;
            const fitScore = hasMeasurements ? await storage.calculateFitScore(id, measurements[0]) : 85;
            return { ...product, fitScore };
          })
        );
        
        const totalPrice = collectionProducts
          .filter(Boolean)
          .reduce((sum, p: any) => sum + parseFloat(p?.price || '0'), 0);
        
        return {
          ...collection,
          products: collectionProducts.filter(Boolean),
          totalPrice,
          avgFitScore: collectionProducts.reduce((sum, p: any) => sum + (p?.fitScore || 85), 0) / collectionProducts.length,
        };
      }));
      
      // Filter by budget if specified
      const filtered = budget 
        ? recommendations.filter(r => r.totalPrice <= parseFloat(budget as string))
        : recommendations;
      
      res.json(filtered);
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
      if (!vendor || vendor.id !== product.vendorId) {
        return res.status(403).json({ message: 'Not authorized to add stories to this product' });
      }
      
      const story = await storage.createProductStory({ ...req.body, productId });
      res.status(201).json(story);
    } catch (error) {
      console.error('Error creating product story:', error);
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
      
      // Calculate discount (100 points = $5 discount)
      const discountAmount = (points / 100) * 5;
      
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
      if (!vendor || vendor.id !== product.vendorId) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      const asset = await storage.createFabricAsset({ ...req.body, productId });
      res.status(201).json(asset);
    } catch (error) {
      console.error('Error creating fabric asset:', error);
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
      
      const rsvp = await storage.createDropRsvp({ dropId, userId });
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
      async function nominatimSearch(q: string): Promise<any[]> {
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
      }

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

  const httpServer = createServer(app);
  return httpServer;
}
