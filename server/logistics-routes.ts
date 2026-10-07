import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { users, logisticsPartnerMembers, logisticsPartners } from "../shared/schema";
import { getLogisticsAccess, lockLogisticsActor } from "./logistics-access";
import { listLogisticsPartners, listShipments } from "./logistics-queries";
import { acceptShipmentBooking, assignShipment, ensureOrderShipments, recordAgencyPayment, reportShipmentIssue, reviewShipmentQuote, splitShipment, submitShipmentQuote, updateShipmentStatus } from "./logistics-service";
import { LogisticsError } from "./logistics-policy";
import { drainLogisticsEmails, queueLogisticsNotification } from "./logistics-notifications";
import { logisticsNoteSchema, partnerQuoteSchema } from "../shared/logistics";
import { normalizeAccountPhone } from "../shared/account-registration";
import { notifyAgencyPayment } from "./payment-emails";

const id = (value: unknown) => z.coerce.number().int().positive().parse(value);
const route = (handler: (req: any, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0]?.message || "Check the submitted fields." });
    if (error instanceof LogisticsError) return res.status(error.status).json({ message: error.message });
    if ((error as any)?.code === "23505") return res.status(409).json({ message: "This record or reference already exists. Refresh before retrying." });
    console.error("Shipping operation failed:", error instanceof Error ? error.name : "Unknown error");
    return res.status(500).json({ message: "The shipping operation could not be completed. Refresh before retrying." });
  }
};
export function registerLogisticsRoutes(app: Express) {
  app.get("/api/logistics/access", isAuthenticated, route(async (req, res) => res.json(await getLogisticsAccess(req.user.id))));
  app.get("/api/logistics/shipments", isAuthenticated, route(async (req, res) => res.json(await listShipments(req.user.id, req.query.orderId === undefined ? undefined : id(req.query.orderId)))));
  app.get("/api/logistics/partners", isAuthenticated, route(async (req, res) => {
    await db.transaction(tx => lockLogisticsActor(tx, req.user.id, true));
    res.json(await listLogisticsPartners());
  }));
  app.post("/api/logistics/partners", isAuthenticated, route(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(160), contactEmail: z.string().trim().email().max(254).transform(value => value.toLowerCase()), phone: z.string().trim().max(30).optional() }).parse(req.body);
    const phone = input.phone ? normalizeAccountPhone(input.phone) : null;
    if (input.phone && !phone) throw new LogisticsError("Enter a valid partner phone.", 400);
    const partner = await db.transaction(async tx => {
      await lockLogisticsActor(tx, req.user.id, true);
      const [created] = await tx.insert(logisticsPartners).values({ ...input, phone }).returning();
      return created;
    });
    res.status(201).json(partner);
  }));
  app.patch("/api/logistics/partners/:id", isAuthenticated, route(async (req, res) => {
    const partnerId = id(req.params.id);
    const input = z.object({ active: z.boolean() }).parse(req.body);
    const partner = await db.transaction(async tx => {
      await lockLogisticsActor(tx, req.user.id, true);
      const [updated] = await tx.update(logisticsPartners).set(input).where(eq(logisticsPartners.id, partnerId)).returning();
      if (!updated) throw new LogisticsError("Partner not found.", 404);
      return updated;
    });
    res.json(partner);
  }));
  app.post("/api/logistics/partners/:id/invitations", isAuthenticated, route(async (req, res) => {
    const partnerId = id(req.params.id);
    const input = z.object({ email: z.string().trim().email().max(254).transform(value => value.toLowerCase()) }).parse(req.body);
    const invitation = await db.transaction(async tx => {
      await lockLogisticsActor(tx, req.user.id, true);
      await tx.execute(sql`SELECT id FROM logistics_partners WHERE id = ${partnerId} FOR SHARE`);
      const [partner] = await tx.select().from(logisticsPartners).where(and(eq(logisticsPartners.id, partnerId), eq(logisticsPartners.active, true)));
      if (!partner) throw new LogisticsError("Choose an active partner.", 404);
      const [existing] = await tx.select().from(logisticsPartnerMembers).where(and(eq(logisticsPartnerMembers.partnerId, partnerId), eq(logisticsPartnerMembers.email, input.email)));
      if (existing) throw new LogisticsError("This account was already invited. Manage its access in the partner member list.");
      const [member] = await tx.insert(logisticsPartnerMembers).values({ partnerId, email: input.email, invitedBy: req.user.id }).returning();
      const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
      await queueLogisticsNotification(tx, [{ email: input.email, userId: account?.id }], "Afrolandx shipping partner invitation",
        `You have been invited to manage assigned shipments for ${partner.name}. Create or sign in to an Afrolandx account with this exact email, verify your email, then open Shipping to accept the invitation. You will only have access to shipments assigned to this partner.`);
      return { id: member.id, email: member.email, active: member.active };
    });
    res.status(201).json(invitation);
  }));
  app.patch("/api/logistics/members/:id", isAuthenticated, route(async (req, res) => {
    const memberId = id(req.params.id);
    const input = z.object({ active: z.boolean() }).parse(req.body);
    const member = await db.transaction(async tx => {
      await lockLogisticsActor(tx, req.user.id, true);
      const [updated] = await tx.update(logisticsPartnerMembers).set(input).where(eq(logisticsPartnerMembers.id, memberId)).returning();
      if (!updated) throw new LogisticsError("Partner member not found.", 404);
      return { id: updated.id, active: updated.active };
    });
    res.json(member);
  }));
  app.post("/api/logistics/invitations/:id/accept", isAuthenticated, route(async (req, res) => {
    const memberId = id(req.params.id);
    await db.transaction(async tx => {
      const { user } = await lockLogisticsActor(tx, req.user.id);
      await tx.execute(sql`SELECT id FROM logistics_partner_members WHERE id = ${memberId} FOR UPDATE`);
      const [member] = await tx.select().from(logisticsPartnerMembers).where(eq(logisticsPartnerMembers.id, memberId));
      if (!member || !member.active || member.email !== user.email || member.userId && member.userId !== user.id) {
        throw new LogisticsError("This invitation does not belong to your verified email.", 403);
      }
      const [partner] = await tx.select().from(logisticsPartners).where(and(eq(logisticsPartners.id, member.partnerId), eq(logisticsPartners.active, true)));
      if (!partner) throw new LogisticsError("This partner is inactive.", 403);
      if (!member.userId) await tx.update(logisticsPartnerMembers).set({ userId: user.id, acceptedAt: new Date() }).where(eq(logisticsPartnerMembers.id, memberId));
    });
    res.json({ message: "Shipping partner invitation accepted." });
  }));
  app.post("/api/logistics/orders/:id/shipments", isAuthenticated, route(async (req, res) => res.json(await ensureOrderShipments(id(req.params.id), req.user.id))));
  app.post("/api/logistics/shipments/:id/assign", isAuthenticated, route(async (req, res) => {
    const input = z.object({ partnerId: z.coerce.number().int().positive(), reason: logisticsNoteSchema }).parse(req.body);
    res.json(await assignShipment(req.user.id, id(req.params.id), input.partnerId, input.reason));
  }));
  app.post("/api/logistics/shipments/:id/quotes", isAuthenticated, route(async (req, res) => res.status(201).json(await submitShipmentQuote(req.user.id, id(req.params.id), req.body))));
  app.post("/api/logistics/shipments/:id/split", isAuthenticated, route(async (req, res) => res.status(201).json(await splitShipment(req.user.id, id(req.params.id), req.body))));
  app.post("/api/logistics/quotes/:id/review", isAuthenticated, route(async (req, res) => {
    const input = z.object({ decision: z.enum(["approved", "rejected"]), reason: logisticsNoteSchema }).parse(req.body);
    res.json(await reviewShipmentQuote(req.user.id, id(req.params.id), input.decision, input.reason));
  }));
  app.post("/api/logistics/shipments/:id/booking", isAuthenticated, route(async (req, res) => {
    const input = z.object({ bookingReference: z.string().trim().min(3).max(160) }).parse(req.body);
    res.json(await acceptShipmentBooking(req.user.id, id(req.params.id), input.bookingReference));
  }));
  app.post("/api/logistics/shipments/:id/agency-payment", isAuthenticated, route(async (req, res) => {
    const input = z.object({
      amount: partnerQuoteSchema.shape.amount,
      invoiceReference: z.string().trim().min(3).max(160), paymentReference: z.string().trim().min(3).max(160),
      paidAt: z.string().datetime({ offset: true }).refine(value => new Date(value).getTime() <= Date.now() + 60_000, "Payment date cannot be in the future."),
      note: z.string().trim().max(2000).default(""),
    }).parse(req.body);
    const payment = await recordAgencyPayment(req.user.id, id(req.params.id), input);
    await notifyAgencyPayment(payment);
    res.json(payment);
  }));
  app.post("/api/logistics/shipments/:id/status", isAuthenticated, route(async (req, res) => res.json(await updateShipmentStatus(req.user.id, id(req.params.id), req.body))));
  app.post("/api/logistics/shipments/:id/issues", isAuthenticated, route(async (req, res) => {
    const input = z.object({ message: z.string().trim().min(10).max(2000) }).parse(req.body);
    res.status(201).json(await reportShipmentIssue(req.user.id, id(req.params.id), input.message));
  }));
  const timer = setInterval(() => drainLogisticsEmails().catch(() => console.error("Shipping notification retry failed.")), 60_000);
  timer.unref();
}
