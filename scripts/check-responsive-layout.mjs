// Read-only responsive audit against the running app. No sign-in or database writes.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000";
const profile = await mkdtemp(join(tmpdir(), "afrolandx-responsive-"));
const browser = spawn("chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Browser did not start")), 20000);
    let log = "";
    browser.stderr.on("data", data => {
      log += data;
      const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    browser.once("error", reject);
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  socket.on("close", () => {
    for (const call of pending.values()) {
      clearTimeout(call.timer);
      call.reject(new Error("Responsive audit browser disconnected"));
    }
    pending.clear();
  });
  socket.on("message", data => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const call = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(call.timer);
      if (message.error) call.reject(new Error(message.error.message));
      else call.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const callId = ++id;
      const timer = setTimeout(() => { pending.delete(callId); reject(new Error(`Timed out: ${method}`)); }, 20000);
      pending.set(callId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: callId, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  let { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  let activeTarget = targetId;
  const evaluate = async expression => {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  const routes = ["/", "/products", "/register", "/register?as=vendor", "/login", "/forgot-password",
    "/policies", "/policies/shipping-policy", "/policies/marketplace-terms", "/reviews",
    "/collab-drops", "/events", "/lookbook"];
  const selectedWidths = process.argv.find(arg => arg.startsWith("--widths="))?.split("=")[1];
  const widths = selectedWidths ? selectedWidths.split(",").map(Number) : [320, 390, 768, 1024, 1440];
  if (widths.some(width => !Number.isFinite(width) || width < 280)) throw new Error("Invalid audit widths");
  const results = [];
  const measure = () => evaluate(`(() => {
    const width = document.documentElement.clientWidth;
    const visible = el => {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && el.getAttribute("aria-hidden") !== "true";
    };
    const outside = [...document.querySelectorAll("body *")].filter(el => {
      if (!visible(el) || el.closest('[aria-hidden="true"]')) return false;
      const rect = el.getBoundingClientRect();
      if (rect.left >= -1 && rect.right <= width + 1) return false;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const css = getComputedStyle(parent);
        if (["hidden", "clip", "auto", "scroll"].includes(css.overflowX)) return false;
        parent = parent.parentElement;
      }
      return true;
    }).slice(0, 8).map(el => ({ tag: el.tagName, class: String(el.className).slice(0, 140), text: el.textContent.trim().slice(0, 90) }));
    const clippedControls = [...document.querySelectorAll("button, input, select, [role=combobox]")].filter(el => {
      if (!visible(el) || el.closest('[aria-hidden="true"]')) return false;
      return el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 3 && getComputedStyle(el).overflowX !== "auto";
    }).slice(0, 6).map(el => ({ tag: el.tagName, text: (el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 100) }));
    return { viewport: width, documentWidth: document.documentElement.scrollWidth, outside, clippedControls, title: document.querySelector("h1")?.textContent.trim(), teamVisible: document.body.innerText.includes("Meet the team behind Afrolandx") };
  })()`);
  for (const width of widths) {
    for (const route of routes) {
      await send("Target.closeTarget", { targetId: activeTarget });
      ({ targetId: activeTarget } = await send("Target.createTarget", { url: "about:blank" }));
      ({ sessionId } = await send("Target.attachToTarget", { targetId: activeTarget, flatten: true }));
      await send("Page.enable", {}, sessionId);
      await send("Runtime.enable", {}, sessionId);
      await send("Emulation.setDeviceMetricsOverride", { width, height: width === 320 ? 568 : width === 1024 ? 768 : width < 600 ? 844 : 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
      await send("Page.navigate", { url: new URL(route, base).href }, sessionId);
      for (let attempt = 0; attempt < 40; attempt++) {
        await wait(100);
        try {
          if (await evaluate('document.readyState === "complete" && document.querySelector("#root")?.children.length > 0')) break;
        } catch (error) {
          if (!/context|navigate/i.test(error.message)) throw error;
        }
      }
      await wait(850);
      const result = { width, route, ...await measure() };
      results.push(result);
      console.log(JSON.stringify(result));
      if (["/", "/products"].includes(route) && width < 1024) {
        const opened = await evaluate(`(() => {
          const button = document.querySelector('button[aria-label="Open menu"], button[aria-label="Open navigation menu"]');
          if (!button) return false;
          button.click(); return true;
        })()`);
        if (opened) {
          await wait(250);
          const menuResult = { width, route: `${route} (mobile menu)`, ...await measure() };
          results.push(menuResult);
          console.log(JSON.stringify(menuResult));
        }
      }
      if (route === "/") {
        await evaluate(`document.querySelector('button[aria-label="Close menu"], button[aria-label="Close navigation menu"]')?.click()`);
        await evaluate(`document.querySelector('[data-testid="button-open-chat"]')?.click()`);
        await wait(250);
        const chatResult = { width, route: "/ (chat window)", ...await measure() };
        results.push(chatResult);
        console.log(JSON.stringify(chatResult));
      }
      if (route === "/login") {
        await evaluate(`([...document.querySelectorAll("button")].find(button => button.textContent.includes("Continue with email and password")))?.click()`);
        await wait(250);
        const loginResult = { width, route: "/login (password form)", ...await measure() };
        results.push(loginResult);
        console.log(JSON.stringify(loginResult));
      }
    }
  }
  const failures = results.filter(row => row.documentWidth > row.viewport + 1 || row.outside.length || row.clippedControls.length || row.teamVisible);
  await writeFile("/tmp/afrolandx-responsive-results.json", JSON.stringify({ base, results, exceptions, failures }, null, 2));
  console.log(`Checked ${results.length} layouts. Findings: ${failures.length}. Uncaught errors: ${exceptions.length}. Report: /tmp/afrolandx-responsive-results.json`);
  if (failures.length || exceptions.length) process.exitCode = 1;
} finally {
  socket?.close();
  if (browser.exitCode === null && browser.signalCode === null) {
    await new Promise(resolve => {
      const timer = setTimeout(() => { browser.kill("SIGKILL"); resolve(); }, 3000);
      browser.once("exit", () => { clearTimeout(timer); resolve(); });
      browser.kill("SIGTERM");
    });
  }
  await rm(profile, { recursive: true, force: true });
}
