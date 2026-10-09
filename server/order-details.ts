import type { RequestHandler } from "express";
import { storage } from "./storage";
import { loadOwnedOrder } from "./owned-order";

type Store = Pick<typeof storage, "getOrder" | "getOrderItemsWithProducts" | "getProduct" | "getVendor">;

export function createOrderDetailsHandler(store: Store): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const order = await loadOwnedOrder(req, res, req.params.id, store);
      if (!order) return;
      const id = order.id;
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
