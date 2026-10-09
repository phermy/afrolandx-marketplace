import crypto from "crypto";
import type { RequestHandler } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { db } from "./db";
import { orders, users } from "../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { requestRateLimit } from "./request-rate-limit";

const guestCreationLimit = requestRateLimit("guest-buyer-creation", 40, 3600);

// A session-only buyer record preserves existing order/finance foreign keys.
// It has no password, no verified email and no account permissions. It is
// deliberately not a Passport login or an authenticated customer account.
export const checkoutAccess: RequestHandler = async (req: any, res, next) => {
  if (req.isAuthenticated?.() && req.user) return isAuthenticated(req, res, next);
  if (!req.session?.guestBuyerId && req.method==="GET" && req.path==="/api/cart") return void res.json([]);
  try {
    let id = req.session?.guestBuyerId;
    if (!id) {
      // Viewing an unknown order, or hitting an invalid checkout endpoint,
      // must not allocate a database identity. Only adding to a bag can.
      if(req.method!=="POST" || req.path!=="/api/cart") {
        if(req.method==="DELETE" && req.path==="/api/cart") return void res.sendStatus(204);
        return void res.status(404).json({message:"Checkout session not found. Add items to your bag to start guest checkout."});
      }
      let allowed=false;
      await guestCreationLimit(req,res,()=>{allowed=true;});
      if(!allowed)return;
      id = `guest_${crypto.randomUUID()}`;
      await storage.upsertUser({
        id, email: `${id}@guest.invalid`, firstName: "Guest", roles: [],
        emailVerified: false, password: null,
      });
      req.session.guestBuyerId = id;
    }
    const buyer = await storage.getUser(id);
    if (!buyer || buyer.closedAt || !id.startsWith("guest_") || (buyer.roles as string[])?.length) {
      return res.status(403).json({ message: "Guest checkout session unavailable. Please start a new session." });
    }
    req.user = buyer;
    req.guestCheckout = true;
    next();
  } catch {
    res.status(503).json({ message: "Checkout is temporarily unavailable. Please retry." });
  }
};

export async function claimGuestPaidOrders(guestId: string | undefined, user: any) {
  if (!guestId?.startsWith("guest_") || !user.emailVerified || !user.email) return;
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${guestId}))`);
    const transferred = await tx.update(orders).set({ userId: user.id, updatedAt: new Date() }).where(and(
      eq(orders.userId, guestId), eq(orders.paymentStatus, "paid"),
      sql`lower(${orders.shippingAddress}->>'contactEmail') = lower(${user.email})`,
    )).returning({id:orders.id});
    // The guest identity cannot be reused as an account.
    const remaining = await tx.select({id:orders.id}).from(orders).where(eq(orders.userId,guestId)).limit(1);
    if(transferred.length && !remaining.length) await tx.update(users).set({ closedAt: new Date() }).where(eq(users.id, guestId));
  });
}
