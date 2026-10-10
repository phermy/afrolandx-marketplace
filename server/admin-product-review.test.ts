import assert from "node:assert/strict";
import test from "node:test";
import { createProductReviewHandlers } from "./admin-product-review";
import { managementGuard } from "./admin-management-guard";
import { storage } from "./storage";
import { getProductApprovalIssues, productApprovalMessage } from "../shared/product-approval";

const valid = { id: 21, vendorId: 4, categoryId: 2, status: "pending", name: "Woven bag",
  description: "Handwoven bag", price: "15000", stock: 0, images: ["https://example.test/bag.jpg"], imageUrl: null };
const vendor = { id: 4, businessName: "Makers", status: "approved", verificationStatus: "verified",
  userId: "staff-vendor", email: "private@example.test" };

test("every verified Admin can privately review and approve a vendor submission", async t => {
  for (const roles of [["admin"], ["customer", "admin"], ["vendor", "admin"], ["admin", "superadmin"]]) {
    await t.test(roles.join("+"), async () => {
      const writes: number[] = [];
      const handlers = createProductReviewHandlers({
        getUser: async () => ({ id: "reviewer", emailVerified: true, roles }),
        getProduct: async () => valid,
        getVendor: async () => vendor,
        getCategories: async () => [{ id: 2, name: "Accessories" }],
        updateProductStatus: async () => { throw new Error("Approval must use transactional validation"); },
      } as any, async id => { writes.push(id); return { approved: true }; });
      const details = await invoke(handlers.getDetails);
      assert.equal(details.status, 200);
      assert.equal(details.body.product.status, "pending");
      assert.deepEqual(details.body.approvalIssues, []);
      assert.equal(details.body.vendor.businessName, "Makers");
      assert.equal(details.body.vendor.userId, undefined);
      assert.equal(details.body.vendor.email, undefined);
      const approval = await invoke(handlers.updateStatus, { body: { status: "approved" } });
      assert.equal(approval.status, 200);
      assert.deepEqual(writes, [21]);
    });
  }
});

test("fresh verified, active Admin roles are required, including on the legacy handler", async () => {
  for (const account of [
    undefined, { roles: ["customer"], emailVerified: true },
    { roles: ["vendor"], emailVerified: true },
    { roles: ["admin"], emailVerified: false },
    { roles: ["admin", "superadmin"], emailVerified: true, closedAt: new Date() },
  ]) {
    const handlers = createProductReviewHandlers({
      getUser: async () => account,
      getProduct: async () => { throw new Error("Unauthorized product read"); },
    } as any, async () => { throw new Error("Unauthorized approval"); });
    for (const handler of [handlers.getDetails, handlers.updateStatus]) {
      // The cached session falsely claims Superadmin; only current storage wins.
      const result = await invoke(handler, { user: { id: "reviewer", roles: ["admin", "superadmin"] }, body: { status: "approved" } });
      assert.equal(result.status, 403);
      assert.match(result.body.message, /Verified Admin/);
    }
  }
});

test("missing records, malformed IDs and approval conflicts have distinct meaningful errors", async () => {
  const handlers = createProductReviewHandlers({
    getUser: async () => ({ roles: ["admin"], emailVerified: true }),
    getProduct: async () => undefined,
  } as any, async id => ({ approved: false, reason: id === 21 ? "missing_image" : "not_found" }));
  for (const id of ["21junk", "-1", "0", "9007199254740992"]) {
    assert.equal((await invoke(handlers.getDetails, { params: { id } })).status, 400);
    assert.equal((await invoke(handlers.updateStatus, { params: { id }, body: { status: "approved" } })).status, 400);
  }
  assert.equal((await invoke(handlers.getDetails)).status, 404);
  assert.equal((await invoke(handlers.updateStatus, { body: { status: "rejected" } })).status, 404);
  assert.equal((await invoke(handlers.updateStatus, { body: { status: "deleted" } })).status, 400);
  assert.equal((await invoke(handlers.updateStatus, { params: { id: "22" }, body: { status: "approved" } })).status, 404);
  const conflict = await invoke(handlers.updateStatus, { body: { status: "approved" } });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.reason, "missing_image");
  assert.match(conflict.body.message, /upload at least one product photo/);
});

test("pending and rejected status changes work for ordinary Admins", async () => {
  const writes: unknown[] = [];
  const handlers = createProductReviewHandlers({
    getUser: async () => ({ roles: ["admin"], emailVerified: true }),
    getProduct: async () => valid,
    updateProductStatus: async (...args: unknown[]) => { writes.push(args); },
  } as any, async () => { throw new Error("No approval expected"); });
  for (const status of ["rejected", "pending"]) {
    assert.equal((await invoke(handlers.updateStatus, { body: { status } })).status, 200);
  }
  assert.deepEqual(writes, [[21, "rejected"], [21, "pending"]]);
});

test("private review exposes all blockers and uses the same listing validation as approval", () => {
  assert.deepEqual(getProductApprovalIssues(valid, vendor, true), []);
  const missingImages = getProductApprovalIssues({ ...valid, images: [], imageUrl: "" }, vendor, true);
  assert.deepEqual(missingImages.map(issue => issue.code), ["missing_image"]);
  assert.equal(missingImages[0].message, productApprovalMessage("missing_image"));
  assert.equal(getProductApprovalIssues({ ...valid, images: [], imageUrl: "https://example.test/old.jpg" }, vendor, true).length, 0);
  const invalid = getProductApprovalIssues({
    ...valid, status: "draft", name: " ", description: "", price: "NaN", stock: -1, images: [" "],
  }, { status: "pending", verificationStatus: "pending" }, false);
  assert.deepEqual(invalid.map(issue => issue.code), [
    "not_pending", "vendor_not_approved", "vendor_not_verified", "missing_name", "missing_description",
    "invalid_price", "invalid_stock", "invalid_category", "missing_image",
  ]);
});

test("management route boundary allows all product reviewers but keeps staff accounts and unrelated controls protected", async t => {
  t.mock.method(storage, "getUser", async () => ({ roles: ["admin"], emailVerified: true }) as any);
  for (const [method, path, expected] of [
    ["GET", "/products/pending", 200], ["GET", "/products/21", 200],
    ["PATCH", "/products/21/status", 200],
    ["PATCH", "/products/21/featured", 403], ["GET", "/products/all", 403],
    ["DELETE", "/products/21", 403], ["GET", "/finance", 403],
    ["GET", "/users/another-admin", 404],
  ]) {
    const result = await invoke(managementGuard, { method, path });
    assert.equal(result.status, expected, `${method} ${path}`);
    assert.equal(result.nextCalled, expected === 200);
  }
});

async function invoke(handler: any, overrides: Record<string, unknown> = {}) {
  let status = 200, body: any, nextCalled = false;
  const headers: Record<string, unknown> = {};
  const req = { user: { id: "reviewer" }, params: { id: "21" }, body: {}, ...overrides };
  const res = {
    setHeader(key: string, value: unknown) { headers[key] = value; },
    status(value: number) { status = value; return this; },
    json(value: unknown) { body = value; return this; },
  };
  await handler(req, res, () => { nextCalled = true; });
  assert.equal(headers["Cache-Control"], "no-store");
  return { status, body, nextCalled };
}
