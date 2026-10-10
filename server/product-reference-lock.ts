import { sql } from "drizzle-orm";

// JSON product references do not have foreign keys. Their writers must hold
// product/vendor row locks until the JSON insert commits so a test-data purge
// cannot delete a product between availability checks and insertion.
export async function lockApprovedProductReferences(tx: any, rawIds: unknown, vendorId?: number): Promise<void> {
  if (!Array.isArray(rawIds)) throw new Error("Product IDs must be an array");
  const ids = Array.from(new Set(rawIds.map(Number)));
  if (ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("Invalid product references");
  }
  if (!ids.length) return;
  const idList = sql.join(ids.map(id => sql`${id}`), sql`, `);
  const result = await tx.execute(sql`
    SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id
    WHERE p.id IN (${idList}) AND p.status = 'approved' AND v.status = 'approved'
      ${vendorId === undefined ? sql`` : sql`AND p.vendor_id = ${vendorId}`}
    FOR KEY SHARE OF p, v
  `);
  if (result.rows.length !== ids.length) {
    throw new Error("One or more products are unavailable; refresh the page and try again");
  }
}