import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { isDesignatedOwnerEmail } from "./admin-role-bootstrap";
import { getPaystackService } from "./paystack";

export class TestVendorDeletionError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message);
  }
}

type OrderRecord = {
  id: number;
  buyerId: string;
  reference: string;
  amount: string;
  paymentStatus: string;
  shippingPaymentStatus: string;
  shippingPaymentReference: string | null;
  shippingRefundStatus: string | null;
  shippingRefundAmount: string | null;
  quoteId: number | null;
};

type Snapshot = {
  userId: string;
  email: string;
  vendorId: number;
  productIds: number[];
  orders: OrderRecord[];
  ledger: { id: number; orderId: number; status: string; entryType: string }[];
  quotes: { id: number; buyerId: string; status: string; cartFingerprint: string }[];
  notificationIds: number[];
};

export function isEligibleTestDeletionAccount(row: {
  email: unknown; vendor_id: unknown; vendor_status: unknown; roles: unknown;
}): boolean {
  return !isDesignatedOwnerEmail(typeof row.email === "string" ? row.email : null) &&
    Boolean(row.vendor_id) && ["rejected", "suspended"].includes(String(row.vendor_status)) &&
    Boolean(row.email) && Array.isArray(row.roles) &&
    !row.roles.some((role: string) => role === "admin" || role === "superadmin");
}

// A test payment is still a database record. Only Paystack itself can confirm
// that the reference belongs to its test domain; local status is not enough.
export function isConfirmedTestPayment(order: OrderRecord, result: any): boolean {
  return result?.status === true
    && result.data?.domain === "test"
    && result.data?.reference === order.reference
    && result.data?.currency === "NGN"
    && result.data?.amount === Math.round(Number(order.amount) * 100)
    && (
      (order.paymentStatus === "paid" && result.data?.status === "success" && Boolean(result.data?.paid_at))
      || (order.paymentStatus === "pending" && ["abandoned", "failed"].includes(result.data?.status))
      || (order.paymentStatus === "failed" && ["abandoned", "failed"].includes(result.data?.status))
    );
}

async function loadSnapshot(client: any, userId: string): Promise<Snapshot> {
  // The UI must not offer deletion before Publish applies this FK in production.
  // Without it, another order could attach to a quote after the quote is deleted.
  const quoteFk = await client.execute(sql`
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f' AND conrelid = 'orders'::regclass
      AND confrelid = 'shipping_quote_requests'::regclass
      AND conname = 'orders_shipping_quote_request_id_shipping_quote_requests_id_fk'
  `);
  if (!quoteFk.rows.length) {
    throw new TestVendorDeletionError("The shipping quote safety constraint has not been published yet. Nothing was deleted.", 503);
  }
  const account = await client.execute(sql`
    SELECT u.id, u.email, u.roles, v.id AS vendor_id, v.status AS vendor_status
    FROM users u LEFT JOIN vendors v ON v.user_id = u.id
    WHERE u.id = ${userId}
  `);
  if (!account.rows.length) throw new TestVendorDeletionError("Account not found.", 404);
  const row = account.rows[0];
  if (!isEligibleTestDeletionAccount(row)) {
    throw new TestVendorDeletionError("Only inactive, non-admin vendor accounts can use test-data deletion.");
  }
  const vendorId = Number(row.vendor_id);
  const products = await client.execute(sql`SELECT id, status FROM products WHERE vendor_id = ${vendorId} ORDER BY id`);
  if (products.rows.some((product: any) => product.status !== "rejected")) {
    throw new TestVendorDeletionError("All products must be rejected before test-data deletion.");
  }
  const productIds: number[] = products.rows.map((p: any) => Number(p.id));
  const orderResult = await client.execute(sql`
    SELECT DISTINCT o.id, o.user_id, o.payment_reference, o.total_amount, o.payment_status,
      o.shipping_payment_status, o.shipping_payment_reference,
      o.shipping_refund_status, o.shipping_refund_amount, o.shipping_quote_request_id
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id WHERE p.vendor_id = ${vendorId}
    ORDER BY o.id
  `);
  const orders: OrderRecord[] = orderResult.rows.map((o: any) => ({
    id: Number(o.id),
    buyerId: o.user_id,
    reference: o.payment_reference,
    amount: o.total_amount,
    paymentStatus: o.payment_status,
    shippingPaymentStatus: o.shipping_payment_status,
    shippingPaymentReference: o.shipping_payment_reference,
    shippingRefundStatus: o.shipping_refund_status,
    shippingRefundAmount: o.shipping_refund_amount,
    quoteId: o.shipping_quote_request_id == null ? null : Number(o.shipping_quote_request_id),
  }));
  if (!orders.length || orders.length > 50 || productIds.length > 100 ||
      orders.some(o => !o.reference || !/^[A-Za-z0-9._-]{3,100}$/.test(o.reference) ||
        !Number.isFinite(Number(o.amount)) || Number(o.amount) <= 0 ||
        o.shippingPaymentReference || o.shippingPaymentStatus === "paid" ||
        o.shippingRefundStatus != null || o.shippingRefundAmount != null) ||
      new Set(orders.map(o => o.reference)).size !== orders.length) {
    throw new TestVendorDeletionError("This vendor's orders are not eligible for verified test-data deletion.");
  }
  const orderIds = orders.map(o => o.id);
  const orderIdList = sql.join(orderIds.map(id => sql`${id}`), sql`, `);
  const productIdList = sql.join(productIds.map(id => sql`${id}`), sql`, `);
  const referenceList = sql.join(orders.map(o => sql`${o.reference}`), sql`, `);
  const quoteIds = orders.map(o => o.quoteId).filter((id): id is number => id !== null);
  const quoteIdList = quoteIds.length ? sql.join(quoteIds.map(id => sql`${id}`), sql`, `) : null;
  const quotesResult = quoteIdList
    ? await client.execute(sql`SELECT id, user_id, status, cart_fingerprint
        FROM shipping_quote_requests WHERE id IN (${quoteIdList}) ORDER BY id`)
    : { rows: [] };
  const quotes: Snapshot["quotes"] = quotesResult.rows.map((q: any) => ({
    id: Number(q.id), buyerId: q.user_id, status: q.status, cartFingerprint: q.cart_fingerprint,
  }));
  if (quotes.length !== quoteIds.length || orders.some(o =>
      o.quoteId !== null && !quotes.some(q => q.id === o.quoteId && q.buyerId === o.buyerId))) {
    throw new TestVendorDeletionError("A shipping quote is missing or belongs to another buyer. Nothing was deleted.");
  }
  if (quotes.some(q => q.status === "reconciling")) {
    throw new TestVendorDeletionError("A shipping refund or quote is being reconciled. Nothing was deleted.");
  }
  const ledger = await client.execute(sql`
    SELECT id, order_id, entry_type, status, settlement_id
    FROM vendor_ledger_entries WHERE vendor_id = ${vendorId} ORDER BY id
  `);
  if (ledger.rows.some((l: any) =>
      !orderIds.includes(Number(l.order_id)) || l.entry_type !== "sale" ||
      !["pending", "available"].includes(l.status) || l.settlement_id != null)) {
    throw new TestVendorDeletionError("Vendor ledger contains records that must be retained.");
  }
  const blockers = await client.execute(sql`
    SELECT
      (SELECT count(*) FROM orders WHERE user_id = ${userId}) AS buyer_orders,
      (SELECT count(*) FROM vendor_payout_accounts WHERE vendor_id = ${vendorId}) AS payout_accounts,
      (SELECT count(*) FROM vendor_settlements WHERE vendor_id = ${vendorId}) AS settlements,
      (SELECT count(*) FROM order_financial_adjustments WHERE order_id IN (${orderIdList})) AS adjustments,
      (SELECT count(*) FROM experience_feedback WHERE user_id = ${userId}) AS account_feedback,
      (SELECT count(*) FROM products WHERE vendor_id = ${vendorId}
        AND (NULLIF(image_url, '') IS NOT NULL OR (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) > 0))) AS product_media,
      (SELECT count(*) FROM collab_drops WHERE designer_id = ${vendorId} OR artisan_id = ${vendorId}) AS collaborations,
      (SELECT count(*) FROM measurements WHERE vendor_id = ${vendorId} OR product_id IN (${productIdList}) OR order_id IN (${orderIdList})) AS measurements,
      (SELECT count(*) FROM messages WHERE product_id IN (${productIdList})) AS product_messages,
      (SELECT count(*) FROM cart_items WHERE product_id IN (${productIdList})) AS product_cart,
      (SELECT count(*) FROM product_stories WHERE product_id IN (${productIdList})) AS product_stories,
      (SELECT count(*) FROM product_fit_metrics WHERE product_id IN (${productIdList})) AS product_fit,
      (SELECT count(*) FROM fabric_assets WHERE product_id IN (${productIdList})) AS product_fabric,
      (SELECT count(*) FROM order_feedback WHERE order_id IN (${orderIdList}) OR product_id IN (${productIdList})) AS feedback,
      (SELECT count(*) FROM order_production_steps WHERE order_id IN (${orderIdList})) AS production_steps,
      (SELECT count(*) FROM vendor_resources WHERE vendor_id = ${vendorId}) AS resources,
      (SELECT count(*) FROM measurement_alerts WHERE vendor_id = ${vendorId} OR acknowledged_by_vendor_id = ${vendorId}) AS alerts,
      (SELECT count(*) FROM order_items oi JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id IN (${orderIdList}) AND p.vendor_id <> ${vendorId}) AS other_vendor_items,
      (SELECT count(*) FROM vendor_ledger_entries
        WHERE order_id IN (${orderIdList}) AND vendor_id <> ${vendorId}) AS other_vendor_ledger,
      (SELECT count(*) FROM orders
        WHERE payment_reference IN (${referenceList}) AND id NOT IN (${orderIdList})) AS shared_references,
      (SELECT count(*) FROM event_collections c JOIN products p ON p.id IN (${productIdList})
        WHERE c.product_ids @> jsonb_build_array(p.id)) AS event_collections,
      (SELECT count(*) FROM collab_drops c JOIN products p ON p.id IN (${productIdList})
        WHERE c.product_ids @> jsonb_build_array(p.id)) AS drops_using_products,
      (SELECT count(*) FROM lookbook_recommendations l, jsonb_array_elements(l.bundle_items) item
        WHERE (item->>'productId') ~ '^[0-9]+$' AND (item->>'productId')::int IN (${productIdList})) AS lookbooks,
      (SELECT count(*) FROM shipping_quote_requests q, jsonb_array_elements(q.cart_snapshot) item
        WHERE ${quoteIdList ? sql`q.id NOT IN (${quoteIdList}) AND` : sql``}
        (item->>'productId') ~ '^[0-9]+$' AND (item->>'productId')::int IN (${productIdList})) AS other_quotes_using_products,
      (SELECT count(*) FROM shipping_quote_requests q, jsonb_array_elements(q.cart_snapshot) item
        WHERE ${quoteIdList ? sql`q.id IN (${quoteIdList}) AND` : sql`FALSE AND`}
        ((item->>'productId') IS NULL OR (item->>'productId') !~ '^[0-9]+$'
          OR (item->>'productId')::int NOT IN (${productIdList}))) AS quotes_with_other_products
  `);
  const counts = blockers.rows[0] as Record<string, string>;
  if (Object.values(counts).some(count => Number(count) !== 0)) {
    throw new TestVendorDeletionError("This account has linked records outside the verified test orders. Nothing was deleted.");
  }
  const notificationRows = await client.execute(sql`
    SELECT id FROM notifications WHERE order_id IN (${orderIdList}) OR product_id IN (${productIdList}) ORDER BY id
  `);
  return {
    userId, email: row.email, vendorId, productIds, orders,
    ledger: ledger.rows.map((l: any) => ({
      id: Number(l.id), orderId: Number(l.order_id), status: l.status, entryType: l.entry_type,
    })),
    quotes,
    notificationIds: notificationRows.rows.map((n: any) => Number(n.id)),
  };
}

function fingerprint(snapshot: Snapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

type PaymentReader = {
  verify: (reference: string) => Promise<any>;
  refunds: (reference: string) => Promise<any[]>;
};
const defaultPaymentReader: PaymentReader = {
  verify: reference => getPaystackService().verifyTransaction(reference),
  refunds: reference => getPaystackService().listTransactionRefunds(reference),
};

async function verifyTestOrders(snapshot: Snapshot, paymentReader: PaymentReader): Promise<void> {
  for (const order of snapshot.orders) {
    let verified;
    let refunds;
    try {
      verified = await paymentReader.verify(order.reference);
      refunds = await paymentReader.refunds(order.reference);
    } catch {
      throw new TestVendorDeletionError("Paystack could not verify every order. Nothing was deleted.", 503);
    }
    if (!isConfirmedTestPayment(order, verified) || !Array.isArray(refunds) || refunds.length) {
      throw new TestVendorDeletionError("An order is not a matching, refund-free Paystack test transaction. Nothing was deleted.");
    }
  }
}

export async function previewTestVendorDeletion(userId: string, paymentReader = defaultPaymentReader) {
  const snapshot = await loadSnapshot(db, userId);
  await verifyTestOrders(snapshot, paymentReader);
  return {
    email: snapshot.email,
    products: snapshot.productIds.length,
    orders: snapshot.orders.length,
    ledgerEntries: snapshot.ledger.length,
    quotes: snapshot.quotes.length,
    notifications: snapshot.notificationIds.length,
    fingerprint: fingerprint(snapshot),
  };
}

export async function deleteVerifiedTestVendor(
  userId: string,
  confirmationEmail: string,
  expectedFingerprint: string,
  paymentReader = defaultPaymentReader,
) {
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint)) {
    throw new TestVendorDeletionError("Preview the account again before deleting test data.");
  }
  const snapshot = await loadSnapshot(db, userId);
  if (snapshot.email.toLowerCase() !== confirmationEmail.trim().toLowerCase() ||
      fingerprint(snapshot) !== expectedFingerprint) {
    throw new TestVendorDeletionError("The confirmation does not match this account, or its records changed. Preview again.");
  }
  await verifyTestOrders(snapshot, paymentReader);

  await db.transaction(async (tx) => {
    // Lock parents before rechecking. New FK-linked records cannot slip in
    // between the final check and deletion; any unknown FK aborts this entire transaction.
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM vendors WHERE id = ${snapshot.vendorId} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM products WHERE vendor_id = ${snapshot.vendorId} FOR UPDATE`);
    const lockedIds = sql.join(snapshot.orders.map(o => sql`${o.id}`), sql`, `);
    await tx.execute(sql`SELECT id FROM orders WHERE id IN (${lockedIds}) FOR UPDATE`);
    if (snapshot.quotes.length) {
      const lockedQuoteIds = sql.join(snapshot.quotes.map(q => sql`${q.id}`), sql`, `);
      await tx.execute(sql`SELECT id FROM shipping_quote_requests WHERE id IN (${lockedQuoteIds}) FOR UPDATE`);
    }
    const current = await loadSnapshot(tx, userId);
    if (fingerprint(current) !== expectedFingerprint) {
      throw new TestVendorDeletionError("These records changed during verification. Nothing was deleted; preview again.");
    }
    const orderIds = current.orders.map(o => o.id);
    const productIds = current.productIds;
    const quoteIds = current.orders.map(o => o.quoteId).filter((id): id is number => id !== null);
    const orderIdList = sql.join(orderIds.map(id => sql`${id}`), sql`, `);
    const productIdList = sql.join(productIds.map(id => sql`${id}`), sql`, `);
    if (current.notificationIds.length) {
      const notificationIdList = sql.join(current.notificationIds.map(id => sql`${id}`), sql`, `);
      await tx.execute(sql`DELETE FROM notifications WHERE id IN (${notificationIdList})`);
    }
    await tx.execute(sql`DELETE FROM vendor_ledger_entries WHERE vendor_id = ${current.vendorId}`);
    await tx.execute(sql`DELETE FROM order_items WHERE order_id IN (${orderIdList})`);
    await tx.execute(sql`DELETE FROM orders WHERE id IN (${orderIdList})`);
    if (quoteIds.length) {
      const quoteIdList = sql.join(quoteIds.map(id => sql`${id}`), sql`, `);
      await tx.execute(sql`DELETE FROM shipping_quote_requests WHERE id IN (${quoteIdList})`);
    }
    await tx.execute(sql`DELETE FROM products WHERE vendor_id = ${current.vendorId}`);
    await tx.execute(sql`DELETE FROM vendors WHERE id = ${current.vendorId}`);
    await tx.execute(sql`DELETE FROM sessions WHERE sess->'passport'->>'user' = ${userId}`);
    const deleted = await tx.execute(sql`DELETE FROM users WHERE id = ${userId} RETURNING id`);
    if (deleted.rows.length !== 1) throw new TestVendorDeletionError("Account changed during deletion. Nothing was deleted.");
  });
  return { orders: snapshot.orders.length, products: snapshot.productIds.length };
}