import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { users, lookbookRecommendations, type Product } from "../shared/schema";
import { db } from "./db";
import { buildLookbookItems } from "./lookbook-generation";
import { storage } from "./storage";

const catalog = [
  { id: 12, name: "Ankara dress", price: "12000.00", imageUrl: null, images: [] },
  { id: 13, name: "Headwrap", price: "3000.00", imageUrl: null, images: [] },
] as Product[];

test("AI lookbooks use catalog prices in NGN and honor the total outfit budget", () => {
  const result = buildLookbookItems(
    JSON.stringify([{ productId: 12, reason: "Matches the occasion" }, { productId: 13, reason: "Complements the dress" }]),
    catalog, 15000,
  );
  assert.equal(result.totalPrice, 15000);
  assert.deepEqual(result.items.map(item => item.price), ["12000.00", "3000.00"]);
  assert.throws(() => buildLookbookItems(JSON.stringify([{ productId: 12, reason: "Matches the occasion" }]), catalog, 10000),
    /over the budget/);
  const decimalCatalog = [
    { ...catalog[0], price: "12000.10" },
    { ...catalog[1], price: "3000.20" },
  ];
  assert.equal(buildLookbookItems(
    JSON.stringify([{ productId: 12, reason: "Matches the occasion" }, { productId: 13, reason: "Complements the dress" }]),
    decimalCatalog, 15000.30,
  ).totalPrice, 15000.30);
});

test("AI failures and invalid selections cannot become fake saved lookbooks", () => {
  assert.throws(() => buildLookbookItems("Our AI assistant is briefly unavailable.", catalog), /valid lookbook/);
  assert.throws(() => buildLookbookItems("[]", catalog), /valid lookbook/);
  assert.throws(() => buildLookbookItems('[{\"productId\":999,\"reason\":\"Good match\"}]', catalog), /unavailable/);
  assert.throws(() => buildLookbookItems('[{\"productId\":12,\"reason\":\"Good match\"},{\"productId\":12,\"reason\":\"Good match\"}]', catalog), /duplicate/);
});

test("saving a lookbook cannot change another user's lookbook", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Lookbook tests must not run against production.");
  const suffix = randomUUID();
  const ownerId = `lookbook-owner-${suffix}`;
  const strangerId = `lookbook-stranger-${suffix}`;
  await db.insert(users).values([
    { id: ownerId, email: `lookbook-owner-${suffix}@example.test`, roles: ["customer"] },
    { id: strangerId, email: `lookbook-stranger-${suffix}@example.test`, roles: ["customer"] },
  ]);
  let lookbookId: number | undefined;
  try {
    const lookbook = await storage.createLookbookRecommendation({
      userId: ownerId, bundleItems: [], totalPrice: "0", status: "generated",
    });
    lookbookId = lookbook.id;
    assert.equal(await storage.updateLookbookStatus(lookbookId, strangerId, "accepted"), false);
    const [unchanged] = await db.select().from(lookbookRecommendations).where(eq(lookbookRecommendations.id, lookbookId));
    assert.equal(unchanged.status, "generated");
    assert.equal(await storage.updateLookbookStatus(lookbookId, ownerId, "accepted"), true);
    const [saved] = await db.select().from(lookbookRecommendations).where(eq(lookbookRecommendations.id, lookbookId));
    assert.equal(saved.status, "accepted");
  } finally {
    if (lookbookId !== undefined) await db.delete(lookbookRecommendations).where(eq(lookbookRecommendations.id, lookbookId));
    await db.delete(users).where(inArray(users.id, [ownerId, strangerId]));
  }
});