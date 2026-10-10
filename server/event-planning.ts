import type { Express } from "express";
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";
import { assertRoleTargetMutable, lockVerifiedSuperadminAndTarget, RoleManagementError } from "./superadmin-role-management";
import { eventPlans, eventPlanMessages, eventPlannerEarnings, eventPlannerProfiles, users } from "@shared/schema";

const profileSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  location: z.string().trim().min(2).max(160),
  description: z.string().trim().min(30).max(2000),
}).strict();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date");
const requestSchema = z.object({
  plannerId: z.number().int().positive(),
  title: z.string().trim().min(3).max(160),
  eventType: z.string().trim().min(2).max(80),
  eventDate: dateSchema,
  location: z.string().trim().min(2).max(160),
  guestCount: z.number().int().min(1).max(100000),
  budgetNgn: z.number().int().positive().max(1000000000).nullable().optional(),
  needs: z.string().trim().min(10).max(3000),
}).strict();
export const quoteLineSchema = z.object({
  category: z.enum(["venue", "hotel", "food", "wear", "other"]),
  description: z.string().trim().min(3).max(240),
  provider: z.string().trim().max(160).optional().default(""),
  estimatedAmountNgn: z.number().int().min(0).max(1000000000),
  bookingStatus: z.enum(["suggested", "requested", "confirmed_externally", "unavailable"]).default("suggested"),
}).strict();
const quoteSchema = z.object({
  plannerFeeNgn: z.number().int().min(100).max(100000000),
  validDays: z.number().int().min(1).max(30),
  items: z.array(quoteLineSchema).max(30),
}).strict();

// Integer NGN amounts avoid floating-point commission drift. Supplier estimates
// are not charged, and no commission is recognized until completion is confirmed.
export function eventFeeBreakdown(fee: number) {
  if (!Number.isSafeInteger(fee) || fee < 100 || fee > 100000000) throw new Error("Invalid planner fee");
  const commissionNgn = Math.round(fee * 8 / 100);
  return { plannerFeeNgn: fee, commissionNgn, plannerNetNgn: fee - commissionNgn };
}

const eventId = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
  ? Number(value) : null;
const userId = (req: any) => String(req.user?.id || "");
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] || character);
const ngn = (value: number) => `₦${value.toLocaleString("en-NG")}`;
const catchError = (res: any, error: unknown) => {
  if (error instanceof RoleManagementError) return res.status(error.status).json({ message: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Check the information entered", errors: error.flatten() });
  console.error("Event planning request failed", error);
  return res.status(500).json({ message: "Event request could not be completed" });
};

async function ownEvent(id: number, uid: string) {
  const [event] = await db.select().from(eventPlans).where(eq(eventPlans.id, id));
  if (!event) return null;
  const [profile] = await db.select().from(eventPlannerProfiles).where(eq(eventPlannerProfiles.id, event.plannerId));
  return event.customerId === uid || (profile?.userId === uid && profile.status === "approved") ? { event, profile } : null;
}

export function registerEventPlanningRoutes(app: Express) {
  app.get("/api/event-planners", async (_req, res) => {
    try {
      const profiles = await db.select({
        id: eventPlannerProfiles.id, businessName: eventPlannerProfiles.businessName,
        location: eventPlannerProfiles.location, description: eventPlannerProfiles.description,
      }).from(eventPlannerProfiles).where(eq(eventPlannerProfiles.status, "approved")).orderBy(desc(eventPlannerProfiles.createdAt));
      res.json(profiles);
    } catch (error) { catchError(res, error); }
  });

  app.get("/api/event-planners/me", isAuthenticated, async (req, res) => {
    try {
      const [profile] = await db.select().from(eventPlannerProfiles).where(eq(eventPlannerProfiles.userId, userId(req)));
      res.json(profile || null);
    } catch (error) { catchError(res, error); }
  });

  app.post("/api/event-planners/apply", isAuthenticated, async (req, res) => {
    try {
      const input = profileSchema.parse(req.body);
      const uid = userId(req);
      const [existing] = await db.select().from(eventPlannerProfiles).where(eq(eventPlannerProfiles.userId, uid));
      if (existing) return res.status(409).json({ message: "You have already applied. Contact support to update your application." });
      const [profile] = await db.insert(eventPlannerProfiles).values({ ...input, userId: uid }).returning();
      res.status(201).json(profile);
    } catch (error) { catchError(res, error); }
  });

  // Admin approval is separate from vendor authorization; having a vendor
  // account never grants permission to quote or manage event plans.
  app.get("/api/admin/event-planners", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(userId(req));
      if (!Array.isArray(user?.roles) || !user.roles.includes("admin")) return res.sendStatus(403);
      res.json(await db.select().from(eventPlannerProfiles).orderBy(desc(eventPlannerProfiles.createdAt)));
    } catch (error) { catchError(res, error); }
  });
  app.patch("/api/admin/event-planners/:id/status", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(userId(req));
      if (!user?.emailVerified || !Array.isArray(user.roles) ||
        !user.roles.includes("admin") || !user.roles.includes("superadmin")) {
        return res.status(403).json({ message: "Verified superadmin access is required to change planner roles." });
      }
      const id = eventId(req.params.id);
      if (!id) return res.sendStatus(400);
      const { status } = z.object({ status: z.enum(["approved", "suspended", "rejected"]) }).strict().parse(req.body);
      const profile = await db.transaction(async tx => {
        const [existing] = await tx.select().from(eventPlannerProfiles).where(eq(eventPlannerProfiles.id, id));
        if (!existing) return null;
        const { target } = await lockVerifiedSuperadminAndTarget(tx, userId(req), existing.userId);
        assertRoleTargetMutable(userId(req), existing.userId, target.email);
        const currentRoles = Array.isArray(target.roles) ? target.roles.filter((role): role is string => typeof role === "string") : ["customer"];
        const roles = status === "approved"
          ? Array.from(new Set([...currentRoles, "event_planner"]))
          : currentRoles.filter(role => role !== "event_planner");
        await tx.update(users).set({ roles: roles.length ? roles : ["customer"] }).where(eq(users.id, existing.userId));
        const [updated] = await tx.update(eventPlannerProfiles).set({ status, updatedAt: new Date() })
          .where(eq(eventPlannerProfiles.id, id)).returning();
        return updated;
      });
      if (!profile) return res.sendStatus(404);
      res.json(profile);
    } catch (error) { catchError(res, error); }
  });

  app.get("/api/event-plans", isAuthenticated, async (req, res) => {
    try {
      const uid = userId(req);
      const [profile] = await db.select().from(eventPlannerProfiles).where(eq(eventPlannerProfiles.userId, uid));
      const predicate = profile?.status === "approved"
        ? or(eq(eventPlans.customerId, uid), eq(eventPlans.plannerId, profile.id))
        : eq(eventPlans.customerId, uid);
      const plans = await db.select().from(eventPlans).where(predicate).orderBy(desc(eventPlans.createdAt));
      res.json(plans);
    } catch (error) { catchError(res, error); }
  });

  app.get("/api/event-plans/:id/statement", isAuthenticated, async (req, res) => {
    try {
      const id = eventId(req.params.id);
      if (!id) return res.sendStatus(400);
      const owned = await ownEvent(id, userId(req));
      if (!owned) return res.sendStatus(404);
      const { event, profile } = owned;
      if (!event.plannerFeeNgn || !profile) return res.status(409).json({ message: "A planner quotation has not been issued yet" });
      const lines = quoteLineSchema.array().safeParse(event.quoteItems);
      const items = lines.success ? lines.data : [];
      const outsideTotal = items.reduce((sum, item) => sum + item.estimatedAmountNgn, 0);
      const rows = items.map(item => `<tr><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.description)}<br><small>${escapeHtml(item.provider)}</small></td><td>${escapeHtml(item.bookingStatus.replaceAll("_", " "))}</td><td>${ngn(item.estimatedAmountNgn)}</td></tr>`).join("");
      res.set({
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      }).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Afrolandx event quotation #${event.id}</title><style>
        body{font:15px/1.5 system-ui,sans-serif;color:#202923;max-width:780px;margin:36px auto;padding:24px}h1{color:#087f4f;margin-bottom:4px}
        table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border-bottom:1px solid #ddd;text-align:left;padding:9px}
        th{background:#edf6f0}.note{background:#f5f8f4;padding:16px;border-left:4px solid #087f4f}
        .total{font-weight:700;font-size:18px}small{color:#555}@media print{body{margin:0;padding:10px}}</style></head>
        <body><h1>Afrolandx Events</h1><p>Event quotation #${event.id} · Revision ${event.quoteVersion}</p>
        <h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(event.eventType)} · ${escapeHtml(event.eventDate)} · ${escapeHtml(event.location)} · ${event.guestCount} guests</p>
        <p>Planner: <strong>${escapeHtml(profile.businessName)}</strong><br>Quote status: ${escapeHtml(event.status)}<br>Valid until: ${event.quoteValidUntil ? escapeHtml(event.quoteValidUntil.toISOString().slice(0, 10)) : "Not specified"}</p>
        <p>Event request: ${escapeHtml(event.needs)}</p>
        <h3>Planning service</h3><p class="total">Planner fee: ${ngn(event.plannerFeeNgn)}</p>
        <p>Afrolandx commission after customer confirmed completion (8% of planner fee): ${ngn(event.commissionNgn || 0)}<br>Planner fee after commission: ${ngn(event.plannerNetNgn || 0)}</p>
        <h3>Outside supplier estimates</h3><table><thead><tr><th>Service</th><th>Details</th><th>Progress</th><th>Estimate</th></tr></thead><tbody>${rows}</tbody></table>
        <p>Outside supplier estimates total: <strong>${ngn(outsideTotal)}</strong>. These amounts are not part of the planner fee or commission.</p>
        <p class="note">This is a quotation and event record, not proof of payment or a confirmed supplier reservation. Afrolandx does not collect event fees here. External booking claims are reported by the planner; verify directly with the provider before relying on them.</p>
        </body></html>`);
    } catch (error) { catchError(res, error); }
  });

  app.get("/api/event-plans/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const id = eventId(req.params.id);
      if (!id) return res.sendStatus(400);
      if (!await ownEvent(id, userId(req))) return res.sendStatus(404);
      res.json(await db.select().from(eventPlanMessages).where(eq(eventPlanMessages.eventId, id))
        .orderBy(eventPlanMessages.createdAt).limit(200));
    } catch (error) { catchError(res, error); }
  });
  app.post("/api/event-plans/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const id = eventId(req.params.id);
      if (!id) return res.sendStatus(400);
      const owned = await ownEvent(id, userId(req));
      if (!owned) return res.sendStatus(404);
      if (owned.event.status === "cancelled" || owned.event.status === "completed") return res.status(409).json({ message: "This event is closed" });
      const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).strict().parse(req.body);
      const [message] = await db.insert(eventPlanMessages).values({ eventId: id, senderId: userId(req), body }).returning();
      res.status(201).json(message);
    } catch (error) { catchError(res, error); }
  });

  app.post("/api/event-plans", isAuthenticated, async (req, res) => {
    try {
      const input = requestSchema.parse(req.body);
      const today = new Date().toISOString().slice(0, 10);
      if (input.eventDate < today) return res.status(400).json({ message: "Event date must be in the future" });
      const [planner] = await db.select().from(eventPlannerProfiles)
        .where(and(eq(eventPlannerProfiles.id, input.plannerId), eq(eventPlannerProfiles.status, "approved")));
      if (!planner || planner.userId === userId(req)) return res.status(400).json({ message: "Choose another approved planner" });
      const [event] = await db.insert(eventPlans).values({ ...input, customerId: userId(req) }).returning();
      res.status(201).json(event);
    } catch (error) { catchError(res, error); }
  });

  app.post("/api/event-plans/:id/quote", isAuthenticated, async (req, res) => {
    try {
      const id = eventId(req.params.id);
      if (!id) return res.sendStatus(400);
      const input = quoteSchema.parse(req.body);
      const owned = await ownEvent(id, userId(req));
      if (!owned) return res.sendStatus(404);
      if (owned.profile?.userId !== userId(req) || owned.profile?.status !== "approved") return res.sendStatus(403);
      const validUntil = new Date(Date.now() + input.validDays * 24 * 60 * 60 * 1000);
      const amounts = eventFeeBreakdown(input.plannerFeeNgn);
      const [event] = await db.update(eventPlans).set({
        ...amounts, quoteItems: input.items, quoteValidUntil: validUntil,
        quoteVersion: sql`${eventPlans.quoteVersion} + 1`,
        status: "quoted", updatedAt: new Date(),
      }).where(and(eq(eventPlans.id, id), or(eq(eventPlans.status, "requested"), eq(eventPlans.status, "quoted")))).returning();
      if (!event) return res.status(409).json({ message: "Accepted quotes cannot be changed" });
      res.json(event);
    } catch (error) { catchError(res, error); }
  });

  app.post("/api/event-plans/:id/accept", isAuthenticated, async (req, res) => {
    try {
      const id = eventId(req.params.id);
      if (!id) return res.sendStatus(400);
      const owned = await ownEvent(id, userId(req));
      if (!owned) return res.sendStatus(404);
      if (owned.event.customerId !== userId(req)) return res.sendStatus(403);
      const { quoteVersion, plannerFeeNgn } = z.object({
        quoteVersion: z.number().int().min(0), plannerFeeNgn: z.number().int().positive(),
      }).strict().parse(req.body);
      const [event] = await db.update(eventPlans).set({ status: "accepted", updatedAt: new Date() })
        .where(and(eq(eventPlans.id, id), eq(eventPlans.status, "quoted"), gt(eventPlans.quoteValidUntil, new Date()),
          eq(eventPlans.quoteVersion, quoteVersion), eq(eventPlans.plannerFeeNgn, plannerFeeNgn))).returning();
      if (!event) return res.status(409).json({ message: "The quote changed or expired. Review the latest quote before accepting." });
      res.json(event);
    } catch (error) { catchError(res, error); }
  });

  app.post("/api/event-plans/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const id = eventId(req.params.id);
      if (!id) return res.sendStatus(400);
      const owned = await ownEvent(id, userId(req));
      if (!owned) return res.sendStatus(404);
      if (owned.event.customerId !== userId(req)) return res.sendStatus(403);
      const [event] = await db.update(eventPlans).set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(eventPlans.id, id), or(eq(eventPlans.status, "requested"), eq(eventPlans.status, "quoted"), eq(eventPlans.status, "accepted")))).returning();
      if (!event) return res.status(409).json({ message: "This event cannot be cancelled here. Contact support." });
      res.json(event);
    } catch (error) { catchError(res, error); }
  });

  app.post("/api/event-plans/:id/bookings/:index", isAuthenticated, async (req, res) => {
    try {
      const id = eventId(req.params.id);
      const index = Number(req.params.index);
      if (!id || !Number.isSafeInteger(index) || index < 0 || index >= 30) return res.sendStatus(400);
      const { bookingStatus } = z.object({
        bookingStatus: z.enum(["suggested", "requested", "confirmed_externally", "unavailable"]),
      }).strict().parse(req.body);
      const updated = await db.transaction(async tx => {
        await tx.execute(sql`SELECT id FROM event_plans WHERE id = ${id} FOR UPDATE`);
        const [event] = await tx.select().from(eventPlans).where(eq(eventPlans.id, id));
        if (!event) return "missing";
        const [profile] = await tx.select().from(eventPlannerProfiles).where(eq(eventPlannerProfiles.id, event.plannerId));
        if (profile?.userId !== userId(req) || profile?.status !== "approved") return "forbidden";
        if (!["quoted", "accepted", "completion_requested"].includes(event.status)) return "conflict";
        const items = quoteLineSchema.array().safeParse(event.quoteItems);
        if (!items.success || !items.data[index]) return "invalid";
        items.data[index].bookingStatus = bookingStatus;
        const [plan] = await tx.update(eventPlans).set({ quoteItems: items.data, updatedAt: new Date() })
          .where(eq(eventPlans.id, id)).returning();
        return plan;
      });
      if (updated === "missing") return res.sendStatus(404);
      if (updated === "forbidden") return res.sendStatus(403);
      if (updated === "conflict" || updated === "invalid") return res.status(409).json({ message: "Booking progress could not be updated" });
      res.json(updated);
    } catch (error) { catchError(res, error); }
  });

  app.post("/api/event-plans/:id/delivered", isAuthenticated, async (req, res) => {
    try {
      const id = eventId(req.params.id);
      if (!id) return res.sendStatus(400);
      const owned = await ownEvent(id, userId(req));
      if (!owned) return res.sendStatus(404);
      if (owned.profile?.userId !== userId(req) || owned.profile?.status !== "approved") return res.sendStatus(403);
      if (owned.event.eventDate > new Date().toISOString().slice(0, 10)) return res.status(409).json({ message: "The event date has not arrived" });
      const [event] = await db.update(eventPlans).set({ status: "completion_requested", updatedAt: new Date() })
        .where(and(eq(eventPlans.id, id), eq(eventPlans.status, "accepted"))).returning();
      if (!event) return res.status(409).json({ message: "Only accepted events can be marked delivered" });
      res.json(event);
    } catch (error) { catchError(res, error); }
  });

  app.post("/api/event-plans/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const id = eventId(req.params.id);
      if (!id) return res.sendStatus(400);
      const owned = await ownEvent(id, userId(req));
      if (!owned) return res.sendStatus(404);
      if (owned.event.customerId !== userId(req)) return res.sendStatus(403);
      const result = await db.transaction(async tx => {
        const [event] = await tx.update(eventPlans).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(eventPlans.id, id), eq(eventPlans.status, "completion_requested"))).returning();
        if (!event || event.plannerFeeNgn == null || event.commissionNgn == null || event.plannerNetNgn == null) return null;
        await tx.insert(eventPlannerEarnings).values({
          eventId: event.id, plannerId: event.plannerId, grossNgn: event.plannerFeeNgn,
          commissionNgn: event.commissionNgn, netNgn: event.plannerNetNgn,
        }).onConflictDoNothing();
        return event;
      });
      if (!result) return res.status(409).json({ message: "Only delivered events can be confirmed complete" });
      res.json(result);
    } catch (error) { catchError(res, error); }
  });

  app.get("/api/admin/event-earnings", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(userId(req));
      if (!Array.isArray(user?.roles) || !user.roles.includes("admin")) return res.sendStatus(403);
      res.json(await db.select().from(eventPlannerEarnings).orderBy(desc(eventPlannerEarnings.createdAt)));
    } catch (error) { catchError(res, error); }
  });
}