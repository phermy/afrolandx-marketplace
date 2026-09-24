import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import session from "express-session";
import { registerHumanVerification } from "./human-verification";

const app = express();
app.use(express.json());
app.use(session({
  secret: "test-only-secret",
  resave: false,
  saveUninitialized: false,
}));

let accepted = false;
registerHumanVerification(app, {
  siteKey: "public-test-key",
  secretKey: "private-test-key",
  intervalMs: 250,
  verifyToken: async (token, secret) => {
    assert.equal(secret, "private-test-key");
    return accepted && token === "valid-token";
  },
});
app.post("/api/write", (_req, res) => res.json({ saved: true }));
app.post("/api/webhooks/paystack", (_req, res) => res.json({ accepted: true }));
app.post("/api/logout", (_req, res) => res.json({ signedOut: true }));

const server = app.listen(0);
before(() => new Promise<void>((resolve) => server.once("listening", resolve)));
after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("periodic challenge blocks writes, requires a valid provider token, and spares callbacks and logout", async () => {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const status = await fetch(`${base}/api/human-verification/status`);
  const cookie = status.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  assert.deepEqual((await status.json()).enabled, true);
  const post = (path: string, body = {}) => fetch(`${base}${path}`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  await new Promise((resolve) => setTimeout(resolve, 280));
  assert.equal((await post("/api/write")).status, 428);
  assert.equal((await post("/api/webhooks/paystack")).status, 200);
  assert.equal((await post("/api/logout")).status, 200);
  assert.equal((await post("/api/human-verification/verify", { token: "bad-token" })).status, 400);
  assert.equal((await post("/api/write")).status, 428);
  accepted = true;
  assert.equal((await post("/api/human-verification/verify", { token: "valid-token" })).status, 200);
  assert.equal((await post("/api/write")).status, 200);
});