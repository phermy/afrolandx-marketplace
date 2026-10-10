import type { Express } from "express";
import { and, asc, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  orderFeedback, orderItems, orders, products, vendors,
} from "../shared/schema";
import { db } from "./db";
import { isAuthenticated } from "./auth";
import { isAdmin } from "./adminAuth";

const submitReviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
}).strict();

const reviewListQuerySchema = z.object({
  rating: z.enum(["1", "2", "3", "4", "5"]).optional(),
  productId: z.string().regex(/^[1-9]\d*$/).transform(Number)
    .refine(Number.isSafeInteger, "productId must be a positive integer").optional(),
  sort: z.enum(["recent", "oldest", "highest"]).default("recent"),
  limit: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().min(1).max(100)).default("12"),
  offset: z.string().regex(/^(0|[1-9]\d*)$/).transform(Number)
    .pipe(z.number().int().min(0).refine(Number.isSafeInteger, "offset must be a safe integer")).default("0"),
});

export class ReviewRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ReviewRequestError";
  }
}

export function parseReviewSubmission(body: unknown) {
  const parsed = submitReviewSchema.safeParse(body);
  if (!parsed.success) {
    throw new ReviewRequestError(400, parsed.error.issues[0]?.message || "Invalid review details");
  }
  return parsed.data;
}

export async function submitVerifiedPurchaseReview(userId: string, orderId: number, body: unknown) {
  if (!userId || !Number.isSafeInteger(orderId) || orderId <= 0) {
    throw new ReviewRequestError(400, "Invalid review request");
  }
  const { productId, rating, comment } = parseReviewSubmission(body);
  const [order] = await db.select({ id: orders.id }).from(orders).where(and(
    eq(orders.id, orderId),
    eq(orders.userId, userId),
    eq(orders.paymentStatus, "paid"),
    eq(orders.orderStatus, "delivered"),
  )).limit(1);
  if (!order) {
    throw new ReviewRequestError(403, "A review requires your own paid, delivered order");
  }
  const [item] = await db.select({ id: orderItems.id }).from(orderItems).where(and(
    eq(orderItems.orderId, orderId),
    eq(orderItems.productId, productId),
  )).limit(1);
  if (!item) {
    throw new ReviewRequestError(403, "This product was not included in the order");
  }

  try {
    const [created] = await db.insert(orderFeedback).values({
      orderId,
      productId,
      userId,
      fitRating: null,
      alterationNeeded: false,
      overallRating: rating,
      comment: comment ?? null,
    }).returning({
      id: orderFeedback.id,
      rating: orderFeedback.overallRating,
      comment: orderFeedback.comment,
      createdAt: orderFeedback.createdAt,
      moderationStatus: orderFeedback.moderationStatus,
    });
    return created;
  } catch (error: any) {
    if (error?.code === "23505" || error?.cause?.code === "23505") {
      throw new ReviewRequestError(409, "You have already reviewed this product for this order");
    }
    throw error;
  }
}

function parsePositiveId(value: unknown, label: string): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new ReviewRequestError(400, `Invalid ${label}`);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new ReviewRequestError(400, `Invalid ${label}`);
  return id;
}

const matchingOrderItem = exists(
  db.select({ id: orderItems.id }).from(orderItems).where(and(
    eq(orderItems.orderId, orderFeedback.orderId),
    eq(orderItems.productId, orderFeedback.productId),
  )),
);

const verifiedPurchase = and(
  eq(orders.userId, orderFeedback.userId),
  eq(orders.paymentStatus, "paid"),
  eq(orders.orderStatus, "delivered"),
  matchingOrderItem,
);

function getProductImage(images: unknown, imageUrl: string | null) {
  return Array.isArray(images) && typeof images[0] === "string" ? images[0] : imageUrl;
}

function publicReviewFilters(productId?: number, rating?: number) {
  const filters = [
    eq(orderFeedback.moderationStatus, "approved"),
    verifiedPurchase,
    eq(products.status, "approved"),
    eq(vendors.status, "approved"),
    sql`${orderFeedback.overallRating} between 1 and 5`,
  ];
  if (productId !== undefined) filters.push(eq(orderFeedback.productId, productId));
  if (rating !== undefined) filters.push(eq(orderFeedback.overallRating, rating));
  return and(...filters);
}

async function getPublicReviewSummary(productId?: number) {
  const [row] = await db.select({
    count: sql<number>`count(*)::int`,
    average: sql<number>`coalesce(round(avg(${orderFeedback.overallRating})::numeric, 2), 0)::float`,
    one: sql<number>`count(*) filter (where ${orderFeedback.overallRating} = 1)::int`,
    two: sql<number>`count(*) filter (where ${orderFeedback.overallRating} = 2)::int`,
    three: sql<number>`count(*) filter (where ${orderFeedback.overallRating} = 3)::int`,
    four: sql<number>`count(*) filter (where ${orderFeedback.overallRating} = 4)::int`,
    five: sql<number>`count(*) filter (where ${orderFeedback.overallRating} = 5)::int`,
  }).from(orderFeedback)
    .innerJoin(orders, eq(orders.id, orderFeedback.orderId))
    .innerJoin(products, eq(products.id, orderFeedback.productId))
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(publicReviewFilters(productId));
  return {
    count: row?.count ?? 0,
    average: row?.average ?? 0,
    counts: { 1: row?.one ?? 0, 2: row?.two ?? 0, 3: row?.three ?? 0, 4: row?.four ?? 0, 5: row?.five ?? 0 },
  };
}

async function getPublicReviewPage(productId: number | undefined, rating: number | undefined, sort: "recent" | "oldest" | "highest", limit: number, offset: number) {
  const orderBy = sort === "highest"
    ? [desc(orderFeedback.overallRating), desc(orderFeedback.createdAt), desc(orderFeedback.id)]
    : sort === "oldest"
      ? [asc(orderFeedback.createdAt), asc(orderFeedback.id)]
      : [desc(orderFeedback.createdAt), desc(orderFeedback.id)];
  return db.select({
    id: orderFeedback.id,
    rating: orderFeedback.overallRating,
    comment: orderFeedback.comment,
    createdAt: orderFeedback.createdAt,
    productId: products.id,
    productName: products.name,
    productImage: products.imageUrl,
    productImages: products.images,
    vendorId: vendors.id,
    vendorName: vendors.businessName,
  }).from(orderFeedback)
    .innerJoin(orders, eq(orders.id, orderFeedback.orderId))
    .innerJoin(products, eq(products.id, orderFeedback.productId))
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(publicReviewFilters(productId, rating))
    .orderBy(...orderBy)
    .limit(limit + 1)
    .offset(offset);
}

export async function getReviewStatusesForOrderItems(userId: string, orderIds: number[]) {
  if (!orderIds.length) return new Map<string, string>();
  const rows = await db.select({
    orderId: orderFeedback.orderId,
    productId: orderFeedback.productId,
    status: orderFeedback.moderationStatus,
  }).from(orderFeedback).innerJoin(orders, eq(orders.id, orderFeedback.orderId))
    .where(and(
      inArray(orderFeedback.orderId, orderIds),
      eq(orders.userId, userId),
      eq(orderFeedback.userId, userId),
      eq(orders.paymentStatus, "paid"),
      eq(orders.orderStatus, "delivered"),
      matchingOrderItem,
    ));
  return new Map(rows.map(row => [`${row.orderId}:${row.productId}`, row.status]));
}

export function registerReviewRoutes(app: Express) {
  app.post("/api/orders/:orderId/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const orderId = parsePositiveId(req.params.orderId, "order ID");
      const created = await submitVerifiedPurchaseReview(userId, orderId, req.body);
      // Reviews remain pending until moderation; no loyalty points are awarded here.
      return res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof ReviewRequestError) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("Failed to submit verified-purchase review:", error);
      return res.status(500).json({ message: "Failed to submit review" });
    }
  });

  app.get("/api/reviews", async (req, res) => {
    try {
      const parsed = reviewListQuerySchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ message: "Invalid review filters" });
      const { rating, productId, sort, limit, offset } = parsed.data;
      const [summary, page] = await Promise.all([
        getPublicReviewSummary(productId),
        getPublicReviewPage(productId, rating === undefined ? undefined : Number(rating), sort, limit, offset),
      ]);
      const hasMore = page.length > limit;
      const reviews = page.slice(0, limit).map(row => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt,
        product: { id: row.productId, name: row.productName, imageUrl: getProductImage(row.productImages, row.productImage) },
        vendor: { id: row.vendorId, name: row.vendorName },
        reviewer: "Verified buyer" as const,
        verifiedPurchase: true as const,
      }));
      return res.json({ summary, reviews, hasMore });
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
      return res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.get("/api/products/:id/review-summary", async (req, res) => {
    try {
      const productId = parsePositiveId(req.params.id, "product ID");
      return res.json(await getPublicReviewSummary(productId));
    } catch (error) {
      if (error instanceof ReviewRequestError) return res.status(error.status).json({ message: error.message });
      console.error("Failed to fetch product review summary:", error);
      return res.status(500).json({ message: "Failed to fetch product review summary" });
    }
  });

  app.get("/api/admin/reviews", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const query = z.object({
        status: z.enum(["pending", "approved", "rejected"]).default("pending"),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }).safeParse(req.query);
      if (!query.success) return res.status(400).json({ message: "Invalid moderation filters" });
      const rows = await db.select({
        id: orderFeedback.id,
        rating: orderFeedback.overallRating,
        comment: orderFeedback.comment,
        createdAt: orderFeedback.createdAt,
        productId: products.id,
        productName: products.name,
        vendorId: vendors.id,
        vendorName: vendors.businessName,
      }).from(orderFeedback)
        .innerJoin(orders, eq(orders.id, orderFeedback.orderId))
        .innerJoin(products, eq(products.id, orderFeedback.productId))
        .innerJoin(vendors, eq(vendors.id, products.vendorId))
        .where(and(
          eq(orderFeedback.moderationStatus, query.data.status),
          verifiedPurchase,
        ))
        .orderBy(asc(orderFeedback.createdAt))
        .limit(query.data.limit);
      return res.json({ reviews: rows.map(row => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt,
        product: { id: row.productId, name: row.productName },
        vendor: { id: row.vendorId, name: row.vendorName },
        reviewer: "Verified buyer" as const,
      })) });
    } catch (error) {
      console.error("Failed to fetch review moderation queue:", error);
      return res.status(500).json({ message: "Failed to fetch review moderation queue" });
    }
  });

  app.patch("/api/admin/reviews/:id/moderation", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const reviewId = parsePositiveId(req.params.id, "review ID");
      const decision = z.object({ decision: z.enum(["approved", "rejected"]) }).strict().safeParse(req.body);
      if (!decision.success) return res.status(400).json({ message: "Decision must be approved or rejected" });
      const [updated] = await db.update(orderFeedback).set({
        moderationStatus: decision.data.decision,
        moderatedAt: new Date(),
        moderatedBy: req.user.id,
      }).where(and(
        eq(orderFeedback.id, reviewId),
        eq(orderFeedback.moderationStatus, "pending"),
      )).returning({ id: orderFeedback.id, moderationStatus: orderFeedback.moderationStatus });
      if (!updated) {
        const [existing] = await db.select({ id: orderFeedback.id }).from(orderFeedback)
          .where(eq(orderFeedback.id, reviewId)).limit(1);
        if (!existing) return res.status(404).json({ message: "Review not found" });
        return res.status(409).json({ message: "Review has already been moderated" });
      }
      // No moderation decision awards points; status transitions are one-way and guarded above.
      return res.json(updated);
    } catch (error) {
      if (error instanceof ReviewRequestError) return res.status(error.status).json({ message: error.message });
      console.error("Failed to moderate review:", error);
      return res.status(500).json({ message: "Failed to moderate review" });
    }
  });
}