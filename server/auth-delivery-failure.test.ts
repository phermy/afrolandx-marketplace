import assert from "node:assert/strict";
import test from "node:test";
import { createRegisterHandler as registerWithChecks } from "./auth";
const createRegisterHandler = (dependencies: Omit<Parameters<typeof registerWithChecks>[0], "assessPassword">) =>
  registerWithChecks({ ...dependencies, assessPassword: async () => null });

test("registration rejects a breached password before storage, hashing or email delivery", async () => {
  let status = 200;
  const fail = async () => assert.fail("No account operation is permitted");
  const handler = registerWithChecks({
    assessPassword: async () => "This password has appeared in a data breach.",
    storage: { getUserByEmail: fail, upsertUser: fail, getUser: fail },
    hashPassword: fail, issueOtp: fail, createId: () => assert.fail(), isRateLimited: () => false,
  });
  await handler({ body: { email: "test@example.com", password: "a-valid-length-password-294", firstName: "Test", phone: "+2348000000000" } }, {
    status(code: number) { status = code; return this; },
    json(body: any) { assert.match(body.message, /data breach/); },
  });
  assert.equal(status, 400);
});

test("registration delivery failure never issues a session", async () => {
  const id = "delivery-failure-user";
  const email = "delivery-failure@example.com";
  let savedUser: any;
  let loginCalls = 0;
  let statusCode = 200;
  let responseBody: any;
  const responseHeaders = new Map<string, string>();

  const handler = createRegisterHandler({
    storage: {
      getUserByEmail: async () => undefined,
      upsertUser: async (user) => {
        savedUser = { ...user, emailVerified: false };
        return savedUser;
      },
      getUser: async () => savedUser,
    } as any,
    issueOtp: async () => {
      throw new Error("controlled email delivery failure");
    },
    hashPassword: async () => "hashed-password",
    createId: () => id,
    isRateLimited: () => false,
  });

  const req = {
    body: {
      email,
      password: "strong-password",
      phone: "+2348000000000",
      firstName: "Delivery",
      lastName: "Failure",
    },
    login: () => {
      loginCalls += 1;
    },
  };
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      responseHeaders.set(name.toLowerCase(), value);
      return this;
    },
    json(body: any) {
      responseBody = body;
      return this;
    },
  };

  await handler(req, res);

  assert.equal(statusCode, 201);
  assert.equal(responseBody.emailVerificationSent, false);
  assert.equal(loginCalls, 0);
  assert.equal(responseHeaders.has("set-cookie"), false);
});

test("registration rejects an existing email before creating another account", async () => {
  let inserted = false;
  let lookedUpEmail = "";
  let statusCode = 200;
  let responseBody: any;
  const handler = createRegisterHandler({
    storage: {
      getUserByEmail: async (email: string) => {
        lookedUpEmail = email;
        return { id: "existing-user" };
      },
      upsertUser: async () => {
        inserted = true;
        throw new Error("should not insert");
      },
      getUser: async () => undefined,
    } as any,
    issueOtp: async () => { throw new Error("should not send a code"); },
    hashPassword: async () => { throw new Error("should not hash a duplicate"); },
    createId: () => "another-user",
    isRateLimited: () => false,
  });
  await handler(
    { body: { email: "  EXISTING@example.com  ", password: "strong-password", firstName: "Test", phone: "+2348000000000" } },
    { status(code: number) { statusCode = code; return this; }, json(body: any) { responseBody = body; return this; } },
  );
  assert.equal(lookedUpEmail, "existing@example.com");
  assert.equal(statusCode, 409);
  assert.equal(responseBody.hint, "SIGN_IN");
  assert.equal(inserted, false);
});

test("registration handles a concurrent email uniqueness conflict", async () => {
  let statusCode = 200;
  let responseBody: any;
  const handler = createRegisterHandler({
    storage: {
      getUserByEmail: async () => undefined,
      upsertUser: async () => { throw Object.assign(new Error("duplicate key"), { code: "23505" }); },
      getUser: async () => undefined,
    } as any,
    issueOtp: async () => { throw new Error("should not send a code"); },
    hashPassword: async () => "hashed-password",
    createId: () => "another-user",
    isRateLimited: () => false,
  });
  await handler(
    { body: { email: "existing@example.com", password: "strong-password", firstName: "Test", phone: "+2348000000000" } },
    { status(code: number) { statusCode = code; return this; }, json(body: any) { responseBody = body; return this; } },
  );
  assert.equal(statusCode, 409);
  assert.equal(responseBody.hint, "SIGN_IN");
});

test("registration requires a valid security token before creating an account", async () => {
  let inserted = false;
  let verified = 0;
  let statusCode = 200;
  const handler = createRegisterHandler({
    storage: {
      getUserByEmail: async () => undefined,
      upsertUser: async () => { inserted = true; },
      getUser: async () => ({ id: "new-user" }),
    } as any,
    issueOtp: async () => {},
    hashPassword: async () => "hash",
    createId: () => "new-user",
    isRateLimited: () => false,
    verifyBotToken: async token => { verified++; return token === "valid-token"; },
  });
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(_body: any) { return this; },
  };
  const req = { body: { email: "new@example.com", password: "secure-password", firstName: "Test", phone: "+2348000000000" } };
  await handler(req, res);
  assert.equal(statusCode, 400);
  assert.equal(verified, 0);
  assert.equal(inserted, false);
  statusCode = 200;
  req.body = { ...req.body, turnstileToken: "bad-token" } as typeof req.body;
  await handler(req, res);
  assert.equal(statusCode, 400);
  assert.equal(verified, 1);
  assert.equal(inserted, false);
  statusCode = 200;
  req.body = { ...req.body, turnstileToken: "valid-token" };
  await handler(req, res);
  assert.equal(statusCode, 200);
  assert.equal(verified, 2);
  assert.equal(inserted, true);
});

test("registration does not create an account if Turnstile is unavailable", async () => {
  let inserted = false;
  let statusCode = 200;
  const handler = createRegisterHandler({
    storage: {
      getUserByEmail: async () => undefined,
      upsertUser: async () => { inserted = true; },
      getUser: async () => undefined,
    } as any,
    issueOtp: async () => {},
    hashPassword: async () => "hash",
    createId: () => "new-user",
    isRateLimited: () => false,
    verifyBotToken: async () => { throw new Error("provider down"); },
  });
  await handler(
    { body: { email: "new@example.com", password: "secure-password", firstName: "Test", phone: "+2348000000000", turnstileToken: "token" } },
    { status(code: number) { statusCode = code; return this; }, json(_body: any) { return this; } },
  );
  assert.equal(statusCode, 503);
  assert.equal(inserted, false);
});