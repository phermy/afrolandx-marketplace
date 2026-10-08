import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { orderPaidTotal } from "../shared/order-totals";
import { accountNameProblem, passwordProblem } from "../shared/account-security";
import { createOrderDetailsHandler } from "./order-details";
import { createVendorOrdersHandler } from "./vendor-orders";
import { requestRateLimit } from "./request-rate-limit";
import { fetchPaymentConfirmation, PaymentConfirmationError } from "../client/src/lib/payment-confirmation";
import { securityHeaders } from "./security-headers";
import { vendorStatusMessage, notifyVendorStatus } from "./account-notifications";
import { CloudStorageService, cloudStorageConfigProblem, normalizeCloudStorageRegion } from "./cloudStorage";
import { S3Client } from "@aws-sdk/client-s3";

function response() {
  return {
    statusCode: 200, body: undefined as any, headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
  };
}

test("QA totals: original checkout already includes the shipping deposit", () => {
  for (const shippingPaymentStatus of ["awaiting_quote", "pending", "rejected", "paid", "included"]) {
    assert.equal(orderPaidTotal({ totalAmount: "8503.00", shippingAmount: "1.00", shippingEstimatedAmount: "1.00", shippingPaymentStatus }), 8503);
  }
});
test("QA totals: only a separately paid final balance increases the total", () => {
  const order = { totalAmount: "8503.00", shippingAmount: "2999.00", shippingEstimatedAmount: "1.00", shippingFinalAmount: "3000.00" };
  assert.equal(orderPaidTotal({ ...order, shippingPaymentStatus: "pending" }), 8503);
  assert.equal(orderPaidTotal({ ...order, shippingPaymentStatus: "paid" }), 11502);
});
test("QA totals: subtract completed refunds, not pending ones", () => {
  const order = { totalAmount: "9000.11", shippingRefundAmount: "1000.01" };
  assert.equal(orderPaidTotal({ ...order, shippingRefundStatus: "processing" }), 9000.11);
  assert.equal(orderPaidTotal({ ...order, shippingRefundStatus: "processed" }), 8000.1);
});
test("QA security: new passwords reject short, common and bcrypt-truncated values", () => {
  for (const value of ["password123", "password123456", "a".repeat(15), "x".repeat(73), "🔐".repeat(19)]) assert.ok(passwordProblem(value));
  assert.equal(passwordProblem("a memorable private phrase"), null);
  assert.equal(passwordProblem("é".repeat(36) + "a"), "Use a password of no more than 72 bytes.");
});
test("QA names: bound names without excluding people with one name", () => {
  assert.ok(accountNameProblem(null, null));
  assert.ok(accountNameProblem("", ""));
  assert.ok(accountNameProblem("x".repeat(121), ""));
  assert.ok(accountNameProblem("Ada", "x".repeat(121)));
  assert.equal(accountNameProblem("Ada", ""), null);
});
test("QA order read: ownership is checked before item lookup", async () => {
  let itemReads = 0;
  const store: any = {
    getOrder: async () => ({ id: 123, userId: "buyer", orderStatus: "pending", paymentStatus: "paid" }),
    getOrderItemsWithProducts: async () => { itemReads++; return []; },
    getProduct: async () => undefined, getVendor: async () => undefined,
  };
  const handler = createOrderDetailsHandler(store);
  const own = response();
  await handler({ params: { id: "123" }, user: { id: "buyer" } } as any, own as any, () => {});
  assert.equal(own.statusCode, 200);
  assert.equal(own.body.paymentStatus, "paid");
  const other = response();
  await handler({ params: { id: "123" }, user: { id: "other" } } as any, other as any, () => {});
  assert.equal(other.statusCode, 404);
  assert.equal(itemReads, 1);
});
test("QA order read: malformed and unsafe identifiers never reach the database", async () => {
  const handler = createOrderDetailsHandler({ getOrder: async () => { throw new Error("Unexpected database access"); } } as any);
  for (const id of ["0", "-1", "123junk", "1.5", "abc", "999999999999999999999"]) {
    const res = response();
    await handler({ params: { id }, user: { id: "buyer" } } as any, res as any, () => {});
    assert.equal(res.statusCode, 404, id);
  }
});
test("QA vendor orders: paid historical products remain visible, other vendors' items do not", async () => {
  const handler = createVendorOrdersHandler({
    getVendorByUserId: async () => ({ id: 7 }),
    getOrdersForVendor: async () => [{ id: 1, userId: "buyer", paymentStatus: "paid" }, { id: 2, userId: "buyer", paymentStatus: "pending" }],
    getOrderItemsWithProducts: async () => [
      { productId: 10, priceAtTime: "40.00", quantity: 2 },
      { productId: 20, priceAtTime: "100.00", quantity: 1 },
    ],
    getProduct: async (id: number) => ({ vendorId: id === 10 ? 7 : 8, status: "rejected" }),
    getUser: async () => ({ firstName: "Buyer", email: "buyer@example.test" }),
  } as any);
  const res = response();
  await handler({ user: { id: "vendor" } } as any, res as any, () => {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].items.length, 1);
  assert.equal(res.body[0].items[0].productId, 10);
  assert.equal(res.body[0].vendorTotal, 80);
});
test("QA route precedence: vendor order literals precede vendor :id", () => {
  const source = readFileSync("server/routes.ts", "utf8");
  assert.ok(source.indexOf("app.get('/api/vendors/orders'") < source.indexOf("app.get('/api/vendors/:id'"));
  assert.ok(source.indexOf("app.get('/api/vendors/me/orders'") < source.indexOf("app.get('/api/vendors/:id'"));
});
test("QA request limits: return 429 and Retry-After after the limit", async () => {
  let count = 0, passed = 0;
  const limiter = requestRateLimit("login", 2, 900, async () => ({ count: ++count, retry_after: 700 }));
  for (let i = 0; i < 3; i++) {
    const res = response();
    await limiter({ ip: "192.0.2.1" } as any, res as any, () => { passed++; });
    assert.equal(res.statusCode, i === 2 ? 429 : 200);
    if (i === 2) assert.equal(res.headers["Retry-After"], "700");
  }
  assert.equal(passed, 2);
});
test("QA request limits: forged forwarded values cannot change the trusted identity", async () => {
  const keys: string[] = [];
  const limiter = requestRateLimit("login", 5, 60, async key => { keys.push(key); return { count: 1, retry_after: 60 }; });
  for (const forwarded of ["203.0.113.1", "203.0.113.2"]) {
    await limiter({ ip: "192.0.2.1", headers: { "x-forwarded-for": forwarded } } as any, response() as any, () => {});
  }
  assert.equal(keys[0], keys[1]);
  assert.match(keys[0], /^rate:[a-f0-9]{64}$/);
});
test("QA request limits: database failures fail closed rather than allow unlimited requests", async () => {
  const res = response();
  let passed = false;
  await requestRateLimit("login", 2, 60, async () => { throw new Error("database unavailable"); })(
    { ip: "192.0.2.1" } as any, res as any, () => { passed = true; },
  );
  assert.equal(res.statusCode, 503);
  assert.equal(passed, false);
});
test("QA payment confirmation: pending is retryable but never reported as paid", async () => {
  const request: any = async () => new Response(JSON.stringify({ paymentReference: "ref", paymentStatus: "pending" }), { status: 200 });
  await assert.rejects(fetchPaymentConfirmation("123", "ref", request), error => error instanceof PaymentConfirmationError && error.pending);
});
test("QA payment confirmation: paid and matching reference succeeds", async () => {
  const request: any = async () => new Response(JSON.stringify({ id: 123, paymentReference: "ref", paymentStatus: "paid" }), { status: 200 });
  assert.equal((await fetchPaymentConfirmation("123", "ref", request)).id, 123);
  await assert.rejects(fetchPaymentConfirmation("123", "wrong", request), error => error instanceof PaymentConfirmationError && !error.pending);
});
test("QA payment confirmation: invalid links and inaccessible orders never become success", async () => {
  const unavailable: any = async () => new Response("", { status: 404 });
  await assert.rejects(fetchPaymentConfirmation("bad", "ref", unavailable));
  await assert.rejects(fetchPaymentConfirmation("123", "ref", unavailable), error => error instanceof PaymentConfirmationError && !error.pending);
});
test("QA account mail: vendor decisions distinguish rejection, suspension and reactivation", () => {
  assert.match(vendorStatusMessage("rejected", "pending", "Documents missing").message, /Documents missing/);
  assert.equal(vendorStatusMessage("rejected", "pending").title, "Vendor application rejected");
  assert.equal(vendorStatusMessage("suspended", "approved").title, "Vendor account suspended");
  assert.equal(vendorStatusMessage("approved", "suspended").title, "Vendor account reactivated");
});
test("QA account mail: unchanged vendor status does not queue duplicate mail", async () => {
  await notifyVendorStatus({ status: "approved" }, { email: "no-delivery@example.test" }, "approved");
});
test("QA security headers: set CSP, nosniff and referrer protection while allowing required services", () => {
  const res = response();
  let next = false;
  securityHeaders({} as any, res as any, () => { next = true; });
  assert.equal(next, true);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.match(res.headers["Content-Security-Policy"], /object-src 'none'/);
  assert.match(res.headers["Content-Security-Policy"], /challenges\.cloudflare\.com/);
});
test("QA storage: configured SDK is not reported as a verified connection with invalid credentials", async t => {
  t.mock.method(S3Client.prototype, "send", async () => { throw Object.assign(new Error("private provider details"), { name: "InvalidToken" }); });
  const service = new CloudStorageService({ accessKeyId: "fixture", secretAccessKey: "fixture", region: "eu-west-1", bucketName: "fixture" });
  const result = await service.checkConnection();
  assert.equal(result.connectionReady, false);
  assert.match(result.status, /invalid or expired/);
  assert.doesNotMatch(result.status, /private provider details/);
});

test("QA storage: long-lived IAM keys do not send a stale session token", async () => {
  const service = new CloudStorageService({
    accessKeyId: `AKIA${"A".repeat(16)}`, secretAccessKey: "fixture",
    sessionToken: "old-fixture-token", region: "eu-west-1", bucketName: "fixture",
  });
  const credentials = await (service as any).s3Client.config.credentials();
  assert.equal(credentials.sessionToken, undefined);
});

test("QA storage: temporary credentials retain their matching session token", async () => {
  const service = new CloudStorageService({
    accessKeyId: `ASIA${"A".repeat(16)}`, secretAccessKey: "fixture",
    sessionToken: "matching-fixture-token", region: "eu-west-1", bucketName: "fixture",
  });
  const credentials = await (service as any).s3Client.config.credentials();
  assert.equal(credentials.sessionToken, "matching-fixture-token");
});

test("QA storage: missing bucket is distinguished from invalid credentials", async t => {
  t.mock.method(S3Client.prototype, "send", async () => { throw Object.assign(new Error("private details"), { name: "NoSuchBucket" }); });
  const service = new CloudStorageService({ accessKeyId: "fixture", secretAccessKey: "fixture", region: "eu-west-1", bucketName: "fixture" });
  const result = await service.checkConnection();
  assert.equal(result.connectionReady, false);
  assert.match(result.status, /bucket was not found/);
  assert.doesNotMatch(result.status, /private details|credentials are invalid/);
});

test("QA storage: ARN and URL settings are rejected without echoing their values", () => {
  const invalidRegion = "arn:aws:s3:::private-fixture";
  const problem = cloudStorageConfigProblem({ region: invalidRegion, bucketName: "fixture" });
  assert.match(problem!, /region code/);
  assert.ok(!problem?.includes(invalidRegion));
  for (const bucketName of ["arn:aws:s3:::private-fixture", "https://private-fixture.example", "127.0.0.1", "bad..bucket"]) {
    const error = cloudStorageConfigProblem({ region: "af-south-1", bucketName });
    assert.match(error!, /bucket name/);
    assert.ok(!error?.includes(bucketName));
  }
  assert.equal(cloudStorageConfigProblem({ region: "af-south-1", bucketName: "fixture-media" }), null);
});

test("QA storage: malformed configuration never reaches the SDK", t => {
  let requests = 0;
  t.mock.method(S3Client.prototype, "send", async () => { requests++; return {}; });
  assert.throws(() => new CloudStorageService({
    accessKeyId: "fixture", secretAccessKey: "fixture", region: "arn:aws:s3:::private-fixture", bucketName: "fixture",
  }), /region code/);
  assert.equal(requests, 0);
});

test("QA storage: explicit region codes in console display labels are normalized without guessing", () => {
  assert.equal(normalizeCloudStorageRegion("Africa (Cape Town) af-south-1"), "af-south-1");
  assert.equal(normalizeCloudStorageRegion("US-EAST-1"), "us-east-1");
  assert.equal(normalizeCloudStorageRegion("af-south-1 (Africa, Cape Town)"), "af-south-1");
  assert.equal(normalizeCloudStorageRegion("arn:aws:s3:af-south-1::fixture"), "arn:aws:s3:af-south-1::fixture");
  assert.equal(normalizeCloudStorageRegion("us-east-1 or af-south-1"), "us-east-1 or af-south-1");
  assert.equal(normalizeCloudStorageRegion("Africa Cape Town"), "Africa Cape Town");
});

test("QA storage: denied permissions are not reported as invalid credentials", async t => {
  t.mock.method(S3Client.prototype, "send", async () => { throw Object.assign(new Error("private details"), { name: "AccessDenied" }); });
  const service = new CloudStorageService({ accessKeyId: "fixture", secretAccessKey: "fixture", region: "af-south-1", bucketName: "fixture" });
  const result = await service.checkConnection();
  assert.equal(result.connectionReady, false);
  assert.match(result.status, /permissions/);
  assert.doesNotMatch(result.status, /private details|credentials are invalid/);
});
