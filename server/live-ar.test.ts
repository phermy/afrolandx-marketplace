import assert from "node:assert/strict";
import { test } from "node:test";
import type { Product } from "../shared/schema";
import { eligibleForLiveAr, type ArAsset } from "./live-ar";

const product = {
  status: "approved", stock: 4, name: "Brass Earrings",
} as Product;
const asset: ArAsset = { url: "https://cdn.example.test/earring.webp", anchor: "earrings" };

test("only approved, stocked matching accessories with curated image assets qualify", () => {
  assert.equal(eligibleForLiveAr(product, "approved", "Accessories", asset), true);
  assert.equal(eligibleForLiveAr({ ...product, status: "pending" }, "approved", "Accessories", asset), false);
  assert.equal(eligibleForLiveAr({ ...product, stock: 0 }, "approved", "Accessories", asset), false);
  assert.equal(eligibleForLiveAr(product, "pending", "Accessories", asset), false);
  assert.equal(eligibleForLiveAr(product, "approved", "Accessories", { ...asset, anchor: "glasses" }), false);
  assert.equal(eligibleForLiveAr(product, "approved", "Accessories", { ...asset, url: "http://example.test/a.png" }), false);
  assert.equal(eligibleForLiveAr(product, "approved", "Accessories", { ...asset, url: "https://example.test/a.svg" }), false);
  assert.equal(eligibleForLiveAr(product, "approved", "Accessories"), false);
});