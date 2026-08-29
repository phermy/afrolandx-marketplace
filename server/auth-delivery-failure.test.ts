import assert from "node:assert/strict";
import test from "node:test";
import { createRegisterHandler } from "./auth";

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