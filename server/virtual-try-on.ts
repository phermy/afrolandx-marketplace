import type { Express } from "express";
import multer from "multer";
import sharp from "sharp";
import type { Product } from "../shared/schema";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const supportedClothing = /dress|shirt|kaftan|agbada|buba|outfit|top|jacket|robe|trouser|skirt|fashion|apparel|men|women|kid|clothing|garment|wear|suit|gown|dashiki|aso|attire/i;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

const userRequests = new Map<string, { startedAt: number; count: number; busy: boolean }>();

function productImage(product: Product): string | null {
  const image = (Array.isArray(product.images) && product.images[0]) || product.imageUrl;
  if (typeof image !== "string") return null;
  try {
    const url = new URL(image);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function eligibleForTryOn(product: Product, vendorStatus: string, category: string, configured: boolean): boolean {
  return configured && product.status === "approved" && product.stock > 0 &&
    vendorStatus === "approved" && !/accessor|jewel|shoe|bag|fabric|bead|headwrap|hat|scarf/i.test(category) &&
    supportedClothing.test(category) && !!productImage(product);
}

async function eligibleProduct(rawId: string) {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const product = await storage.getProduct(id);
  if (!product) return null;
  const [vendor, categories] = await Promise.all([storage.getVendor(product.vendorId), storage.getCategories()]);
  const category = categories.find(item => item.id === product.categoryId);
  if (!eligibleForTryOn(product, vendor?.status ?? "", category?.name ?? "", !!process.env.REPLICATE_API_TOKEN)) return null;
  return { product, garmentImage: productImage(product)! };
}

type Prediction = {
  status: string;
  output?: unknown;
  error?: unknown;
  urls?: { get?: string };
};

async function predictionRequest(url: string, token: string, options: RequestInit, fetcher: typeof fetch): Promise<Prediction> {
  const response = await fetcher(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
    signal: AbortSignal.timeout(65_000),
  });
  if (!response.ok) throw new Error(`Try-on provider returned HTTP ${response.status}`);
  return response.json() as Promise<Prediction>;
}

export async function runVirtualTryOn(person: Buffer, garmentImage: string, token: string, fetcher: typeof fetch = fetch): Promise<Buffer> {
  const first = await predictionRequest(
    "https://api.replicate.com/v1/models/prunaai/p-image-try-on/predictions",
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "wait=60" },
      body: JSON.stringify({
        input: {
          person_image: `data:image/jpeg;base64,${person.toString("base64")}`,
          garment_images: [garmentImage],
        },
      }),
    },
    fetcher,
  );
  let prediction = first;
  const deadline = Date.now() + 75_000;
  while (prediction.status === "starting" || prediction.status === "processing") {
    const nextUrl = prediction.urls?.get;
    if (!nextUrl || !/^https:\/\/api\.replicate\.com\/v1\/predictions\/[A-Za-z0-9_-]+$/.test(nextUrl) || Date.now() >= deadline) {
      throw new Error("Try-on processing timed out");
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
    prediction = await predictionRequest(nextUrl, token, { method: "GET" }, fetcher);
  }
  if (prediction.status !== "succeeded") throw new Error("Try-on processing failed");
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (typeof output !== "string") throw new Error("Try-on provider returned no image");
  const imageUrl = new URL(output);
  if (imageUrl.protocol !== "https:" ||
    (imageUrl.hostname !== "replicate.delivery" && !imageUrl.hostname.endsWith(".replicate.delivery"))) {
    throw new Error("Try-on provider returned an unexpected image URL");
  }
  const imageResponse = await fetcher(output, { signal: AbortSignal.timeout(15_000), redirect: "manual" });
  const contentType = imageResponse.headers.get("content-type") ?? "";
  if (!imageResponse.ok || (!contentType.startsWith("image/") && contentType !== "application/octet-stream")) {
    throw new Error("Try-on image download failed");
  }
  const maxBytes = 12 * 1024 * 1024;
  if (Number(imageResponse.headers.get("content-length") || 0) > maxBytes) {
    throw new Error("Try-on image exceeded the size limit");
  }
  const reader = imageResponse.body?.getReader();
  if (!reader) throw new Error("Try-on image download failed");
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Try-on image exceeded the size limit");
    }
    chunks.push(Buffer.from(value));
  }
  const image = Buffer.concat(chunks);
  return sharp(image).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 }).toBuffer();
}

export function registerVirtualTryOnRoutes(app: Express) {
  app.get("/api/products/:id/try-on-eligibility", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ eligible: !!(await eligibleProduct(req.params.id)) });
    } catch {
      res.status(503).json({ eligible: false });
    }
  });

  app.post("/api/products/:id/try-on", isAuthenticated, (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Sign in to use Virtual Try-On." });
    const now = Date.now();
    for (const [key, slot] of Array.from(userRequests.entries())) {
      if (!slot.busy && now - slot.startedAt > 3_600_000) userRequests.delete(key);
    }
    let slot = userRequests.get(userId);
    if (!slot) {
      slot = { startedAt: now, count: 0, busy: false };
      userRequests.set(userId, slot);
    }
    if (slot.busy || slot.count >= 5) {
      return res.status(429).json({ message: "Please wait before requesting another preview." });
    }
    slot.busy = true;
    slot.count++;
    let released = false;
    res.locals.releaseTryOnSlot = () => {
      if (released) return;
      released = true;
      slot.busy = false;
    };
    let processing = false;
    res.locals.startTryOnProcessing = () => { processing = true; };
    res.once("close", () => {
      // If the upload is interrupted, release immediately. Once processing has
      // begun, keep the slot until the provider call actually finishes.
      if (!processing) res.locals.releaseTryOnSlot();
    });
    next();
  }, (req, res, next) => {
    upload.single("photo")(req, res, error => {
      if (error) {
        res.locals.releaseTryOnSlot();
        return res.status(400).json({ message: "Upload a JPG, PNG, or WebP photo under 8 MB." });
      }
      next();
    });
  }, async (req, res) => {
    res.locals.startTryOnProcessing();
    res.setHeader("Cache-Control", "no-store");
    try {
      if (req.body?.consent !== "true") return res.status(400).json({ message: "Please consent to photo processing first." });
      if (!req.file) return res.status(400).json({ message: "Upload a JPG, PNG, or WebP photo under 8 MB." });
      const eligible = await eligibleProduct(req.params.id);
      if (!eligible) return res.status(422).json({ message: "Virtual Try-On is unavailable for this product." });
      const metadata = await sharp(req.file.buffer).metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format) ||
        !metadata.width || !metadata.height || metadata.width < 640 || metadata.height < 640) {
        return res.status(400).json({ message: "Use a clearer photo of at least 640 × 640 pixels." });
      }
      const person = await sharp(req.file.buffer).rotate().resize(1280, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 83 }).toBuffer();
      const result = await runVirtualTryOn(person, eligible.garmentImage, process.env.REPLICATE_API_TOKEN!);
      res.type("image/jpeg").send(result);
    } catch (error) {
      console.error("Virtual Try-On failed:", error instanceof Error ? error.message : "unknown error");
      if (!res.headersSent) res.status(503).json({ message: "We could not create a preview right now. Please try again later." });
    } finally {
      res.locals.releaseTryOnSlot();
    }
  });
}