import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { logisticsPartnerMembers, logisticsPartners, users, vendors } from "../shared/schema";
import type { LogisticsAccess } from "../shared/logistics";
import { LogisticsError } from "./logistics-policy";
export type LogisticsTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getLogisticsAccess(userId: string): Promise<LogisticsAccess> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || user.closedAt || !user.emailVerified) throw new LogisticsError("A verified, active account is required.", 403);
  const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(and(eq(vendors.userId, userId), eq(vendors.status, "approved")));
  const members = await db.select({ id: logisticsPartnerMembers.id, partnerId: logisticsPartners.id, partnerName: logisticsPartners.name, userId: logisticsPartnerMembers.userId })
    .from(logisticsPartnerMembers).innerJoin(logisticsPartners, eq(logisticsPartners.id, logisticsPartnerMembers.partnerId))
    .where(and(eq(logisticsPartnerMembers.email, user.email || ""), eq(logisticsPartnerMembers.active, true), eq(logisticsPartners.active, true)));
  return {
    admin: Array.isArray(user.roles) && user.roles.includes("admin"),
    vendorId: Array.isArray(user.roles) && user.roles.includes("vendor") ? vendor?.id || null : null,
    partnerIds: members.filter(member => member.userId === userId).map(member => member.partnerId),
    invitations: members.filter(member => !member.userId).map(member => ({ id: member.id, partnerName: member.partnerName })),
  };
}
export async function lockLogisticsActor(tx: LogisticsTx, userId: string, requireAdmin = false) {
  await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR SHARE`);
  const [user] = await tx.select().from(users).where(eq(users.id, userId));
  if (!user || user.closedAt || !user.emailVerified) throw new LogisticsError("A verified, active account is required.", 403);
  const admin = Array.isArray(user.roles) && user.roles.includes("admin");
  if (requireAdmin && !admin) throw new LogisticsError("Verified admin access is required.", 403);
  return { user, admin };
}
export async function lockPartnerMembership(tx: LogisticsTx, userId: string, partnerId: number) {
  await tx.execute(sql`SELECT id FROM logistics_partners WHERE id = ${partnerId} AND active = true FOR SHARE`);
  const [partner] = await tx.select().from(logisticsPartners).where(and(eq(logisticsPartners.id, partnerId), eq(logisticsPartners.active, true)));
  if (!partner) throw new LogisticsError("This shipping partner is inactive.", 403);
  await tx.execute(sql`SELECT id FROM logistics_partner_members WHERE partner_id = ${partnerId} AND user_id = ${userId} AND active = true FOR SHARE`);
  const [member] = await tx.select().from(logisticsPartnerMembers).where(and(eq(logisticsPartnerMembers.partnerId, partnerId), eq(logisticsPartnerMembers.userId, userId), eq(logisticsPartnerMembers.active, true)));
  if (!member) throw new LogisticsError("Only the assigned shipping partner can access this shipment.", 403);
}
