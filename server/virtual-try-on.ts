import type { Express } from "express";
import multer from "multer";
import sharp from "sharp";
import { ReplitConnectors } from "@replit/connectors-sdk";
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
const connectors = new ReplitConnectors();
const modelPath = "/v1/models/prunaai/p-image-try-on";
type ProxyRequest = { method: string; headers?: Record<string, string>; body?: string };
type PredictionProxy = (path: string, options: ProxyRequest) => Promise<Response>;
const connectorFetch = connectors.createProxyFetch("replicate");
export function createTimedPredictionProxy(
  throughConnector: typeof fetch,
  timeoutForMethod = (method: string) => method === "POST" ? 50_000 : 15_000,
): PredictionProxy {
  return (path, options) => throughConnector(path, {
    ...options,
    signal: AbortSignal.timeout(timeoutForMethod(options.method)),
    redirect: "manual",
  });
}
const defaultProxy = createTimedPredictionProxy(connectorFetch);
let providerCache: { available: boolean; until: number } | null = null;

async function providerAvailable(): Promise<boolean> {
  // Keep the shopper-facing entry point hidden until a funded provider has
  // passed a real preview test. Connecting a provider alone is not readiness.
  if (process.env.VIRTUAL_TRY_ON_ENABLED !== "true") return false;
  if (providerCache && providerCache.until > Date.now()) return providerCache.available;
  let available = false;
  try {
    const response = await defaultProxy(modelPath, { method: "GET" });
    available = response.ok;
  } catch {
    // Without a working connector, never advertise photo processing.
  }
  providerCache = { available, until: Date.now() + (available ? 300_000 : 60_000) };
  return available;
}

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
  if (!eligibleForTryOn(product, vendor?.status ?? "", category?.name ?? "", true) || !await providerAvailable()) return null;
  return { product, garmentImage: productImage(product)! };
}

type Prediction = {
  id?: string;
  status: string;
  output?: unknown;
  error?: unknown;
};

class TryOnProviderError extends Error {
  constructor(readonly status: number) {
    super(`Try-on provider returned HTTP ${status}`);
  }
}

async function predictionRequest(path: string, options: ProxyRequest, proxy: PredictionProxy): Promise<Prediction> {
  const response = await proxy(path, options);
  if (!response.ok) throw new TryOnProviderError(response.status);
  return response.json() as Promise<Prediction>;
}

// Connector file inputs use data URLs with a 256 KB limit, including base64 overhead.
export async function prepareTryOnPhoto(buffer: Buffer): Promise<Buffer> {
  for (const [width, height, quality] of [
    [1024, 1280, 72], [880, 1100, 62], [768, 960, 55],
    [640, 800, 46], [512, 640, 38],
  ]) {
    const image = await sharp(buffer).rotate().resize(width, height, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality }).toBuffer();
    if (image.length <= 180 * 1024) return image;
  }
  throw new Error("Photo could not be prepared for the preview");
}

export async function runVirtualTryOn(
  person: Buffer, garmentImage: string, proxy: PredictionProxy = defaultProxy, outputFetch: typeof fetch = fetch,
): Promise<Buffer> {
  const personDataUrl = `data:image/jpeg;base64,${person.toString("base64")}`;
  if (personDataUrl.length > 256 * 1024) throw new Error("Photo exceeds the try-on provider input limit");
  const first = await predictionRequest(
    `${modelPath}/predictions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "wait=30" },
      body: JSON.stringify({
        input: {
          person_image: personDataUrl,
          garment_images: [garmentImage],
        },
      }),
    },
    proxy,
  );
  let prediction = first;
  const deadline = Date.now() + 75_000;
  while (prediction.status === "starting" || prediction.status === "processing") {
    if (!prediction.id || !/^[A-Za-z0-9_-]+$/.test(prediction.id) || Date.now() >= deadline) {
      throw new Error("Try-on processing timed out");
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
    prediction = await predictionRequest(`/v1/predictions/${prediction.id}`, { method: "GET" }, proxy);
  }
  if (prediction.status !== "succeeded") throw new Error("Try-on processing failed");
  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (typeof output !== "string") throw new Error("Try-on provider returned no image");
  const imageUrl = new URL(output);
  if (imageUrl.protocol !== "https:" ||
    (imageUrl.hostname !== "replicate.delivery" && !imageUrl.hostname.endsWith(".replicate.delivery"))) {
    throw new Error("Try-on provider returned an unexpected image URL");
  }
  const imageResponse = await outputFetch(output, { signal: AbortSignal.timeout(15_000), redirect: "manual" });
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
      const person = await prepareTryOnPhoto(req.file.buffer);
      const result = await runVirtualTryOn(person, eligible.garmentImage);
      res.type("image/jpeg").send(result);
    } catch (error) {
      if (error instanceof TryOnProviderError && error.status === 402) {
        // A metadata GET is still 200 without credit. Do not re-advertise until
        // an operator funds and restarts the service after a real preview test.
        providerCache = { available: false, until: Infinity };
      }
      console.error("Virtual Try-On failed:", error instanceof Error ? error.message : "unknown error");
      if (!res.headersSent) res.status(503).json({ message: "We could not create a preview right now. Please try again later." });
    } finally {
      res.locals.releaseTryOnSlot();
    }
  });
}