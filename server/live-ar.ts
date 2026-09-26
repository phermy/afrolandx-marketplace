import type { Express } from "express";
import { z } from "zod";
import type { Product } from "../shared/schema";
import { storage } from "./storage";

export type ArAnchor = "glasses" | "headwear" | "earrings";
export type ArAsset = { url: string; anchor: ArAnchor };

const assetSchema = z.record(z.object({
  url: z.string().url(),
  anchor: z.enum(["glasses", "headwear", "earrings"]),
}).strict());
const categoryPatterns: Record<ArAnchor, RegExp> = {
  glasses: /glasses|sunglasses|eyewear/i,
  headwear: /hat|cap|headwrap|gele|headwear/i,
  earrings: /earring/i,
};

function configuredAssets(): Record<string, ArAsset> {
  // Curated transparent PNG/WebP accessory images, indexed by approved product ID.
  // Unlike product gallery photos, these assets are prepared for an AR overlay.
  return assetSchema.parse(JSON.parse(process.env.LIVE_AR_ASSETS || "{}"));
}

export function eligibleForLiveAr(
  product: Product, vendorStatus: string, categoryName: string, asset?: ArAsset,
): boolean {
  if (!asset || product.status !== "approved" || product.stock <= 0 || vendorStatus !== "approved") return false;
  if (!categoryPatterns[asset.anchor].test(`${categoryName} ${product.name}`)) return false;
  try {
    const url = new URL(asset.url);
    return url.protocol === "https:" && /\.(png|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function registerLiveArRoutes(app: Express) {
  app.get("/api/products/:id/live-ar-eligibility", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (process.env.LIVE_AR_ENABLED !== "true") return res.json({ eligible: false });
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ eligible: false });
      const product = await storage.getProduct(id);
      if (!product) return res.json({ eligible: false });
      const asset = configuredAssets()[String(id)];
      if (!asset) return res.json({ eligible: false });
      const [vendor, categories] = await Promise.all([
        storage.getVendor(product.vendorId), storage.getCategories(),
      ]);
      const category = categories.find(item => item.id === product.categoryId)?.name ?? "";
      if (!eligibleForLiveAr(product, vendor?.status ?? "", category, asset)) return res.json({ eligible: false });
      res.json({ eligible: true, asset });
    } catch (error) {
      console.error("Live AR configuration is unavailable:", error instanceof Error ? error.message : "unknown error");
      res.status(503).json({ eligible: false });
    }
  });
}