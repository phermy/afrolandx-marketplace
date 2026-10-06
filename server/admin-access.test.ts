import assert from "node:assert/strict";
import test from "node:test";
import { storage } from "./storage";
import { managementGuard } from "./admin-management-guard";
import { canSeeManagedAccount, requireFullManagement } from "./admin-access";
import { DESIGNATED_OWNER_EMAIL } from "./admin-role-bootstrap";
import { hasFullManagementAccess, isSupportManagementRoute } from "../shared/admin-access";
import { getAdminUserDetails } from "./admin-user-details";
import { getLogisticsAccess, lockLogisticsActor } from "./logistics-access";

test("management access separates Superadmin controls from customer and vendor support", async t => {
  const accounts = new Map<string, any>([
    ["super", { id: "super", emailVerified: true, roles: ["customer", "admin", "superadmin"] }],
    ["admin", { id: "admin", emailVerified: true, roles: ["customer", "admin"] }],
    ["staff-vendor", { id: "staff-vendor", emailVerified: true, roles: ["vendor", "admin", "customer"] }],
    ["vendor", { id: "vendor", emailVerified: true, roles: ["vendor", "customer"] }],
    ["customer", { id: "customer", emailVerified: false, roles: ["customer"] }],
    ["unverified", { id: "unverified", emailVerified: false, roles: ["admin", "superadmin"] }],
    ["closed", { id: "closed", emailVerified: true, closedAt: new Date(), roles: ["admin", "superadmin"] }],
    ["owner", { id: "owner", email: DESIGNATED_OWNER_EMAIL, roles: ["customer"] }],
  ]);
  t.mock.method(storage, "getUser", async (id: string) => accounts.get(id));
  t.mock.method(storage, "getVendor", async (id: number) => ({ userId: id === 1 ? "vendor" : "staff-vendor" }));
  t.mock.method(storage, "getOrder", async (id: number) => ({ userId: id === 1 ? "customer" : "admin" }));
  t.mock.method(storage, "getShippingQuoteRequest", async (id: number) => ({ userId: id === 1 ? "customer" : "admin" }));

  async function invoke(actor: string, method: string, path: string, fullOnly = false) {
    let status = 200, nextCalled = false, body: any;
    const req: any = { user: { id: actor, roles: ["admin", "superadmin"] }, method, path };
    const res: any = {
      setHeader() {},
      status(value: number) { status = value; return this; },
      json(value: any) { body = value; return this; },
    };
    await (fullOnly ? requireFullManagement : managementGuard)(req, res, () => { nextCalled = true; });
    return { status, nextCalled, body, actor: req.managementActor };
  }

  await t.test("regular Admins can read and resolve customer and vendor support records", async () => {
    for (const [method, path] of [
      ["GET", "/users"], ["GET", "/users/customer"], ["GET", "/users/vendor"], ["GET", "/vendors"],
      ["GET", "/orders"], ["GET", "/products/pending"], ["GET", "/reviews"],
      ["PATCH", "/orders/1/status"], ["PATCH", "/orders/1/tracking"],
      ["PATCH", "/shipping-quote-requests/1"], ["PATCH", "/vendors/1/verification"],
      ["POST", "/vendors/1/products"], ["POST", "/products/bulk-approve"],
    ]) assert.equal((await invoke("admin", method, path)).nextCalled, true, `${method} ${path}`);
  });
  await t.test("administrator, mixed-role staff, and protected owner profiles cannot be inspected", async () => {
    for (const id of ["admin", "super", "staff-vendor", "owner", "missing"]) {
      assert.equal((await invoke("admin", "GET", `/users/${id}`)).status, 404);
      assert.equal(await getAdminUserDetails(storage, id, accounts.get("admin")), null);
    }
    assert.equal((await invoke("admin", "PATCH", "/orders/2/status")).status, 404);
    assert.equal((await invoke("admin", "PATCH", "/vendors/2/verification")).status, 404);
    assert.equal((await invoke("admin", "PATCH", "/shipping-quote-requests/2")).status, 404);
    assert.equal(canSeeManagedAccount(accounts.get("admin"), accounts.get("customer")), true);
    assert.equal(canSeeManagedAccount(accounts.get("admin"), accounts.get("staff-vendor")), false);
  });
  await t.test("full management and destructive controls reject Admins even with guessed URLs", async () => {
    for (const [method, path] of [
      ["GET", "/analytics"], ["GET", "/stats"], ["GET", "/finance"], ["GET", "/event-planners"],
      ["GET", "/cloud-storage-status"], ["GET", "/users/customer/test-data-deletion-preview"],
      ["DELETE", "/users/customer"], ["DELETE", "/users/vendor/test-data"],
      ["POST", "/users/customer/close"], ["POST", "/users/customer/roles/admin"],
      ["POST", "/vendors/1/settlements"], ["POST", "/orders/1/refunds"],
      ["GET", "/future-management-feature"],
    ]) {
      assert.equal((await invoke("admin", method, path)).status, 403, `${method} ${path}`);
      assert.equal((await invoke("super", method, path)).nextCalled, true, `${method} ${path}`);
    }
    assert.equal((await invoke("admin", "POST", "/any", true)).status, 403);
    assert.equal((await invoke("super", "POST", "/any", true)).nextCalled, true);
    assert.equal((await invoke("super", "GET", "/users/admin")).nextCalled, true);
  });
  await t.test("current verified active roles are required; cached session roles cannot restore access", async () => {
    for (const actor of ["unverified", "closed", "customer", "missing"]) {
      assert.equal((await invoke(actor, "GET", "/users")).status, 403);
      assert.equal((await invoke(actor, "GET", "/finance", true)).status, 403);
    }
    assert.equal((await invoke("admin", "GET", "/analytics")).status, 403);
    assert.equal(hasFullManagementAccess(accounts.get("unverified")), false);
    assert.equal(isSupportManagementRoute("DELETE", "/users/vendor"), false);
    assert.equal(isSupportManagementRoute("GET", "/users/admin/test-data"), false);
  });
  await t.test("ordinary Admins cannot use shipping administration or agency financial controls", async () => {
    const tx: any = { execute: async () => {}, select: () => ({ from: () => ({ where: async () => [accounts.get("admin")] }) }) };
    await assert.rejects(lockLogisticsActor(tx, "admin", true), /Superadmin access/);
    assert.equal((await lockLogisticsActor(tx, "admin")).admin, false);
    // Reject before any shipment or partner query when an inactive actor requests access.
    await assert.rejects(getLogisticsAccess("unverified"), /verified/);
  });
});
