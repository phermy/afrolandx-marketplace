import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { getPaystackService, isPaystackInitialized } from "./paystack";
import { isAdmin } from "./adminAuth";
import { insertVendorSchema, insertProductSchema, insertCartItemSchema, insertOrderSchema, orders, orderItems, products, vendors } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

// Configure multer for image uploads
const storage_config = multer.diskStorage({
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

const upload = multer({
  storage: storage_config,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Dedicated image serving route
  app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), 'uploads', 'products', filename);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'Image not found' });
    }
  });

  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
  app.post('/api/products', isAuthenticated, isVendor, upload.array('images', 5), async (req: any, res) => {
    try {
      // Remove debug logging for production
      // console.log('Request body:', req.body);
      // console.log('Request files:', req.files);
      // console.log('Vendor info:', req.vendor);
      
      // Validate required fields are present
      if (!req.body.name || !req.body.description || !req.body.price || !req.body.quantity || !req.body.categoryId) {
        return res.status(400).json({ 
          message: 'Missing required fields', 
          required: ['name', 'description', 'price', 'quantity', 'categoryId'] 
        });
      }
      
      const files = req.files as Express.Multer.File[];
      const imageUrls = files?.map(file => `/uploads/${file.filename}`) || [];

      const productData = {
        name: req.body.name.trim(),
        description: req.body.description.trim(),
        price: req.body.price,
        quantity: parseInt(req.body.quantity),
        categoryId: parseInt(req.body.categoryId),
        weight: req.body.weight && req.body.weight.trim() ? req.body.weight.trim() : undefined,
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
        10000, // 100 NGN in kobo
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;

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

      // Get order items for notifications
      const orderItems = await storage.getOrderItemsWithProducts(order.id);
      
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
              message: `You have a new order (#${order.id}) worth ₦${parseFloat(order.totalAmount).toLocaleString()}. Check your vendor dashboard for details.`,
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
          message: `Order #${order.id} worth ₦${parseFloat(order.totalAmount).toLocaleString()} has been placed and payment confirmed.`,
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

        // Get order items for notifications
        const orderItems = await storage.getOrderItemsWithProducts(order.id);
        
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
                message: `You have a new order (#${order.id}) worth ₦${parseFloat(order.totalAmount).toLocaleString()}. Check your vendor dashboard for details.`,
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
            message: `Order #${order.id} worth ₦${parseFloat(order.totalAmount).toLocaleString()} has been placed and payment confirmed.`,
            type: 'order'
          });
        }
      }

      // Redirect to success page
      res.redirect(`/order-success?order_id=${orderId}&reference=${paymentReference}`);
    } catch (error) {
      console.error('Error processing payment callback:', error);
      res.redirect('/checkout?error=processing_failed');
    }
  });

  // Order routes
  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
            message: `Your products (${productNames}) have been purchased in order #${order.id}. Total value: ₦${totalVendorAmount.toLocaleString()}`,
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
            message: `A new order #${order.id} has been placed by a customer. Total amount: ₦${parseFloat(order.totalAmount).toLocaleString()}`,
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
      const userId = req.user.claims.sub;
      const orders = await storage.getOrdersForUser(userId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Verify Paystack payment
  app.post('/api/orders/verify-payment', isAuthenticated, async (req: any, res) => {
    try {
      const { reference } = req.body;
      const userId = req.user.claims.sub;

      if (!isPaystackInitialized()) {
        return res.status(503).json({ message: 'Payment service not configured' });
      }

      // Verify payment with Paystack
      const paystack = getPaystackService();
      const verification = await paystack.verifyTransaction(reference);

      if (verification.data.status === 'success') {
        // Update order payment status
        await storage.updatePaymentStatus(verification.data.metadata.orderId, 'paid', reference);
        
        // Get the order and create notifications
        const order = await storage.getOrder(verification.data.metadata.orderId);
        if (order) {
          // Get order items for vendor notifications
          const orderItems = await storage.getOrderItemsWithProducts(order.id);
          const vendorProductMap: { [key: string]: any[] } = {};
          
          for (const item of orderItems) {
            const product = await storage.getProduct(item.productId);
            if (product) {
              const vendor = await storage.getVendor(product.vendorId);
              if (vendor) {
                const vendorId = vendor.userId;
                if (!vendorProductMap[vendorId]) {
                  vendorProductMap[vendorId] = [];
                }
                vendorProductMap[vendorId].push({
                  product: product,
                  quantity: item.quantity,
                  totalPrice: parseFloat(item.priceAtTime) * item.quantity
                });
              }
            }
          }

          // Notify vendors about successful payment
          for (const vendorId in vendorProductMap) {
            const products = vendorProductMap[vendorId];
            const totalVendorAmount = products.reduce((sum: number, p: any) => sum + p.totalPrice, 0);
            const productNames = products.map((p: any) => p.product.name).join(', ');
            
            try {
              await storage.createNotification({
                userId: vendorId,
                type: 'product_sold',
                title: 'Payment Confirmed - Products Sold!',
                message: `Payment confirmed for your products (${productNames}) in order #${order.id}. Total value: ₦${totalVendorAmount.toLocaleString()}`,
                orderId: order.id,
                isRead: false
              });
            } catch (notificationError) {
              console.error('Error creating vendor notification:', notificationError);
            }
          }

          // Notify admins about successful payment
          try {
            const adminUsers = await storage.getAdminUsers();
            for (const admin of adminUsers) {
              await storage.createNotification({
                userId: admin.id,
                type: 'payment_confirmed',
                title: 'Payment Confirmed',
                message: `Payment confirmed for order #${order.id}. Amount: ₦${parseFloat(order.totalAmount).toLocaleString()}`,
                orderId: order.id,
                isRead: false
              });
            }
          } catch (notificationError) {
            console.error('Error creating admin notifications:', notificationError);
          }
        }

        res.json({
          success: true,
          message: 'Payment verified successfully',
          order: verification.data.metadata.orderId
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Payment verification failed'
        });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({ message: 'Payment verification failed' });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Payment webhook (Paystack)
  app.post('/api/webhooks/paystack', async (req, res) => {
    try {
      const { event, data } = req.body;

      if (event === 'charge.success') {
        const { reference, amount } = data;
        
        // Find order by reference and update payment status
        // This would need additional logic to find order by reference
        // For now, we'll just acknowledge the webhook
        
        console.log('Payment successful:', { reference, amount });
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  const httpServer = createServer(app);
  return httpServer;
}
