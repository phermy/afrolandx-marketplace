import assert from "node:assert/strict";
import test from "node:test";
import { createRegisterHandler, sanitizeUser } from "./auth";
import { normalizeAccountPhone } from "../shared/account-registration";
import { getAdminUserDetails } from "./admin-user-details";

function registration(body: Record<string, unknown>) {
  let saved: any;
  let code = 200;
  let result: any;
  const handler = createRegisterHandler({
    storage: {
      getUserByEmail: async () => undefined,
      upsertUser: async (user: any) => (saved = { ...user, roles: ["customer"], emailVerified: false }),
      getUser: async () => saved,
    } as any,
    issueOtp: async () => {},
    hashPassword: async () => "hash",
    createId: () => "new-user",
    isRateLimited: () => false,
  });
  return {
    run: () => handler({ body: { email: "test@example.com", password: "valid-password", ...body } }, {
      status(value: number) { code = value; return this; },
      json(value: any) { result = value; return this; },
    }),
    state: () => ({ saved, code, result }),
  };
}

test("phone normalization accepts local and international numbers, rejects malformed numbers", () => {
  assert.equal(normalizeAccountPhone("+234 (800) 000-0000"), "+2348000000000");
  assert.equal(normalizeAccountPhone("08000000000"), "08000000000");
  for (const phone of [undefined, null, "", "123", "phone08000000", "++2348000000", "1".repeat(16)]) {
    assert.equal(normalizeAccountPhone(phone), null);
  }
});

test("registration requires phone before creating an account", async () => {
  for (const phone of [undefined, "", "invalid", "123"]) {
    const scenario = registration({ phone });
    await scenario.run();
    assert.equal(scenario.state().code, 400);
    assert.equal(scenario.state().saved, undefined);
  }
});

test("customer registration stores normalized phone", async () => {
  const scenario = registration({ phone: "+234 800 000 0000" });
  await scenario.run();
  assert.equal(scenario.state().saved.phone, "+2348000000000");
  assert.equal(scenario.state().saved.signupIntent, "customer");
});

test("vendor signup persists application intent without granting vendor or admin access", async () => {
  const scenario = registration({ phone: "+2348000000000", signupIntent: "vendor", roles: ["admin", "vendor"] });
  await scenario.run();
  const { saved } = scenario.state();
  assert.equal(saved.signupIntent, "vendor");
  assert.equal(saved.emailVerified, false);
  assert.deepEqual(saved.roles, ["customer"]);
  assert.equal(sanitizeUser(saved).signupIntent, "vendor");
});

test("registration rejects elevated signup intents", async () => {
  const scenario = registration({ phone: "+2348000000000", signupIntent: "superadmin" });
  await scenario.run();
  assert.equal(scenario.state().code, 400);
  assert.equal(scenario.state().saved, undefined);
});

test("admin details return contact, addresses, and orders without authentication or payment secrets", async () => {
  const details = await getAdminUserDetails({
    getUser: async () => ({
      id: "customer", email: "test@example.com", phone: "+2348000000000",
      password: "secret-hash", emailOtp: "secret-code", activeSessionId: "secret-session",
    }),
    getSavedDeliveryAddresses: async () => [{ id: 1, label: "Home", address1: "Sample street", country: "Nigeria" }],
    getOrdersForUser: async () => [{ id: 2, totalAmount: "5000", paymentReference: "secret-payment", paymentUrl: "secret-url" }],
    getVendorByUserId: async () => undefined,
  } as any, "customer");
  assert.equal(details?.account.phone, "+2348000000000");
  assert.equal(details?.orderCount, 1);
  assert.equal(details?.addresses[0].label, "Home");
  assert.equal(details?.orders[0].id, 2);
  assert.equal(JSON.stringify(details).includes("secret"), false);
});

test("admin details return null for missing accounts", async () => {
  assert.equal(await getAdminUserDetails({ getUser: async () => undefined } as any, "missing"), null);
});
