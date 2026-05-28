import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializePaystack } from "./paystack";
import { initializeCloudStorage } from "./cloudStorage";
import { storage } from "./storage";
import { db } from "./db";
import { users, culturalQuizzes } from "@shared/schema";
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

  // Seed sample cultural quizzes if none exist
  try {
    const [existing] = await db.select().from(culturalQuizzes).limit(1);
    if (!existing) {
      await db.insert(culturalQuizzes).values([
        {
          title: 'Nigerian Fashion Basics',
          description: 'Test your knowledge of traditional Nigerian clothing and fabrics.',
          rewardPoints: 50,
          isActive: true,
          questions: [
            {
              question: 'What is Aso Oke?',
              options: ['A type of food', 'A handwoven traditional Yoruba fabric', 'A Nigerian dance style', 'A traditional instrument'],
              correctIndex: 1,
              explanation: 'Aso Oke is a hand-loomed cloth woven by the Yoruba people of Nigeria, often used for ceremonial occasions.'
            },
            {
              question: 'Which fabric is most associated with West African fashion internationally?',
              options: ['Denim', 'Ankara (African wax print)', 'Silk', 'Linen'],
              correctIndex: 1,
              explanation: 'Ankara, also called African wax print, is a colourful cotton fabric widely associated with West African fashion.'
            },
            {
              question: 'What is a "Agbada"?',
              options: ['A type of headwear', 'A musical instrument', 'A flowing wide-sleeved robe worn by men', 'A traditional shoe'],
              correctIndex: 2,
              explanation: 'Agbada is an elegant flowing robe with wide sleeves, traditionally worn by men in West Africa for important ceremonies.'
            },
            {
              question: 'The "Gele" is a traditional Nigerian:',
              options: ['Necklace', 'Shoe', 'Head wrap / headgear', 'Belt'],
              correctIndex: 2,
              explanation: 'A Gele is an elaborate head wrap worn by Nigerian women, especially at events and celebrations.'
            },
            {
              question: 'Kente cloth originates from which country?',
              options: ['Nigeria', 'Senegal', 'Ghana', 'Ethiopia'],
              correctIndex: 2,
              explanation: 'Kente cloth is a silk and cotton fabric made of interwoven cloth strips, originating from the Ashanti people of Ghana.'
            },
          ]
        },
        {
          title: 'African Cultural Heritage',
          description: 'Explore the rich traditions and heritage across the African continent.',
          rewardPoints: 75,
          isActive: true,
          questions: [
            {
              question: 'What does "Ubuntu" mean in African philosophy?',
              options: ['A type of food', 'I am because we are / human interconnectedness', 'A traditional dance', 'A warrior spirit'],
              correctIndex: 1,
              explanation: 'Ubuntu is an African philosophical concept meaning "I am because we are," emphasising community and human interconnectedness.'
            },
            {
              question: 'The "Durbar" festival is a traditional celebration in:',
              options: ['South Africa', 'Northern Nigeria and West Africa', 'Kenya', 'Morocco'],
              correctIndex: 1,
              explanation: 'Durbar is a grand traditional festival celebrated in northern Nigeria and other parts of West Africa, featuring horse riding and colourful regalia.'
            },
            {
              question: 'What are "Adire" textiles?',
              options: ['Machine-made Nigerian prints', 'Yoruba tie-dye and resist-dyed textiles', 'Imported Chinese fabrics', 'A type of leather'],
              correctIndex: 1,
              explanation: 'Adire is a traditional Yoruba textile art using tie-dye and resist-dyeing techniques, producing beautiful indigo-dyed patterns.'
            },
            {
              question: 'Which of these is a traditional Igbo attire?',
              options: ['Dashiki', 'George wrapper with blouse', 'Boubou', 'Kanga'],
              correctIndex: 1,
              explanation: 'The George wrapper with a blouse is a traditional Igbo women\'s attire, often worn at important ceremonies and celebrations.'
            },
            {
              question: 'What is "Batik" in the context of African textiles?',
              options: ['A type of embroidery', 'A wax-resist dyeing technique for fabric', 'A weaving loom', 'A dye plant'],
              correctIndex: 1,
              explanation: 'Batik is a fabric dyeing technique using wax to create resist patterns, widely used across Africa and Indonesia.'
            },
          ]
        }
      ]);
      log('Seeded 2 sample cultural quizzes');
    }
  } catch (e) {
    log('Could not seed quizzes: ' + e);
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
