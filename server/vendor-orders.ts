import type { RequestHandler } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { shipments } from "../shared/schema";
import { and, eq } from "drizzle-orm";

type Store = Pick<typeof storage, "getVendorByUserId" | "getOrdersForVendor" | "getOrderItemsWithProducts" | "getProduct" | "getUser">;

export function createVendorOrdersHandler(store: Store, loadShipments: (orderId:number,vendorId:number)=>Promise<any[]> = async()=>[]): RequestHandler {
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
        const packages = await loadShipments(order.id,vendor.id);
        const contact = order.shippingAddress as any;
        result.push({
          ...order, items,
          shippingAddress:{...(order.shippingAddress as any),_aggregator:undefined,_paymentOwnerId:undefined},
          customer: { firstName: contact?.firstName || buyer?.firstName, lastName: contact?.lastName || buyer?.lastName, email: contact?.contactEmail || buyer?.email },
          shipments: packages.map(s=>({id:s.id,status:s.status,trackingNumber:s.trackingNumber})),
          shippingStatus: packages.length ? Array.from(new Set(packages.map(s=>s.status.replaceAll('_',' ')))).join(', ') : order.orderStatus,
          vendorTotal: items.reduce((sum, item) => sum + Number(item.priceAtTime) * item.quantity, 0),
        });
      }
      res.json(result);
    } catch {
      res.status(500).json({ message: "Could not load your paid orders. Please try again." });
    }
  };
}

export const vendorOrdersHandler = createVendorOrdersHandler(storage,(orderId,vendorId)=>db.select().from(shipments).where(and(eq(shipments.orderId,orderId),eq(shipments.vendorId,vendorId))));
