import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializePaystack } from "./paystack";
import { initializeCloudStorage } from "./cloudStorage";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Paystack service with secret key
  if (process.env.PAYSTACK_SECRET_KEY) {
    initializePaystack(process.env.PAYSTACK_SECRET_KEY);
    log("Paystack service initialized successfully");
  } else {
    log("Warning: PAYSTACK_SECRET_KEY not found in environment variables");
  }

  // Initialize cloud storage service
  initializeCloudStorage();

  // Cloud storage migration disabled to prevent credential errors
  // Migration can be manually triggered via /api/admin/migrate-images when credentials are valid
  log('Cloud storage infrastructure ready, using optimized local image serving with automatic compression');
  
  // Ensure designated admin accounts have admin role on every boot
  const adminEmails = ["femi.elegbeleye@afrolandx.com", "oluwaseun.alo@afrolandx.com"];
  for (const email of adminEmails) {
    try {
      const user = await storage.getUserByEmail(email);
      if (user) {
        const roles: string[] = Array.isArray(user.roles) ? user.roles as string[] : ["customer"];
        if (!roles.includes("admin")) {
          roles.push("admin");
          await db.update(users).set({ roles }).where(eq(users.email, email));
          log(`Admin role granted to ${email}`);
        }
      }
    } catch (e) {
      log(`Could not seed admin for ${email}`);
    }
  }

  // Ensure all default categories exist on every boot
  try {
    const defaultCategories = [
      { name: 'Traditional Wear',  slug: 'traditional-wear',  description: 'Authentic African traditional clothing' },
      { name: 'Aso Oke',           slug: 'aso-oke',           description: 'Handwoven traditional fabrics' },
      { name: 'Beads & Jewelry',   slug: 'beads-jewelry',     description: 'Traditional African beads and jewelry' },
      { name: 'Accessories',       slug: 'accessories',       description: 'Fashion accessories and items' },
      { name: 'Ankara & Kente',    slug: 'ankara-kente',      description: 'Printed and woven African fabrics' },
      { name: 'Footwear',          slug: 'footwear',          description: 'African leather sandals and shoes' },
      { name: 'Home & Crafts',     slug: 'home-crafts',       description: 'Handmade baskets, carvings, and art' },
      { name: 'Beauty & Wellness', slug: 'beauty-wellness',   description: 'African natural beauty products' },
      { name: 'Others',            slug: 'others',            description: 'Other African fashion products' },
    ];
    const existing = await storage.getCategories();
    const existingSlugs = new Set(existing.map((c: any) => c.slug));
    let created = 0;
    for (const cat of defaultCategories) {
      if (!existingSlugs.has(cat.slug)) {
        await storage.createCategory(cat);
        created++;
      }
    }
    if (created > 0) log(`Seeded ${created} default categor${created === 1 ? 'y' : 'ies'}`);
  } catch (e) {
    log('Could not seed categories: ' + e);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
