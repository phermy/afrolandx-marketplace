import assert from "node:assert/strict";
import test from "node:test";
import { createVendorStatusHandler } from "./admin-vendor-status";
import { CAC_REVIEW_MARKER } from "./cac-review";

const applicant = { id: "applicant", roles: ["customer"], emailVerified: true };
const vendor = { id: 1, userId: applicant.id, verificationStatus: "verified", verificationNotes: `${CAC_REVIEW_MARKER}\nDocumented review`, status: "pending" };

async function invoke(actor: any, overrides: Record<string, any> = {}) {
  let status = 200, body: any;
  const approvals: unknown[] = [], writes: unknown[] = [];
  const handler = createVendorStatusHandler({
    getUser: async (id: string) => id === "actor" ? actor : overrides.applicant || applicant,
    getVendor: async () => overrides.vendor === null ? undefined : overrides.vendor || vendor,
    updateVendorStatus: async (...args: unknown[]) => { writes.push(args); },
  } as any, async (...args: any[]) => { approvals.push(args); return { ...vendor, status: "approved" }; });
  await handler({ user: { id: "actor", roles: ["admin", "superadmin"] }, params: { id: overrides.id || "1" }, body: { status: overrides.status || "approved" } } as any,
    { setHeader() {}, status(code: number) { status = code; return this; }, json(data: unknown) { body = data; return this; } } as any, () => {});
  return { status, body, approvals, writes };
}

test("every verified Admin can approve reviewed vendor applications through the shared status handler", async () => {
  for (const roles of [["admin"], ["customer", "admin"], ["vendor", "admin"], ["admin", "superadmin"]]) {
    const result = await invoke({ roles, emailVerified: true });
    assert.equal(result.status, 200);
    assert.equal(result.body.vendor.status, "approved");
    assert.deepEqual(result.approvals, [["actor", 1]]);
    assert.deepEqual(result.writes, []);
  }
});
test("vendor status uses fresh active verified Admin roles, not cached session claims", async () => {
  for (const actor of [undefined, { roles: ["customer"], emailVerified: true }, { roles: ["admin"], emailVerified: false }, { roles: ["admin"], emailVerified: true, closedAt: new Date() }]) {
    const result = await invoke(actor);
    assert.equal(result.status, 403);
    assert.deepEqual(result.approvals, []);
    assert.deepEqual(result.writes, []);
  }
});
test("vendor approval retains CAC review and permits Admin-owned business records without exposing staff profiles", async () => {
  const actor = { roles: ["admin"], emailVerified: true };
  for (const changed of [{ ...vendor, verificationStatus: "pending" }, { ...vendor, verificationNotes: null }]) {
    const result = await invoke(actor, { vendor: changed });
    assert.equal(result.status, 409);
    assert.deepEqual(result.approvals, []);
  }
  for (const status of ["approved", "rejected", "suspended"]) {
    const result = await invoke(actor, { status, applicant: { ...applicant, roles: ["customer", "admin"] } });
    assert.equal(result.status, 200);
    assert.equal(result.body.vendor.staffOwned, true);
    assert.equal(result.body.vendor.userId, undefined);
    assert.equal(result.body.vendor.verificationNotes, undefined);
    assert.equal(result.body.vendor.cacReviewComplete, true);
    assert.deepEqual(result.approvals, status === "approved" ? [["actor", 1]] : []);
    assert.deepEqual(result.writes, status === "approved" ? [] : [[1, status]]);
  }
  for (const applicant of [
    { ...vendor, roles: ["customer", "admin", "superadmin"], emailVerified: true },
    { ...vendor, roles: ["customer", "admin"], email: "femi.elegbeleye@afrolandx.com", emailVerified: true },
  ]) {
    assert.equal((await invoke(actor, { applicant })).status, 404);
  }
});
test("vendor decisions reject malformed references and refreshable missing records", async () => {
  const actor = { roles: ["admin"], emailVerified: true };
  for (const id of ["1junk", "0", "-1", "9007199254740992"]) assert.equal((await invoke(actor, { id })).status, 400);
  assert.equal((await invoke(actor, { vendor: null })).status, 404);
  assert.equal((await invoke(actor, { status: "delete" })).status, 400);
  for (const status of ["pending", "rejected", "suspended"]) {
    assert.deepEqual((await invoke(actor, { status })).writes, [[1, status]]);
  }
});
