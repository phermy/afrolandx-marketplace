import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { securityHeaders, withCspNonce } from "./security-headers";
import { loadOwnedOrder } from "./owned-order";
import { assessPassword, PasswordCheckUnavailable } from "./password-safety";
import { growingLoginDelay } from "./login-delay";
import { createLoginCodeRequestHandler, LOGIN_CODE_RESPONSE } from "./login-code-request";
import { rejectClientAmounts } from "./server-amounts";
import { calculateCheckoutSubtotal } from "./order-security";
import { policies } from "../client/src/lib/policies";

function response() {
  return {
    code: 200, body: undefined as any, headers: {} as Record<string, string>, locals: {} as any,
    setHeader(key: string, value: string) { this.headers[key] = value; },
    removeHeader(key: string) { delete this.headers[key]; },
    status(code: number) { this.code = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}
test("production security headers use a per-response script nonce and HTTPS HSTS", () => {
  const req = { app: { get: () => "production" }, secure: true };
  const res = response(); res.headers["X-Powered-By"] = "Express";
  securityHeaders(req as any, res as any, () => {});
  assert.equal(res.headers["X-Powered-By"], undefined);
  assert.match(res.headers["Strict-Transport-Security"], /max-age=31536000/);
  assert.equal(res.headers["X-Frame-Options"], "SAMEORIGIN");
  const csp = res.headers["Content-Security-Policy"];
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /script-src-attr 'none'/);
  assert.match(csp, /nonce-/);
  assert.doesNotMatch(csp.match(/script-src [^;]+/)![0], /unsafe-inline/);
  assert.doesNotMatch(csp, /fonts\.google|fonts\.gstatic|connect-src 'self' https:(?:\s|;)/);
  assert.match(res.headers["Permissions-Policy"], /camera=\(self\)/);
  const other = response(); securityHeaders(req as any, other as any, () => {});
  assert.notEqual(res.locals.cspNonce, other.locals.cspNonce);
  assert.equal(withCspNonce("<script>hello</script><script src='/main.js'></script>", res.locals.cspNonce).match(/nonce=/g)?.length, 2);
});
test("the shared loader returns identical 404s for absent, foreign and invalid orders", async () => {
  const results = [];
  for (const [id, order] of [["99", undefined], ["99", { id: 99, userId: "other" }], ["99oops", { id: 99, userId: "buyer" }]] as const) {
    const res = response();
    const result = await loadOwnedOrder({ user: { id: "buyer" } } as any, res as any, id, { getOrder: async () => order } as any);
    assert.equal(result, undefined);
    results.push([res.code, res.body, res.headers]);
  }
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[0], results[2]);
  const order = { id: 99, userId: "buyer" };
  assert.equal(await loadOwnedOrder({ user: { id: "buyer" } } as any, response() as any, "99", { getOrder: async () => order } as any), order);
});
test("buyer supplied monetary fields are rejected; the expected total is only an assertion", () => {
  for (const field of ["amount", "totalAmount", "shippingAmount", "subtotal", "discountAmount"]) {
    const res = response(); let next = false;
    rejectClientAmounts({ body: { [field]: 1 } } as any, res as any, () => { next = true; });
    assert.equal(res.code, 400); assert.equal(next, false);
  }
  let next = false;
  rejectClientAmounts({ body: { expectedTotalAmount: 1, shippingQuoteId: 2 } } as any, response() as any, () => { next = true; });
  assert.equal(next, true);
  assert.equal(calculateCheckoutSubtotal([0.1, 0.2].map(price => ({ quantity: 1, product: { name: "Item", price, stock: 1, status: "approved" } }))), 0.3);
});
test("password safety rejects common and breached values using only a hash prefix", async () => {
  assert.ok(await assessPassword("Password123456!"));
  const password = "a-test-password-with-entropy-495";
  const digest = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const fetcher = async (url: any, options: any) => {
    assert.equal(url, `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`);
    assert.equal(options.headers["Add-Padding"], "true");
    assert.ok(!JSON.stringify(options).includes(password));
    return new Response(`${digest.slice(5)}:123\r\n${"0".repeat(35)}:0`);
  };
  assert.match((await assessPassword(password, undefined, fetcher as any))!, /data breach/);
  assert.equal(await assessPassword(password, undefined, (async () => new Response(`${digest.slice(5)}:0`)) as any), null);
  await assert.rejects(assessPassword(password, undefined, (async () => new Response("invalid")) as any), PasswordCheckUnavailable);
  await assert.rejects(assessPassword(password, undefined, (async () => { throw new Error("offline"); }) as any), PasswordCheckUnavailable);
});
test("login delays grow, cap at eight seconds, share normalized account limits and fail closed", async () => {
  const delays: number[] = []; const keys: string[] = [];
  for (const count of [1, 2, 3, 6, 10]) {
    const middleware = growingLoginDelay("test", async key => {
      keys.push(key); return { count, retry_after: 900 };
    }, async ms => { delays.push(ms); });
    await middleware({ ip: "127.0.0.1", body: { email: " USER@example.com " } } as any, response() as any, () => {});
  }
  assert.deepEqual(delays, [0, 500, 1000, 8000, 8000]);
  assert.ok(keys.every(key => !key.includes("example.com")));
  const limited = response();
  await growingLoginDelay("test", async () => ({ count: 13, retry_after: 123 }), async () => {} )({ ip: "x", body: {} } as any, limited as any, () => assert.fail());
  assert.equal(limited.code, 429); assert.equal(limited.headers["Retry-After"], "123");
  const unavailable = response();
  await growingLoginDelay("test", async () => { throw new Error("offline"); })({ ip: "x", body: {} } as any, unavailable as any, () => assert.fail());
  assert.equal(unavailable.code, 503);
});
test("code requests do not expose missing, closed, throttled or undeliverable accounts", async () => {
  for (const user of [undefined, { id: "closed", closedAt: new Date() }, { id: "open" }]) {
    const res = response();
    const handler = createLoginCodeRequestHandler({
      getUserByEmail: async () => user,
      issueOtp: async () => { throw new Error("rate limited or provider unavailable"); },
    });
    await handler({ body: { email: "test@example.com" } } as any, res as any, () => {});
    assert.equal(res.code, 200); assert.deepEqual(res.body, LOGIN_CODE_RESPONSE);
  }
  const res = response();
  await createLoginCodeRequestHandler({
    getUserByEmail: async () => ({ id: "open" }),
    issueOtp: async () => new Promise(() => {}),
  })({ body: { email: "test@example.com" } } as any, res as any, () => {});
  assert.deepEqual(res.body, LOGIN_CODE_RESPONSE, "Provider latency does not delay the response");
});
test("privacy policy names the NDPA and providers; font assets and consent plan are local", () => {
  const text = JSON.stringify(policies.find(policy => policy.slug === "privacy-and-cookie-policy"));
  for (const name of ["NDPA", "Nigeria Data Protection Act 2023", "Paystack", "Replit", "Cloudflare", "Resend", "SendGrid", "Shipbubble", "Terminal Africa", "OpenAI", "Replicate", "Pwned Passwords"]) assert.ok(text.includes(name), name);
  const css = readFileSync("client/public/fonts/fonts.css", "utf8");
  assert.doesNotMatch(css, /https?:/);
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) assert.ok(existsSync(`client/public${match[1]}`));
  assert.ok(existsSync("docs/consent-banner-plan.md"));
});
