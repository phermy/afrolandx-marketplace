import type { RequestHandler } from "express";
import { storage } from "./storage";

type Store = Pick<typeof storage, "getOrder" | "getOrderItemsWithProducts" | "getProduct" | "getVendor">;

export function createOrderDetailsHandler(store: Store): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const id = /^[1-9]\d*$/.test(req.params.id) ? Number(req.params.id) : NaN;
      if (!Number.isSafeInteger(id)) return void res.status(404).json({ message: "Order not found" });
      const order = await store.getOrder(id);
      if (!order || order.userId !== (req.user as any).id) return void res.status(404).json({ message: "Order not found" });
      const items = await Promise.all((await store.getOrderItemsWithProducts(id)).map(async item => {
        const product = await store.getProduct(item.productId);
        const vendor = product ? await store.getVendor(product.vendorId) : undefined;
        return {
          ...item,
          productName: product?.name || "Product",
          productImage: (product?.images as string[])?.[0] || product?.imageUrl || null,
          vendorName: vendor?.businessName || "Unknown Vendor",
        };
      }));
      res.json({ ...order, items });
    } catch {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  };
}

export const orderDetailsHandler = createOrderDetailsHandler(storage);
