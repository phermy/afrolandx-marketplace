import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { getAdminUserDetails } from "./admin-user-details";
import { categories, orderItems, orders, products, users, vendors } from "../shared/schema";

test("admin account details include purchases and paid sales, scoped to the correct buyer and vendor", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Commerce tests must not run in production.");
  const suffix = randomUUID();
  const buyer = `commerce-buyer-${suffix}`;
  const seller = `commerce-seller-${suffix}`;
  const other = `commerce-other-${suffix}`;
  const userIds = [buyer, seller, other];
  const vendorIds: number[] = [];
  const productIds: number[] = [];
  const orderIds: number[] = [];
  let categoryId: number | undefined;
  try {
    await db.insert(users).values(userIds.map(id => ({ id, email: `${id}@example.test`, roles: ["customer"] })));
    const [category] = await db.insert(categories).values({ name: "Commerce test", slug: `commerce-${suffix}` }).returning();
    categoryId = category.id;
    const createdVendors = await db.insert(vendors).values([
      { userId: seller, businessName: "First shop" },
      { userId: other, businessName: "Other shop" },
    ]).returning();
    vendorIds.push(...createdVendors.map(vendor => vendor.id));
    const createdProducts = await db.insert(products).values([
      { vendorId: vendorIds[0], categoryId, name: "First product", description: "Test", price: "100", status: "approved" },
      { vendorId: vendorIds[1], categoryId, name: "Other product", description: "Test", price: "200", status: "approved" },
    ]).returning();
    productIds.push(...createdProducts.map(product => product.id));
    const createdOrders = await db.insert(orders).values([
      { userId: buyer, totalAmount: "400", paymentStatus: "paid", shippingAddress: {} },
      { userId: buyer, totalAmount: "100", paymentStatus: "pending", shippingAddress: {} },
      { userId: other, totalAmount: "100", paymentStatus: "paid", shippingAddress: {} },
    ]).returning();
    orderIds.push(...createdOrders.map(order => order.id));
    await db.insert(orderItems).values([
      { orderId: orderIds[0], productId: productIds[0], quantity: 2, priceAtTime: "100" },
      { orderId: orderIds[0], productId: productIds[1], quantity: 1, priceAtTime: "200" },
      { orderId: orderIds[1], productId: productIds[0], quantity: 1, priceAtTime: "100" },
      { orderId: orderIds[2], productId: productIds[0], quantity: 1, priceAtTime: "100" },
    ]);
    const buyerDetails = await getAdminUserDetails(storage, buyer);
    assert.equal(buyerDetails?.orderCount, 2);
    assert.equal(buyerDetails?.purchaseItems.length, 3);
    assert.ok(buyerDetails?.purchaseItems.every(item => [orderIds[0], orderIds[1]].includes(item.orderId)));
    assert.equal(buyerDetails?.purchaseItems.find(item => item.productId === productIds[1])?.productName, "Other product");
    assert.deepEqual(buyerDetails?.salesItems, []);
    const sellerDetails = await getAdminUserDetails(storage, seller);
    assert.equal(sellerDetails?.salesItems.length, 2);
    assert.ok(sellerDetails?.salesItems.every(item => item.productId === productIds[0] && item.paymentStatus === "paid"));
    assert.equal(sellerDetails?.listedProducts.length, 1);
    assert.equal(sellerDetails?.listedProducts[0].name, "First product");
    const serialized = JSON.stringify(sellerDetails);
    for (const secretField of ["password", "emailOtp", "activeSessionId", "paymentReference", "paymentUrl"]) {
      assert.equal(serialized.includes(`"${secretField}"`), false);
    }
  } finally {
    if (orderIds.length) {
      await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
    }
    if (productIds.length) await db.delete(products).where(inArray(products.id, productIds));
    if (vendorIds.length) await db.delete(vendors).where(inArray(vendors.id, vendorIds));
    if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId));
    await db.delete(users).where(inArray(users.id, userIds));
  }
});

test("account purchase history is not silently truncated after 20 orders", async () => {
  const details = await getAdminUserDetails({
    getUser: async () => ({ id: "buyer" }),
    getSavedDeliveryAddresses: async () => [],
    getVendorByUserId: async () => undefined,
    getAccountPurchaseItems: async () => [],
    getOrdersForUser: async () => Array.from({ length: 25 }, (_, index) => ({ id: index, totalAmount: "100" })),
  } as any, "buyer");
  assert.equal(details?.orders.length, 25);
  assert.equal(details?.orderCount, 25);
});
