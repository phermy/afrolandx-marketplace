import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertVendorSchema, insertProductSchema, insertCartItemSchema, insertOrderSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

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
  // Auth middleware
  await setupAuth(app);
  
  // Serve uploaded images
  app.use('/uploads', express.static('uploads'));

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
      const { status = 'approved', categoryId, vendorId, featured } = req.query;
      
      const filters: any = { status };
      if (categoryId) filters.categoryId = parseInt(categoryId as string);
      if (vendorId) filters.vendorId = parseInt(vendorId as string);
      if (featured) filters.featured = featured === 'true';

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

  // Order routes
  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderData = insertOrderSchema.parse({
        ...req.body,
        userId,
      });

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
