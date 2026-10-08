import type { RequestHandler } from "express";
import type { IStorage } from "./storage";
import { publicNumericId } from "../shared/page-metadata";

type PublicStore = Pick<IStorage, "getProduct" | "getVendor">;
export async function getPublicProduct(store: PublicStore, id: number) {
  const product = await store.getProduct(id);
  if (!product || product.status !== "approved") return undefined;
  const vendor = await store.getVendor(product.vendorId);
  return vendor?.status === "approved" && vendor.verificationStatus === "verified" ? product : undefined;
}
export function createPublicProductHandler(store: PublicStore): RequestHandler {
  return async (req, res) => {
    const id = publicNumericId(req.params.id);
    if (!id) { res.status(404).json({ message: "Product not found" }); return; }
    try {
      const product = await getPublicProduct(store, id);
      if (!product) { res.status(404).json({ message: "Product not found" }); return; }
      res.json(product);
    } catch {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  };
}
