import type { RequestHandler } from "express";
import { storage } from "./storage";

type Store = Pick<typeof storage, "getVendorByUserId" | "getOrdersForVendor" | "getOrderItemsWithProducts" | "getProduct" | "getUser">;

export function createVendorOrdersHandler(store: Store): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const vendor = await store.getVendorByUserId((req.user as any).id);
      if (!vendor) return void res.status(404).json({ message: "Vendor not found" });
      const result = [];
      for (const order of await store.getOrdersForVendor(vendor.id)) {
        if (order.paymentStatus !== "paid") continue;
        const items = [];
        for (const item of await store.getOrderItemsWithProducts(order.id)) {
          const product = await store.getProduct(item.productId);
          if (product?.vendorId === vendor.id) items.push(item);
        }
        if (!items.length) continue;
        const buyer = await store.getUser(order.userId);
        result.push({
          ...order, items,
          customer: { firstName: buyer?.firstName, lastName: buyer?.lastName, email: buyer?.email },
          vendorTotal: items.reduce((sum, item) => sum + Number(item.priceAtTime) * item.quantity, 0),
        });
      }
      res.json(result);
    } catch {
      res.status(500).json({ message: "Could not load your paid orders. Please try again." });
    }
  };
}

export const vendorOrdersHandler = createVendorOrdersHandler(storage);
