import type { Request, Response } from "express";
import type { IStorage } from "./storage";
import { publicNumericId } from "../shared/page-metadata";

/** Customer/guest custody only. Staff/vendor scopes must authorize separately. */
export async function loadOwnedOrder(
  req: Pick<Request, "user">, res: Pick<Response, "status" | "json" | "setHeader">,
  rawId: unknown, store: Pick<IStorage, "getOrder">,
) {
  res.setHeader("Cache-Control", "no-store");
  const id = publicNumericId(typeof rawId === "number" ? String(rawId) : rawId);
  const owner = (req.user as { id?: string } | undefined)?.id;
  const order = id && owner ? await store.getOrder(id) : undefined;
  if (!order || order.userId !== owner) {
    res.status(404).json({ message: "Order not found" });
    return undefined;
  }
  return order;
}
