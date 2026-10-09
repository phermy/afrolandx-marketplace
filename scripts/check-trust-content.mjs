// Public, read-only browser checks. No account sign-in or API writes.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const base = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "http://127.0.0.1:5000";
const profile = await mkdtemp(join(tmpdir(), "afrolandx-trust-"));
const browser = spawn("chromium", [
  "--headless", "--no-sandbox", "--disable-dev-shm-usage",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let socket;
const calls = new Map();
const exceptions = [];
let nextId = 0;

try {
  const endpoint = await new Promise((resolve, reject) => {
    let log = "";
    const timer = setTimeout(() => reject(new Error("Browser startup timed out")), 20000);
    browser.stderr.on("data", data => {
      log += data;
      const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    browser.once("error", error => { clearTimeout(timer); reject(error); });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  socket.on("message", data => {
    const message = JSON.parse(data.toString());
    if (message.id && calls.has(message.id)) {
      const call = calls.get(message.id);
      calls.delete(message.id);
      clearTimeout(call.timer);
      if (message.error) call.reject(new Error(message.error.message));
      else call.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
  });
  function send(method, params = {}, sessionId) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { calls.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
      calls.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const paths = ["/contact", "/faq", "/size-guide", "/shipping-information", "/returns", "/policies/prohibited-and-restricted-products", "/accessibility"];
  for (const width of [1280, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
    for (const path of paths) {
      await send("Page.navigate", { url: `${base}${path}` }, sessionId);
      let page;
      for (let attempt = 0; attempt < 80; attempt++) {
        await wait(200);
        page = await evaluate(`({
          title: document.title,
           lang: document.documentElement.lang,
          path: location.pathname,
          heading: document.querySelector("main h1")?.textContent,
          text: document.querySelector("main")?.innerText || "",
          width: document.documentElement.scrollWidth,
          viewport: innerWidth,
          sparkles: document.querySelectorAll(".lucide-sparkles").length,
          links: [...document.querySelectorAll("a")].map(link => link.getAttribute("href")),
          footerLinks: [...document.querySelectorAll("#site-footer a")].map(link => link.getAttribute("href"))
        })`);
        if (page.path === path && page.heading && page.footerLinks.length) break;
      }
      assert.ok(page.heading, `${width} ${path}: main heading did not render`);
       assert.equal(page.lang, "en-NG", `${path}: language declaration`);
       assert.ok(page.footerLinks.includes("/accessibility"), `${path}: accessibility statement link`);
       const unnamed = await evaluate(`Array.from(document.querySelectorAll("button")).filter(el => {
         const visible = !!el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
         return visible && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.textContent.trim() && !el.title;
       }).map(el => el.outerHTML.slice(0,180))`);
       assert.deepEqual(unnamed, [], `${path}: unnamed icon buttons`);
      assert.ok(!/Page Not Found|not available/i.test(page.title), `${path}: incorrect metadata`);
      assert.ok(page.width <= page.viewport + 1, `${width} ${path}: horizontal overflow`);
      assert.equal(page.sparkles, 0, `${path}: sparkle branding remains`);
      for (const link of paths.slice(0, 5)) {
        assert.ok(page.footerLinks.includes(link), `${path}: footer missing ${link}`);
      }
      if (path === "/contact") {
        assert.ok(page.links.includes("https://wa.me/2347082427348"), "Wrong WhatsApp destination");
        assert.ok(page.links.includes("mailto:support@afrolandx.com"), "Support email is missing");
        assert.ok(page.text.includes("+2347082427348") || page.text.includes("+234 708 242 7348"), "WhatsApp number is not visible");
        assert.match(page.text, /Monday to Saturday, 8:00 AM to 6:00 PM WAT \(UTC\+1\)/, "Support hours must include their timezone");
      }
      if (path === "/accessibility") {
        assert.equal(page.heading, "Accessibility statement");
        assert.ok(page.text.includes("WCAG"));
        assert.ok(page.links.includes("mailto:support@afrolandx.com"));
        assert.ok(page.text.includes("not a claim"));
      }
      if (path === "/faq") {
        const question = await evaluate(`(() => {
          const items = [...document.querySelectorAll("main details")];
          const index = items.findIndex(item => !item.open);
          if (index < 0) return null;
          const summary = items[index].querySelector("summary");
          summary.scrollIntoView({ block: "center" });
          const bounds = summary.getBoundingClientRect();
          return { index, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        })()`);
        assert.ok(question, "FAQ needs expandable questions");
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x: question.x, y: question.y, button: "left", clickCount: 1 }, sessionId);
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: question.x, y: question.y, button: "left", clickCount: 1 }, sessionId);
        assert.equal(await evaluate(`document.querySelectorAll("main details")[${question.index}].open`), true, "FAQ answer did not open");
        const refundAnswer = await evaluate(`(() => {
          const items = [...document.querySelectorAll("main details")];
          return items.find(item => item.querySelector("summary")?.textContent.includes("How long does a refund take?"))?.textContent || "";
        })()`);
        assert.match(refundAnswer, /5 to 14 business days/);
        assert.match(refundAnswer, /approved and initiated/);
      }
      if (path === "/returns") {
        assert.match(page.text, /5 to 14 business days/);
        assert.match(page.text, /approved and initiated/);
        assert.match(page.text, /not a guaranteed completion date/);
        assert.match(page.text, /payment providers and banks may take longer/);
      }
      if (path.includes("prohibited-and-restricted")) {
        assert.match(page.text, /Antiquities, cultural heritage and provenance/);
        assert.match(page.text, /export and import permits/);
        assert.match(page.text, /October 9, 2026/);
      }
      console.log(`PASS ${width}px ${path}: ${page.heading}`);
    }
  }
  assert.deepEqual(exceptions, [], "Uncaught browser exceptions");
  console.log("Trust content browser checks passed; no sign-in, messages, purchases or API writes performed.");
} finally {
  socket?.close();
  for (const call of calls.values()) clearTimeout(call.timer);
  browser.kill("SIGTERM");
  await new Promise(resolve => {
    if (browser.exitCode !== null) resolve();
    else { browser.once("exit", resolve); setTimeout(resolve, 3000).unref(); }
  });
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
