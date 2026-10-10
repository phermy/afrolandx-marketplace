// Curated shopping labels live inside the existing categories. The label is
// stored as one reserved product tag so no database migration is required.
export const PRODUCT_SUBCATEGORIES = [
  { slug: "raffia-bags", name: "Raffia bags", parentSlug: "accessories" },
  { slug: "beaded-bags", name: "Beaded bags", parentSlug: "accessories" },
  { slug: "wigs", name: "Wigs", parentSlug: "beauty-wellness" },
  { slug: "woven-baskets", name: "Woven baskets", parentSlug: "home-crafts" },
  { slug: "home-textiles", name: "Cushions & home textiles", parentSlug: "home-crafts" },
  { slug: "handmade-mirrors", name: "Handmade mirrors", parentSlug: "home-crafts" },
  { slug: "kids-baby-wear", name: "Kids & baby traditional wear", parentSlug: "traditional-wear" },
  { slug: "family-sets", name: "Matching family sets", parentSlug: "traditional-wear" },
  { slug: "office-wear", name: "African office wear", parentSlug: "traditional-wear" },
  { slug: "kimonos-outerwear", name: "Kimonos & outerwear", parentSlug: "traditional-wear" },
  { slug: "bogolan-mudcloth", name: "Bogolan & mudcloth", parentSlug: "ankara-kente" },
  { slug: "bazin", name: "Bazin", parentSlug: "ankara-kente" },
  { slug: "kitenge", name: "Kitenge", parentSlug: "ankara-kente" },
  { slug: "ndop", name: "Ndop", parentSlug: "ankara-kente" },
  { slug: "adire", name: "Adire fabric", parentSlug: "ankara-kente" },
] as const;

export const SUBCATEGORY_TAG_PREFIX = "subcategory:";
export const subcategoryTag = (slug: string) => `${SUBCATEGORY_TAG_PREFIX}${slug}`;

export function subcategoriesFor(parentSlug: string) {
  return PRODUCT_SUBCATEGORIES.filter(item => item.parentSlug === parentSlug);
}

export function findSubcategory(slug: string) {
  return PRODUCT_SUBCATEGORIES.find(item => item.slug === slug);
}

export function selectedSubcategory(tags: unknown): string {
  if (!Array.isArray(tags)) return "";
  const tag = tags.find(value => typeof value === "string" && value.startsWith(SUBCATEGORY_TAG_PREFIX));
  const slug = typeof tag === "string" ? tag.slice(SUBCATEGORY_TAG_PREFIX.length) : "";
  return findSubcategory(slug) ? slug : "";
}