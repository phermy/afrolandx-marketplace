import crypto from "crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  orderFinancialAdjustments,
  orderItems,
  orders,
  products,
  vendorLedgerEntries,
  vendorPayoutAccounts,
  vendorSettlements,
} from "@shared/schema";

export const COMMISSION_RATE = 0.08;

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCommission(gross: number) {
  const commission = money(gross * COMMISSION_RATE);
  return { gross: money(gross), commission, net: money(gross - commission) };
}

export async function createSaleLedger(orderId: number): Promise<void> {
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${9000000 + orderId})`);
    const rows = await tx
      .select({
        vendorId: products.vendorId,
        amount: sql<string>`SUM(${orderItems.priceAtTime} * ${orderItems.quantity})`,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId))
      .groupBy(products.vendorId);

    for (const row of rows) {
      const amounts = calculateCommission(Number(row.amount));
      await tx.insert(vendorLedgerEntries).values({
        vendorId: row.vendorId,
        orderId,
        entryType: "sale",
        grossAmount: amounts.gross.toFixed(2),
        commissionAmount: amounts.commission.toFixed(2),
        netAmount: amounts.net.toFixed(2),
        status: "pending",
        externalReference: `order:${orderId}`,
        description: `Merchandise sale for order #${orderId}`,
      }).onConflictDoNothing();
    }
  });
}

export async function releaseOrderEarnings(orderId: number): Promise<void> {
  await db.update(vendorLedgerEntries)
    .set({ status: "available", availableAt: new Date() })
    .where(and(
      eq(vendorLedgerEntries.orderId, orderId),
      eq(vendorLedgerEntries.status, "pending"),
    ));
}

export async function recordNegativeAdjustment(input: {
  orderId: number;
  kind: "refund" | "chargeback";
  amount: number;
  providerReference: string;
  reason: string;
  createdBy?: string;
  status: string;
}): Promise<void> {
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${9100000 + input.orderId})`);
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId));
    if (!order || order.paymentStatus !== "paid") throw new Error("Only paid orders can be adjusted");

    const merchandiseRows = await tx
      .select({
        vendorId: products.vendorId,
        amount: sql<string>`SUM(${orderItems.priceAtTime} * ${orderItems.quantity})`,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, input.orderId))
      .groupBy(products.vendorId);
    const merchandiseTotal = money(merchandiseRows.reduce((sum, row) => sum + Number(row.amount), 0));
    const [existing] = await tx.select({
      total: sql<string>`COALESCE(SUM(${orderFinancialAdjustments.amount}), 0)`,
    }).from(orderFinancialAdjustments).where(and(
      eq(orderFinancialAdjustments.orderId, input.orderId),
      sql`${orderFinancialAdjustments.status} NOT IN ('failed', 'rejected')`,
    ));
    if (input.amount <= 0 || money(Number(existing.total) + input.amount) > merchandiseTotal) {
      throw new Error("Adjustment exceeds the remaining refundable merchandise amount");
    }

    await tx.insert(orderFinancialAdjustments).values({
      orderId: input.orderId,
      kind: input.kind,
      amount: money(input.amount).toFixed(2),
      status: input.status,
      providerReference: input.providerReference,
      reason: input.reason,
      createdBy: input.createdBy,
    });

    let allocated = 0;
    for (let index = 0; index < merchandiseRows.length; index++) {
      const row = merchandiseRows[index];
      const share = index === merchandiseRows.length - 1
        ? money(input.amount - allocated)
        : money(input.amount * (Number(row.amount) / merchandiseTotal));
      allocated = money(allocated + share);
      const amounts = calculateCommission(share);
      await tx.insert(vendorLedgerEntries).values({
        vendorId: row.vendorId,
        orderId: input.orderId,
        entryType: input.kind,
        grossAmount: (-amounts.gross).toFixed(2),
        commissionAmount: (-amounts.commission).toFixed(2),
        netAmount: (-amounts.net).toFixed(2),
        status: "available",
        availableAt: new Date(),
        externalReference: input.providerReference,
        description: `${input.kind === "refund" ? "Refund" : "Chargeback"} for order #${input.orderId}: ${input.reason}`,
      }).onConflictDoNothing();
    }
  });
}

export async function getVendorFinance(vendorId: number) {
  const [summary] = await db.select({
    pending: sql<string>`COALESCE(SUM(CASE WHEN ${vendorLedgerEntries.status} = 'pending' THEN ${vendorLedgerEntries.netAmount} ELSE 0 END), 0)`,
    available: sql<string>`COALESCE(SUM(CASE WHEN ${vendorLedgerEntries.status} = 'available' THEN ${vendorLedgerEntries.netAmount} ELSE 0 END), 0)`,
    settled: sql<string>`COALESCE(SUM(CASE WHEN ${vendorLedgerEntries.status} = 'settled' THEN ${vendorLedgerEntries.netAmount} ELSE 0 END), 0)`,
  }).from(vendorLedgerEntries).where(eq(vendorLedgerEntries.vendorId, vendorId));
  const entries = await db.select().from(vendorLedgerEntries)
    .where(eq(vendorLedgerEntries.vendorId, vendorId))
    .orderBy(sql`${vendorLedgerEntries.createdAt} DESC`);
  const settlements = await db.select().from(vendorSettlements)
    .where(eq(vendorSettlements.vendorId, vendorId))
    .orderBy(sql`${vendorSettlements.createdAt} DESC`);
  const [account] = await db.select().from(vendorPayoutAccounts)
    .where(eq(vendorPayoutAccounts.vendorId, vendorId));
  return {
    commissionRate: COMMISSION_RATE,
    summary,
    entries,
    settlements,
    payoutAccount: account ? {
      id: account.id,
      bankName: account.bankName,
      accountName: account.accountName,
      accountLast4: account.accountLast4,
      status: account.status,
      verifiedAt: account.verifiedAt,
    } : null,
  };
}

export async function createSettlement(vendorId: number, accountId: number, approvedBy: string) {
  return await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${9200000 + vendorId})`);
    const entries = await tx.select().from(vendorLedgerEntries).where(and(
      eq(vendorLedgerEntries.vendorId, vendorId),
      eq(vendorLedgerEntries.status, "available"),
      isNull(vendorLedgerEntries.settlementId),
    ));
    const [account] = await tx.select().from(vendorPayoutAccounts).where(and(
      eq(vendorPayoutAccounts.id, accountId),
      eq(vendorPayoutAccounts.vendorId, vendorId),
      eq(vendorPayoutAccounts.status, "verified"),
    ));
    if (!account) throw new Error("A verified payout account is required");
    const net = money(entries.reduce((sum, entry) => sum + Number(entry.netAmount), 0));
    if (net <= 0) throw new Error("Vendor has no positive available balance");
    const gross = money(entries.reduce((sum, entry) => sum + Number(entry.grossAmount), 0));
    const commission = money(entries.reduce((sum, entry) => sum + Number(entry.commissionAmount), 0));
    const [settlement] = await tx.insert(vendorSettlements).values({
      vendorId,
      payoutAccountId: account.id,
      grossAmount: gross.toFixed(2),
      commissionAmount: commission.toFixed(2),
      adjustmentAmount: "0.00",
      netAmount: net.toFixed(2),
      status: "pending",
      periodStart: entries.reduce<Date | null>((min, e) => !min || (e.createdAt && e.createdAt < min) ? e.createdAt : min, null),
      periodEnd: new Date(),
      approvedBy,
    }).returning();
    await tx.update(vendorLedgerEntries).set({
      settlementId: settlement.id,
      status: "processing",
    })
      .where(inArray(vendorLedgerEntries.id, entries.map(entry => entry.id)));
    return { settlement, recipientCode: account.recipientCode };
  });
}

export function createFinanceReference(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
}