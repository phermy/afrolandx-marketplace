import { z } from "zod";
import type { Product } from "../shared/schema";

const selectionsSchema = z.array(z.object({
  productId: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
})).min(1).max(5);

export function buildLookbookItems(response: string, catalog: Product[], budget?: number) {
  let selected: z.infer<typeof selectionsSchema>;
  try {
    const json = response.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    selected = selectionsSchema.parse(JSON.parse(json));
  } catch {
    throw new Error("AI did not return a valid lookbook");
  }

  const productsById = new Map(catalog.map(product => [product.id, product]));
  const seen = new Set<number>();
  let totalKobo = 0;
  const items = selected.map(({ productId, reason }) => {
    const product = productsById.get(productId);
    if (!product || seen.has(productId)) {
      throw new Error("AI selected an unavailable or duplicate product");
    }
    seen.add(productId);
    const price = Number(product.price);
    const priceKobo = Math.round(price * 100);
    if (!Number.isSafeInteger(priceKobo) || priceKobo < 0) {
      throw new Error("Product has an invalid price");
    }
    totalKobo += priceKobo;
    const imageUrl = (Array.isArray(product.images) && product.images[0]) || product.imageUrl || null;
    return { productId, reason, name: product.name, price: product.price, imageUrl };
  });

  if (budget !== undefined && totalKobo > Math.round(budget * 100)) {
    throw new Error("AI selected products over the budget");
  }
  return { items, totalPrice: totalKobo / 100 };
}