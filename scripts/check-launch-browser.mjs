// Public pages use real read-only responses. Signed-in UI checks use browser-only
// fixtures, never server auth bypasses. All API writes are intercepted.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000";
const realEmail = process.argv.find(argument => argument.startsWith("--qa-email="))?.slice(11);
let realCookie;
let databasePool;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), "afrolandx-launch-browser-"));
const browser = spawn("chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const checks = [], exceptions = [], blockedWrites = [];
const product = { id: 900001, vendorId: 900001, name: "Fixture garment", price: "8500.00", stock: 10, status: "approved", imageUrl: "/favicon.ico", description: "Browser fixture only", sizes: ["M"] };
const cart = [{ id: 900001, productId: product.id, quantity: 1, selectedSize: "M", product }];
const order = { id: 900001, userId: "browser-fixture", totalAmount: "8503.00", shippingAmount: "1.00", shippingEstimatedAmount: "1.00", shippingPaymentStatus: "awaiting_quote", paymentStatus: "paid", orderStatus: "pending", paymentReference: "browser-fixture-reference", createdAt: new Date().toISOString(), shippingAddress: { firstName: "Fixture", lastName: "Customer", address1: "Fixture address", city: "Fixture city", state: "Fixture state", postalCode: "00000", country: "Nigeria" }, items: [{ id: 900001, productId: product.id, quantity: 1, priceAtTime: "8500.00", product }], vendorTotal: 8500 };
let socket, sessionId, targetId;
const sessions = new Map(), pending = new Map();
let nextId = 0;
async function check(name, action) {
  try { await action(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: error.message }); }
  console.log(JSON.stringify(checks.at(-1)));
}
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Browser did not start")), 20000);
    let output = "";
    browser.stderr.on("data", data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    browser.once("error", reject);
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  function send(method, params = {}, session = sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 20000);
      pending.set(id, { resolve, reject, timer });
      const connectionSession = method.startsWith("Target.") ? undefined : session;
      socket.send(JSON.stringify({ id, method, params, ...(connectionSession ? { sessionId: connectionSession } : {}) }));
    });
  }
  async function intercept(message) {
    const { request, requestId } = message.params;
    const state = sessions.get(message.sessionId);
    const path = new URL(request.url).pathname;
    let body, status = 200;
    if (!["GET", "HEAD"].includes(request.method)) {
      blockedWrites.push({ path, method: request.method });
      body = { success: true };
      if (realEmail) { status = 403; body = { message: "Browser writes blocked during read-only QA." }; }
    } else if (!state?.role) {
      await send("Fetch.continueRequest", { requestId }, message.sessionId);
      return;
    } else if (path === "/api/auth/user") {
      body = { id: "browser-fixture", email: "browser-fixture@example.test", firstName: "Fixture", lastName: "Customer", emailVerified: true, roles: state.role === "vendor" ? ["customer", "vendor"] : ["customer"] };
    } else if (path === "/api/cart") {
      if (state.delayCart) await wait(state.delayCart);
      body = state.cartError ? { message: "Fixture cart failure" } : cart;
      status = state.cartError ? 503 : 200;
    } else if (path === "/api/orders/my-orders" || path === "/api/orders") body = [order];
    else if (path === "/api/vendors/orders" || path === "/api/vendors/me/orders") body = [{ ...order, items: order.items.map(item => ({ ...item, productName: product.name, imageUrl: product.imageUrl })) }];
    else if (path === "/api/vendors/me") body = { id: 900001, userId: "browser-fixture", businessName: "Fixture maker", status: "approved", verificationStatus: "verified", email: "browser-fixture@example.test", description: "Browser fixture only" };
    else if (path === "/api/geo") body = { country_code: "NG", country_name: "Nigeria", currency: "NGN" };
    else if (/^\/api\/orders\/\d+$/.test(path)) body = order;
    else body = [];
    await send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") }, message.sessionId);
  }
  socket.on("message", data => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const call = pending.get(message.id); pending.delete(message.id); clearTimeout(call.timer);
      if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === "Fetch.requestPaused") intercept(message).catch(error => {
      if (!/closed|session|target/i.test(error.message)) exceptions.push(error.message);
    });
  });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const open = async (route, state = {}, width = 390) => {
    if (targetId) { sessions.delete(sessionId); await send("Target.closeTarget", { targetId }, undefined); }
    ({ targetId } = await send("Target.createTarget", { url: "about:blank" }, undefined));
    ({ sessionId } = await send("Target.attachToTarget", { targetId, flatten: true }, undefined));
    sessions.set(sessionId, state);
    await send("Page.enable"); await send("Runtime.enable");
    if (realCookie) {
      const separator = realCookie.indexOf("=");
      await send("Network.setCookie", { name: realCookie.slice(0, separator), value: realCookie.slice(separator + 1), url: base, httpOnly: true, secure: base.startsWith("https:"), sameSite: "Lax" });
    }
    await send("Fetch.enable", { patterns: [{ urlPattern: `${base}/api/*`, requestStage: "Request" }] });
    await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: new URL(route, base).href });
    for (let attempt = 0; attempt < 300; attempt++) {
      await wait(100);
      try { if (await evaluate('document.querySelector("#root")?.children.length > 0')) return; }
      catch (error) { if (!/context|navigate/i.test(error.message)) throw error; }
    }
    throw new Error(`Page failed to render: ${route}`);
  };
  if (realEmail) {
    const { storage } = await import("../server/storage.ts");
    ({ pool: databasePool } = await import("../server/db.ts"));
    const user = await storage.getUserByEmail(realEmail);
    assert.ok(user?.emailVerified && !user.closedAt && user.firstName === "Delivery" && user.lastName === "Test" && user.roles?.join(",") === "customer", "Real mode is restricted to the dedicated QA customer.");
    const started = Date.now() - 1000;
    const post = (path, body) => fetch(new URL(path, base), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await post("/api/send-login-otp", { email: realEmail })).status, 200);
    const { ReplitConnectors } = await import("@replit/connectors-sdk");
    const connector = new ReplitConnectors();
    let message;
    for (let attempt = 0; attempt < 45; attempt++) {
      const response = await connector.proxy("resend", "/emails?limit=100");
      assert.ok(response.ok, "Could not check QA sign-in delivery.");
      const history = await response.json();
      message = history.data?.find(item => item.subject === "Your Afrolandx sign-in code" && item.to?.includes(realEmail) && Date.parse(item.created_at) >= started && item.last_event === "delivered");
      if (message) break;
      await wait(2000);
    }
    assert.ok(message, "QA sign-in email was not delivered.");
    const response = await connector.proxy("resend", `/emails/${encodeURIComponent(message.id)}`);
    assert.ok(response.ok, "Could not read the QA sign-in message.");
    const content = await response.json();
    const otp = `${content.html || ""}\n${content.text || ""}`.match(/\b\d{6}\b/)?.[0];
    assert.ok(otp, "QA sign-in code missing.");
    const login = await post("/api/login-with-otp", { email: realEmail, otp });
    assert.equal(login.status, 200);
    realCookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(realCookie, "QA sign-in did not issue a session.");
    for (const width of [375, 768, 1280]) {
      for (const route of ["/profile", "/my-orders", "/checkout"]) {
        await check(`real customer session and layout: ${route} at ${width}px`, async () => {
          await open(route); await wait(1200);
          const expectedHeading = route === "/profile" ? "Profile Settings" : route === "/my-orders" ? "My Orders" : undefined;
          if (expectedHeading) {
            for (let attempt = 0; attempt < 50; attempt++) {
              if (await evaluate(`document.querySelector("h1")?.textContent.trim() === ${JSON.stringify(expectedHeading)}`)) break;
              await wait(100);
            }
            assert.equal(await evaluate('document.querySelector("h1")?.textContent.trim()'), expectedHeading, "Signed-in page content did not render.");
          }
          const result = await evaluate(`(async () => {
            const response = await fetch("/api/auth/user");
            const user = await response.json();
            return { status: response.status, id: user.id, path: location.pathname, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
          })()`);
          assert.equal(result.status, 200);
          assert.equal(result.id, user.id);
          assert.equal(result.path, route === "/checkout" ? "/products" : route);
          assert.equal(result.overflow, false);
          if (width === 375 && expectedHeading) {
            const image = await send("Page.captureScreenshot", { format: "png" });
            await writeFile(`/tmp/afrolandx-real-${route.slice(1)}-375.png`, Buffer.from(image.data, "base64"));
          }
        });
      }
    }
    await check("real customer cannot access admin or vendor operations", async () => {
      for (const route of ["/api/admin/vendors", "/api/vendors/me"]) {
        const response = await fetch(new URL(route, base), { headers: { Cookie: realCookie } });
        assert.ok([403, 404].includes(response.status), "Customer reached privileged operations.");
      }
    });
    await check("Paystack bank directory is reachable without a money-moving request", async () => {
      const response = await fetch(new URL("/api/paystack/banks", base), { headers: { Cookie: realCookie } });
      assert.equal(response.status, 200, "Paystack read-only connectivity check failed.");
      assert.ok(Array.isArray(await response.json()));
    });
  } else {
  await check("public HTTP: metadata, crawl files and real 404 statuses", async () => {
    for (const route of ["/", "/products", "/events", "/policies", "/robots.txt", "/sitemap.xml", "/manifest.json"]) {
      const response = await fetch(new URL(route, base)); assert.equal(response.status, 200, route);
      const text = await response.text();
      if (route === "/sitemap.xml") { assert.ok(text.includes("<urlset")); assert.ok(!text.includes("/admin")); }
      else if (route === "/manifest.json") assert.equal(JSON.parse(text).name, "Afrolandx");
      else if (route === "/robots.txt") assert.ok(text.includes("User-agent:"));
      else { assert.ok(text.includes('name="description"')); assert.ok(text.includes('rel="canonical"')); }
    }
    for (const route of ["/missing-browser-qa-page", "/products/12abc", "/api/products/12abc", "/products/2147483647"]) {
      assert.equal((await fetch(new URL(route, base))).status, 404, route);
    }
    const redirect = await fetch(new URL("/Products/?utm_source=qa", base), { redirect: "manual" });
    assert.equal(redirect.status, 308); assert.equal(redirect.headers.get("location"), "/products?utm_source=qa");
    const discover = await fetch(new URL("/discover", base), { redirect: "manual" });
    assert.equal(discover.status, 302); assert.ok(discover.headers.get("location").startsWith("/login"));
  });
  for (const width of [390, 1280]) {
    for (const route of ["/", "/products", "/login", "/register", "/policies"]) {
      await check(`public controls and overflow: ${route} at ${width}px`, async () => {
        await open(route, {}, width); await wait(700);
        const result = await evaluate(`(() => {
          const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
          const unnamed = [...document.querySelectorAll("button")].filter(el => visible(el) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.textContent.trim() && !el.title).map(el => el.outerHTML.slice(0, 180));
          return { unnamed, overflow: document.documentElement.scrollWidth > innerWidth + 1, skipLink: !!document.querySelector('a[href="#main-content"]'), description: !!document.querySelector('meta[name="description"]')?.content };
        })()`);
        assert.deepEqual(result.unnamed, []); assert.equal(result.overflow, false); assert.equal(result.skipLink, true); assert.equal(result.description, true);
      });
    }
  }
  await check("SPA navigation updates title and canonical URL", async () => {
    await open("/products"); await wait(600);
    await evaluate('history.pushState({}, "", "/events"); window.dispatchEvent(new PopStateEvent("popstate"));');
    await wait(500);
    assert.equal(await evaluate("document.title"), "Event Planning | Afrolandx");
    assert.equal(await evaluate('document.querySelector(\'link[rel="canonical"]\').href'), "https://afrolandx.com/events");
  });
  await check("skip link moves keyboard focus past navigation", async () => {
    await open("/products"); await wait(500);
    await evaluate('document.querySelector(\'a[href="#main-content"]\').focus()');
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    assert.ok(await evaluate('["H1", "MAIN"].includes(document.activeElement.tagName)'));
  });
  await check("checkout refresh waits for a delayed cart", async () => {
    await open("/checkout", { role: "customer", delayCart: 1800 });
    await wait(250); assert.equal(await evaluate("location.pathname"), "/checkout");
    await wait(2200); assert.equal(await evaluate("location.pathname"), "/checkout");
    assert.equal(await evaluate('document.querySelector("h1")?.textContent'), "Checkout");
  });
  await check("checkout cart failures stay visible and can be retried", async () => {
    const state = { role: "customer", cartError: true };
    await open("/checkout", state); await wait(700);
    assert.equal(await evaluate("location.pathname"), "/checkout");
    assert.ok(await evaluate('document.body.innerText.includes("Your cart could not be loaded")'));
    state.cartError = false;
    await evaluate('[...document.querySelectorAll("button")].find(el => el.textContent.includes("Retry loading cart")).click()');
    await wait(700); assert.equal(await evaluate('document.querySelector("h1")?.textContent'), "Checkout");
  });
  await check("cart drawer traps focus, closes with Escape and restores focus", async () => {
    await open("/products", { role: "customer" }); await wait(700);
    await evaluate('const trigger = document.querySelector(\'[data-testid="button-open-cart"]\'); trigger.focus(); trigger.click();');
    await wait(350);
    assert.ok(await evaluate('!!document.querySelector(\'[role="dialog"][data-state="open"]\')'));
    for (let i = 0; i < 15; i++) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      assert.ok(await evaluate('!!document.activeElement.closest(\'[role="dialog"]\')'));
    }
    assert.ok(await evaluate('!!document.querySelector(\'button[aria-label="Decrease quantity of Fixture garment"]\')'));
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await wait(400);
    assert.equal(await evaluate('!!document.querySelector(\'[role="dialog"][data-state="open"]\')'), false);
    assert.equal(await evaluate('document.activeElement.dataset.testid'), "button-open-cart");
  });
  await check("customer orders render paid totals at phone width with fixtures", async () => {
    await open("/my-orders", { role: "customer" }); await wait(700);
    assert.ok(await evaluate('document.body.innerText.includes("8,503")'));
    assert.equal(await evaluate("document.documentElement.scrollWidth > innerWidth + 1"), false);
  });
  await check("vendor paid orders are visible in the Orders tab with fixtures", async () => {
    await open("/vendor", { role: "vendor" }); await wait(800);
    await evaluate('[...document.querySelectorAll(\'[role="tab"]\')].find(el => /Orders/.test(el.textContent)).focus()');
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await wait(400);
    assert.ok(await evaluate('document.body.innerText.includes("Fixture garment")'), await evaluate('document.querySelector(\'[role="tabpanel"][data-state="active"]\')?.innerText.slice(0, 1200)'));
    assert.equal(await evaluate("document.documentElement.scrollWidth > innerWidth + 1"), false);
  });
  }
  assert.deepEqual(exceptions, [], "Uncaught browser errors");
  await writeFile(realEmail ? "/tmp/afrolandx-authenticated-browser-results.json" : "/tmp/afrolandx-launch-browser-results.json", JSON.stringify({ checks, exceptions, blockedWrites, signedInMode: realEmail ? "real QA customer session; browser API writes blocked" : "browser-only fixtures; real authentication not verified" }, null, 2));
  console.log(`Browser checks: ${checks.filter(check => check.passed).length}/${checks.length} passed. ${realEmail ? "Real QA sign-in; no browser API writes sent." : "No actual API writes sent."}`);
  if (checks.some(check => !check.passed)) process.exitCode = 1;
} finally {
  socket?.close();
  for (const call of pending.values()) { clearTimeout(call.timer); call.reject(new Error("Browser check finished")); }
  if (browser.exitCode === null && browser.signalCode === null) {
    await new Promise(resolve => {
      const timer = setTimeout(() => { browser.kill("SIGKILL"); resolve(); }, 3000);
      browser.once("exit", () => { clearTimeout(timer); resolve(); });
      browser.kill("SIGTERM");
    });
  }
  await rm(profile, { recursive: true, force: true });
  await databasePool?.end();
}
