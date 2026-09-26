import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  categories, orderFeedback, orderItems, orders, products, users, vendors,
} from "../shared/schema";
import {
  parseReviewSubmission, ReviewRequestError, submitVerifiedPurchaseReview,
  registerReviewRoutes,
} from "./reviews";

const registeredRoutes = new Map<string, any[]>();
registerReviewRoutes({
  post: (path: string, ...handlers: any[]) => registeredRoutes.set(`POST ${path}`, handlers),
  get: (path: string, ...handlers: any[]) => registeredRoutes.set(`GET ${path}`, handlers),
  patch: (path: string, ...handlers: any[]) => registeredRoutes.set(`PATCH ${path}`, handlers),
} as any);

async function invokeRoute(method: string, path: string, req: any) {
  const handlers = registeredRoutes.get(`${method} ${path}`);
  assert.ok(handlers, `Expected route ${method} ${path} to be registered`);
  let statusCode = 200;
  let body: any;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: any) { body = value; return this; },
  };
  await handlers[handlers.length - 1](req, res, () => {});
  return { statusCode, body };
}

test("review input only accepts valid ratings, comments, and client product IDs", () => {
  assert.deepEqual(parseReviewSubmission({ productId: 7, rating: 5, comment: "Great" }), {
    productId: 7, rating: 5, comment: "Great",
  });
  for (const body of [
    { productId: 7, rating: 0 },
    { productId: 7, rating: 6 },
    { productId: 7, rating: 2.5 },
    { productId: 7, rating: 5, comment: "x".repeat(2001) },
    { productId: 7, rating: 5, userId: "attacker" },
    { productId: 7, rating: 5, orderId: 999 },
  ]) {
    assert.throws(() => parseReviewSubmission(body), ReviewRequestError);
  }
});

test("verified reviews require owned delivered paid purchases and database uniqueness", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Review tests must not run against production.");

  const suffix = randomUUID();
  const buyerId = `review-buyer-${suffix}`;
  const otherUserId = `review-other-${suffix}`;
  const vendorUserId = `review-vendor-${suffix}`;
  const userIds = [buyerId, otherUserId, vendorUserId];
  let vendorId: number | undefined;
  let categoryId: number | undefined;
  let productId: number | undefined;
  let orderId: number | undefined;

  try {
    await db.insert(users).values(userIds.map(id => ({ id })));
    [{ id: vendorId }] = await db.insert(vendors).values({
      userId: vendorUserId, businessName: "Review fixture vendor", status: "approved",
    }).returning({ id: vendors.id });
    [{ id: categoryId }] = await db.insert(categories).values({
      name: "Review fixture category", slug: `review-${suffix}`,
    }).returning({ id: categories.id });
    [{ id: productId }] = await db.insert(products).values({
      vendorId, categoryId, name: "Review fixture product", description: "Test only",
      price: "10.00", status: "approved",
    }).returning({ id: products.id });
    [{ id: orderId }] = await db.insert(orders).values({
      userId: buyerId, totalAmount: "10.00", shippingAddress: {},
      paymentStatus: "paid", orderStatus: "delivered",
    }).returning({ id: orders.id });
    await db.insert(orderItems).values({ orderId, productId, quantity: 1, priceAtTime: "10.00" });

    await assert.rejects(
      submitVerifiedPurchaseReview(otherUserId, orderId, { productId, rating: 5 }),
      (error: unknown) => error instanceof ReviewRequestError && error.status === 403,
    );
    await assert.rejects(
      submitVerifiedPurchaseReview(buyerId, orderId, { productId: productId + 1, rating: 5 }),
      (error: unknown) => error instanceof ReviewRequestError && error.status === 403,
    );
    await assert.rejects(
      submitVerifiedPurchaseReview(buyerId, orderId, { productId, rating: 5, userId: otherUserId }),
      (error: unknown) => error instanceof ReviewRequestError && error.status === 400,
    );
    await db.update(orders).set({ paymentStatus: "pending" }).where(eq(orders.id, orderId));
    await assert.rejects(
      submitVerifiedPurchaseReview(buyerId, orderId, { productId, rating: 5 }),
      (error: unknown) => error instanceof ReviewRequestError && error.status === 403,
    );
    await db.update(orders).set({ paymentStatus: "paid", orderStatus: "processing" }).where(eq(orders.id, orderId));
    await assert.rejects(
      submitVerifiedPurchaseReview(buyerId, orderId, { productId, rating: 5 }),
      (error: unknown) => error instanceof ReviewRequestError && error.status === 403,
    );
    await db.update(orders).set({ orderStatus: "delivered" }).where(eq(orders.id, orderId));

    const response = await invokeRoute("POST", "/api/orders/:orderId/feedback", {
      user: { id: buyerId },
      params: { orderId: String(orderId) },
      body: { productId, rating: 4, comment: "Verified purchase" },
    });
    assert.equal(response.statusCode, 201);
    const submitted = response.body;
    assert.equal(submitted.moderationStatus, "pending");
    await assert.rejects(
      submitVerifiedPurchaseReview(buyerId, orderId, { productId, rating: 5 }),
      (error: unknown) => error instanceof ReviewRequestError && error.status === 409,
    );
    const saved = await db.select().from(orderFeedback).where(eq(orderFeedback.id, submitted.id));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].userId, buyerId);
    assert.equal(saved[0].overallRating, 4);
  } finally {
    if (orderId !== undefined) {
      await db.delete(orderFeedback).where(eq(orderFeedback.orderId, orderId));
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await db.delete(orders).where(eq(orders.id, orderId));
    }
    if (productId !== undefined) await db.delete(products).where(eq(products.id, productId));
    if (vendorId !== undefined) await db.delete(vendors).where(eq(vendors.id, vendorId));
    if (categoryId !== undefined) await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(users).where(inArray(users.id, userIds));
  }
});

test("public review APIs aggregate by product, filter in SQL, project safely, and moderation is one-way", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Review tests must not run against production.");

  const suffix = randomUUID();
  const buyerId = `review-scope-buyer-${suffix}`;
  const adminId = `review-scope-admin-${suffix}`;
  const vendorUserId = `review-scope-vendor-${suffix}`;
  const userIds = [buyerId, adminId, vendorUserId];
  let vendorId: number | undefined;
  let categoryId: number | undefined;
  const productIds: number[] = [];
  const orderIds: number[] = [];
  try {
    await db.insert(users).values(userIds.map(id => ({ id })));
    [{ id: vendorId }] = await db.insert(vendors).values({
      userId: vendorUserId, businessName: "Review scope vendor", status: "approved",
    }).returning({ id: vendors.id });
    [{ id: categoryId }] = await db.insert(categories).values({
      name: "Review scope category", slug: `review-scope-${suffix}`,
    }).returning({ id: categories.id });
    const madeProducts = await db.insert(products).values([
      { vendorId, categoryId, name: "Scoped product one", description: "Test only", price: "10.00", status: "approved" },
      { vendorId, categoryId, name: "Scoped product two", description: "Test only", price: "20.00", status: "approved" },
    ]).returning({ id: products.id });
    productIds.push(...madeProducts.map(product => product.id));
    const madeOrders = await db.insert(orders).values([10, 10, 10, 20].map(total => ({
      userId: buyerId, totalAmount: `${total}.00`, shippingAddress: {},
      paymentStatus: "paid", orderStatus: "delivered",
    }))).returning({ id: orders.id });
    orderIds.push(...madeOrders.map(order => order.id));
    await db.insert(orderItems).values([
      { orderId: orderIds[0], productId: productIds[0], quantity: 1, priceAtTime: "10.00" },
      { orderId: orderIds[1], productId: productIds[0], quantity: 1, priceAtTime: "10.00" },
      { orderId: orderIds[2], productId: productIds[0], quantity: 1, priceAtTime: "10.00" },
      { orderId: orderIds[3], productId: productIds[1], quantity: 1, priceAtTime: "20.00" },
    ]);
    const sameTime = new Date("2025-01-01T00:00:00Z");
    const fixtureReviews = await db.insert(orderFeedback).values([
      { orderId: orderIds[0], productId: productIds[0], userId: buyerId, overallRating: 5, comment: "Approved public review one", moderationStatus: "approved", createdAt: sameTime },
      { orderId: orderIds[1], productId: productIds[0], userId: buyerId, overallRating: 4, comment: "Approved public review two", moderationStatus: "approved", createdAt: sameTime },
      { orderId: orderIds[2], productId: productIds[0], userId: buyerId, overallRating: 1, comment: "Pending review", moderationStatus: "pending", createdAt: sameTime },
      { orderId: orderIds[3], productId: productIds[1], userId: buyerId, overallRating: 2, comment: "Other product review", moderationStatus: "approved", createdAt: sameTime },
      // Legacy rows that do not correspond to the real order item are never public or moderation-eligible.
      { orderId: orderIds[3], productId: productIds[0], userId: buyerId, overallRating: 5, comment: "Unverified legacy row", moderationStatus: "pending", createdAt: sameTime },
    ]).returning({ id: orderFeedback.id, comment: orderFeedback.comment });
    const pendingReviewId = fixtureReviews.find(review => review.comment === "Pending review")!.id;

    const filtered = await invokeRoute("GET", "/api/reviews", {
      query: { productId: String(productIds[0]), rating: "5", sort: "recent", limit: "12", offset: "0" },
    });
    assert.equal(filtered.statusCode, 200);
    assert.deepEqual(filtered.body.summary, {
      count: 2, average: 4.5, counts: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    });
    assert.equal(filtered.body.reviews.length, 1);
    assert.equal(filtered.body.reviews[0].product.id, productIds[0]);
    assert.equal(filtered.body.reviews[0].reviewer, "Verified buyer");
    assert.equal(filtered.body.reviews[0].verifiedPurchase, true);
    assert.equal("orderId" in filtered.body.reviews[0], false);
    assert.equal("userId" in filtered.body.reviews[0], false);
    assert.equal("email" in filtered.body.reviews[0], false);

    const productSummary = await invokeRoute("GET", "/api/products/:id/review-summary", {
      params: { id: String(productIds[0]) },
    });
    assert.deepEqual(productSummary.body, filtered.body.summary);
    const otherProductSummary = await invokeRoute("GET", "/api/reviews", {
      query: { productId: String(productIds[1]) },
    });
    assert.deepEqual(otherProductSummary.body.summary, {
      count: 1, average: 2, counts: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 },
    });
    assert.equal(otherProductSummary.body.reviews[0].product.id, productIds[1]);
    assert.equal(otherProductSummary.body.reviews[0].vendor.name, "Review scope vendor");

    assert.equal((await invokeRoute("GET", "/api/reviews", { query: { productId: "0" } })).statusCode, 400);
    assert.equal((await invokeRoute("GET", "/api/reviews", { query: { offset: "10001" } })).statusCode, 200);
    assert.equal((await invokeRoute("GET", "/api/reviews", { query: { offset: "9007199254740992" } })).statusCode, 400);

    const moderationQueue = await invokeRoute("GET", "/api/admin/reviews", {
      query: { status: "pending", limit: "50" }, user: { id: adminId },
    });
    assert.equal(moderationQueue.body.reviews.length, 1);
    assert.equal(moderationQueue.body.reviews[0].id, pendingReviewId);
    assert.equal("orderId" in moderationQueue.body.reviews[0], false);
    assert.equal("userId" in moderationQueue.body.reviews[0], false);

    const approved = await invokeRoute("PATCH", "/api/admin/reviews/:id/moderation", {
      params: { id: String(pendingReviewId) },
      body: { decision: "approved" },
      user: { id: adminId },
    });
    assert.deepEqual(approved.body, { id: pendingReviewId, moderationStatus: "approved" });
    const repeatedDecision = await invokeRoute("PATCH", "/api/admin/reviews/:id/moderation", {
      params: { id: String(pendingReviewId) },
      body: { decision: "rejected" },
      user: { id: adminId },
    });
    assert.equal(repeatedDecision.statusCode, 409);
    const afterModeration = await invokeRoute("GET", "/api/products/:id/review-summary", {
      params: { id: String(productIds[0]) },
    });
    assert.deepEqual(afterModeration.body, {
      count: 3, average: 3.33, counts: { 1: 1, 2: 0, 3: 0, 4: 1, 5: 1 },
    });
    const orderedPublicReviews = await invokeRoute("GET", "/api/reviews", {
      query: { productId: String(productIds[0]), sort: "recent" },
    });
    const expectedIds = fixtureReviews
      .filter(review => ["Approved public review one", "Approved public review two", "Pending review"].includes(review.comment ?? ""))
      .map(review => review.id)
      .sort((left, right) => right - left);
    assert.deepEqual(orderedPublicReviews.body.reviews.map((review: any) => review.id), expectedIds);
  } finally {
    if (orderIds.length) {
      await db.delete(orderFeedback).where(inArray(orderFeedback.orderId, orderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
    if (productIds.length) await db.delete(products).where(inArray(products.id, productIds));
    if (vendorId !== undefined) await db.delete(vendors).where(eq(vendors.id, vendorId));
    if (categoryId !== undefined) await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(users).where(inArray(users.id, userIds));
  }
});