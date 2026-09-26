import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRODUCT_SUBCATEGORIES,
  findSubcategory,
  selectedSubcategory,
  subcategoriesFor,
  subcategoryTag,
} from "./product-subcategories";

test("subcategory slugs are unique and grouped under existing category slugs", () => {
  const parents = new Set(["accessories", "home-crafts", "traditional-wear", "ankara-kente"]);
  assert.equal(new Set(PRODUCT_SUBCATEGORIES.map(item => item.slug)).size, PRODUCT_SUBCATEGORIES.length);
  for (const item of PRODUCT_SUBCATEGORIES) {
    assert.ok(parents.has(item.parentSlug), item.parentSlug);
    assert.deepEqual(findSubcategory(item.slug), item);
    assert.ok(subcategoriesFor(item.parentSlug).includes(item));
  }
});

test("canonical tags cannot be confused with ordinary free-text tags", () => {
  assert.equal(selectedSubcategory(["adire", "fabric"]), "");
  assert.equal(selectedSubcategory(["beaded-bags"]), "");
  assert.equal(selectedSubcategory(["subcategory:unknown"]), "");
  assert.equal(selectedSubcategory(["raffia", subcategoryTag("raffia-bags")]), "raffia-bags");
  assert.equal(selectedSubcategory(null), "");
});