import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { logisticsEmailOutbox, logisticsPartnerMembers, logisticsPartners, notifications, orders, users, vendors } from "../shared/schema";
import { sendLogisticsEmail } from "./email";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function queueLogisticsNotification(tx: Tx, recipients: { userId?: string | null; email?: string | null }[], subject: string, message: string, orderId?: number) {
  const seenUsers = new Set<string>();
  const seenEmails = new Set<string>();
  for (const recipient of recipients) {
    if (recipient.userId && !seenUsers.has(recipient.userId)) {
      seenUsers.add(recipient.userId);
      await tx.insert(notifications).values({ userId: recipient.userId, title: subject, message, type: "shipping", orderId });
    }
    const email = recipient.email?.trim().toLowerCase();
    if (email && !seenEmails.has(email)) {
      seenEmails.add(email);
      await tx.insert(logisticsEmailOutbox).values({ recipient: email, subject, message });
    }
  }
}
export async function notifyShipment(tx: Tx, shipment: { orderId: number; vendorId: number; partnerId: number | null }, subject: string, message: string) {
  const [buyer] = await tx.select({ userId: users.id, email: users.email }).from(orders).innerJoin(users, eq(users.id, orders.userId)).where(eq(orders.id, shipment.orderId));
  const [vendor] = await tx.select({ userId: users.id, email: users.email }).from(vendors).innerJoin(users, eq(users.id, vendors.userId)).where(eq(vendors.id, shipment.vendorId));
  const admins = await tx.select({ userId: users.id, email: users.email }).from(users).where(and(isNull(users.closedAt), sql`${users.roles} @> '["admin"]'::jsonb`));
  const members = shipment.partnerId ? await tx.select({ userId: users.id, email: users.email }).from(logisticsPartnerMembers)
    .innerJoin(users, eq(users.id, logisticsPartnerMembers.userId))
    .innerJoin(logisticsPartners, eq(logisticsPartners.id, logisticsPartnerMembers.partnerId))
    .where(and(eq(logisticsPartnerMembers.partnerId, shipment.partnerId), eq(logisticsPartnerMembers.active, true), eq(logisticsPartners.active, true), isNull(users.closedAt))) : [];
  await queueLogisticsNotification(tx, [...(buyer ? [buyer] : []), ...(vendor ? [vendor] : []), ...admins, ...members], subject, message, shipment.orderId);
}
let draining = false;
export async function drainLogisticsEmails() {
  if (draining) return;
  draining = true;
  try {
    for (let i = 0; i < 20; i++) {
      // A lease prevents two server processes sending the same queued mail concurrently.
      const result = await db.execute(sql`
        UPDATE logistics_email_outbox SET attempts = attempts + 1, next_attempt_at = NOW() + INTERVAL '5 minutes'
        WHERE id = (SELECT id FROM logistics_email_outbox WHERE delivered_at IS NULL AND next_attempt_at <= NOW()
          ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING id, recipient, subject, message
      `);
      const row = result.rows[0] as { id: number; recipient: string; subject: string; message: string } | undefined;
      if (!row) break;
      try {
        await sendLogisticsEmail(row.recipient, row.subject, row.message);
        await db.update(logisticsEmailOutbox).set({ deliveredAt: new Date(), lastError: null }).where(eq(logisticsEmailOutbox.id, row.id));
      } catch {
        // Do not store provider responses, which may contain credentials or personal data.
        await db.update(logisticsEmailOutbox).set({ lastError: "Email delivery failed; queued for retry." }).where(eq(logisticsEmailOutbox.id, row.id));
      }
    }
  } finally { draining = false; }
}
