import { and, asc, eq, sql } from "drizzle-orm";
import { categories, products, vendors } from "@shared/schema";
import { db } from "./db";
import { getProductApprovalIssues } from "../shared/product-approval";

export type ProductApprovalSkip = { id: number; reason: string };

export async function getProductByClientImportKey(clientImportKey: string) {
  const [product] = await db.select().from(products)
    .where(eq(products.clientImportKey, clientImportKey)).limit(1);
  return product;
}

export function matchesClientImportPayload(
  product: typeof products.$inferSelect,
  input: { name: string; shortDescription: string; description: string; price: unknown; stock: unknown; categoryId: unknown; status?: unknown; sku?: unknown; originCountry?: unknown },
) {
  const price = Number(input.price);
  const stock = Number.parseInt(String(input.stock), 10);
  const categoryId = Number.parseInt(String(input.categoryId), 10);
  return product.name === input.name.trim()
    && product.shortDescription === input.shortDescription.trim()
    && product.description === input.description.trim()
    && Number(product.price) === price
    && product.stock === stock
    && product.categoryId === categoryId
    && product.status === (input.status === "draft" ? "draft" : "pending")
    && (product.sku || null) === (typeof input.sku === "string" && input.sku.trim() ? input.sku.trim() : null)
    && (product.originCountry || null) === (typeof input.originCountry === "string" && input.originCountry.trim() ? input.originCountry.trim() : null);
}

export function resolveClientImportRetry(
  existing: typeof products.$inferSelect | undefined,
  vendorId: number,
  input: { name: string; shortDescription: string; description: string; price: unknown; stock: unknown; categoryId: unknown; status?: unknown; sku?: unknown; originCountry?: unknown },
):
  | { kind: "new" }
  | { kind: "same_vendor"; product: typeof products.$inferSelect }
  | { kind: "different_vendor" }
  | { kind: "payload_conflict" } {
  if (!existing) return { kind: "new" };
  if (existing.vendorId !== vendorId) return { kind: "different_vendor" };
  if (!matchesClientImportPayload(existing, input)) return { kind: "payload_conflict" };
  return { kind: "same_vendor", product: existing };
}

export function validateProductIds(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length >= 1
    && value.length <= 50
    && value.every(id => Number.isSafeInteger(id) && id > 0)
    && new Set(value).size === value.length;
}

export function parsePendingProductPagination(limitValue: unknown, offsetValue: unknown) {
  const parseInteger = (value: unknown): number | undefined => {
    if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) return undefined;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  };
  const limit = limitValue === undefined ? 50 : parseInteger(limitValue);
  const offset = offsetValue === undefined ? 0 : parseInteger(offsetValue);
  if (limit === undefined || limit < 1 || limit > 50 || offset === undefined) return undefined;
  return { limit, offset };
}

export async function getPendingAdminProducts(limit = 50, offset = 0) {
  const rows = await db
    .select({ product: products, vendor: vendors })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(eq(products.status, "pending"))
    .orderBy(asc(products.createdAt), asc(products.id))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.status, "pending"));

  return {
    products: rows.map(({ product, vendor }) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      price: product.price,
      stock: product.stock,
      images: product.images,
      imageUrl: product.imageUrl,
      categoryId: product.categoryId,
      status: product.status,
      vendorId: product.vendorId,
      createdAt: product.createdAt,
      vendor: {
        id: vendor.id,
        businessName: vendor.businessName,
        status: vendor.status,
        verificationStatus: vendor.verificationStatus,
      },
    })),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function approveProduct(id: number): Promise<{ approved: true } | { approved: false; reason: string }> {
  return db.transaction(async tx => {
    // Lock in a consistent product-then-vendor order. Concurrent product/vendor
    // edits block until validation and the status write commit together.
    const [product] = await tx.select().from(products)
      .where(eq(products.id, id)).limit(1).for("update");
    if (!product) return { approved: false, reason: "not_found" };
    const [vendor] = await tx.select().from(vendors)
      .where(eq(vendors.id, product.vendorId)).limit(1).for("update");
    if (!vendor) return { approved: false, reason: "vendor_not_found" };
    const [category] = await tx.select({ id: categories.id }).from(categories)
      .where(eq(categories.id, product.categoryId)).limit(1);
    const issue = getProductApprovalIssues(product, vendor, Boolean(category))[0]?.code;
    if (issue) return { approved: false, reason: issue };

    const [updated] = await tx.update(products)
      .set({ status: "approved", updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.status, "pending")))
      .returning({ id: products.id });
    return updated
      ? { approved: true }
      : { approved: false, reason: "no_longer_eligible" };
  });
}

export async function approveSelectedProducts(productIds: number[]): Promise<{ approved: number[]; skipped: ProductApprovalSkip[] }> {
  const approved: number[] = [];
  const skipped: ProductApprovalSkip[] = [];

  for (const id of productIds) {
    const result = await approveProduct(id);
    if (result.approved) approved.push(id);
    else skipped.push({ id, reason: result.reason });
  }

  return { approved, skipped };
}