// Read-only public checks. Role menus use isolated browser response fixtures,
// not real account sign-in. No application API writes are allowed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const profile = await mkdtemp(join(tmpdir(), "afrolandx-home-nav-"));
const browser = spawn("chromium", ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore","ignore","pipe"] });
const pending = new Map();
const errors = [];
let socket, session, target, counter = 0, fixture = null, passed = 0;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const roles = {
  customer: ["customer"],
  vendor: ["customer","vendor"],
  admin: ["customer","admin"],
  superadmin: ["customer","admin","superadmin"],
  "staff-vendor": ["customer","vendor","admin","superadmin"],
  partner: ["customer"],
};
function send(method, params = {}, connection = session) {
  return new Promise((resolve, reject) => {
    const id = ++counter;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(!method.startsWith("Target.") && connection ? {sessionId:connection} : {}) }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue:true, awaitPromise:true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function ready(expression) {
  for (let attempt=0; attempt<200; attempt++) {
    try { if (await evaluate(expression)) return; } catch {}
    await wait(100);
  }
  throw new Error(`UI not ready: ${expression}`);
}
async function click(selector) {
  await ready(`!!document.querySelector(${JSON.stringify(selector)})`);
  const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send("Input.dispatchMouseEvent", {type:"mousePressed",...point,button:"left",clickCount:1});
  await send("Input.dispatchMouseEvent", {type:"mouseReleased",...point,button:"left",clickCount:1});
}
async function open(width, role=null) {
  if (target) await send("Target.closeTarget", {targetId:target});
  ({targetId:target}=await send("Target.createTarget",{url:"about:blank"}));
  ({sessionId:session}=await send("Target.attachToTarget",{targetId:target,flatten:true}));
  fixture=role;
  await send("Runtime.enable"); await send("Page.enable");
  await send("Fetch.enable",{patterns:[{urlPattern:`${base}/api/*`,requestStage:"Request"}]});
  await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:false});
  await send("Page.navigate",{url:base});
  await ready('document.querySelector("#root h1")?.innerText.includes("A continent of makers")');
  await ready(role ? '!!document.querySelector("nav [aria-label=\\"Open account menu\\"]") || !!document.querySelector("nav [aria-label=\\"Open navigation menu\\"]")'
    : '!document.querySelector("nav [aria-label=\\"Open account menu\\"]")');
}
async function menu(width) {
  const selector = width < 1024 ? 'nav [aria-label="Open navigation menu"]' : 'nav [aria-label="Open account menu"]';
  await click(selector);
  await ready(width < 1024 ? '!!document.querySelector("#mobile-navigation-menu")' : '!!document.querySelector("[role=menu]")');
}
async function check(name, action) {
  await action(); passed++; console.log(`PASS ${name}`);
}
try {
  const endpoint = await new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error("Browser start timeout")),20000);
    let output="";
    browser.stderr.on("data",data=>{output+=data;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    browser.once("error",reject);
  });
  socket=new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{socket.once("open",resolve);socket.once("error",reject);});
  socket.on("message",async data=>{
    const message=JSON.parse(data);
    if(pending.has(message.id)){const call=pending.get(message.id);pending.delete(message.id);clearTimeout(call.timer);message.error?call.reject(new Error(message.error.message)):call.resolve(message.result);}
    if(message.method==="Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if(message.method!=="Fetch.requestPaused") return;
    try {
      const {request,requestId}=message.params;
      const path=new URL(request.url).pathname;
      let body, status=200;
      if(!["GET","HEAD"].includes(request.method)){body={message:"Read-only browser check"};status=403;}
      else if(fixture && path==="/api/auth/user") body={id:"home-nav-fixture",firstName:"Test",lastName:"Profile",email:"fixture@example.invalid",emailVerified:true,roles:roles[fixture],isShippingPartner:fixture==="partner"};
      else if(fixture && path==="/api/cart") body=[];
      else if(fixture && path==="/api/messages/unread-count") body={count:0};
      else {await send("Fetch.continueRequest",{requestId},message.sessionId);return;}
      await send("Fetch.fulfillRequest",{requestId,responseCode:status,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from(JSON.stringify(body)).toString("base64")},message.sessionId);
    } catch(error){if(!/closed|target|session|interception/i.test(error.message)) errors.push(error.message);}
  });
  for(const width of [390,768,1024,1440]) {
    await open(width);
    await check(`public homepage fits ${width}px`,async()=>{
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth+1'),
        await evaluate('JSON.stringify([...document.querySelectorAll("body *")].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).slice(0,8).map(el=>({tag:el.tagName,classes:el.className,right:Math.round(el.getBoundingClientRect().right)})))'));
      assert.ok(await evaluate('!!document.querySelector("section a[href=\\"/vendor/apply\\"]")'));
      assert.ok(await evaluate('!!document.querySelector("section a[href=\\"/products\\"]")'));
      assert.ok(await evaluate('!document.body.innerText.includes("Admin Mode:")'));
    });
  }
  for(const role of Object.keys(roles)) for(const width of [390,1440]) {
    await open(width,role);
    // Wait for fixture account details, not just the navbar's initial guest render.
    await ready('document.querySelector("nav")?.innerText.includes("Test Profile") || !!document.querySelector("nav [aria-label=\\"Open account menu\\"]")');
    await menu(width);
    await check(`${role} role menu at ${width}px`,async()=>{
      const links=await evaluate('[...document.querySelectorAll("[role=menu] a,#mobile-navigation-menu a")].map(a=>a.getAttribute("href"))');
      assert.equal(links.includes("/admin"),["admin","superadmin","staff-vendor"].includes(role));
      assert.equal(links.includes("/discover"),["admin","superadmin","staff-vendor"].includes(role));
      assert.equal(links.includes("/admin/finance"),["superadmin","staff-vendor"].includes(role));
      assert.equal(links.includes("/vendor"),["vendor","staff-vendor"].includes(role));
      assert.equal(links.includes("/shipping"),role!=="customer");
      assert.ok(await evaluate('!!document.querySelector("section a[href=\\"/products\\"]")'));
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth+1'));
    });
    if(role==="superadmin" && width===1440) {
      const snapshot = await send("Page.captureScreenshot",{format:"png"});
      await writeFile("/tmp/afrolandx-home-staff-menu.png",Buffer.from(snapshot.data,"base64"));
    }
  }
  await open(1440);
  await click('nav [aria-label="Open more links"]');
  await ready('!!document.querySelector("[role=menu]")');
  await check("secondary public links remain discoverable",async()=>{
    const links=await evaluate('[...document.querySelectorAll("[role=menu] a")].map(a=>a.getAttribute("href"))');
    for(const path of ["/reviews","/policies","/vendor/apply"]) assert.ok(links.includes(path));
  });
  await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
  await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
  await ready('!document.querySelector("[role=menu]")');
  await click("#desktop-site-search");
  await evaluate('document.getElementById("desktop-site-search").focus()');
  await ready('document.activeElement?.id==="desktop-site-search"');
  await send("Input.insertText",{text:"Aso Oke"});
  await ready('document.getElementById("desktop-site-search").value==="Aso Oke"');
  await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
  await send("Input.dispatchKeyEvent",{type:"char",text:"\r",unmodifiedText:"\r",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
  await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
  await ready('location.pathname==="/products"');
  await check("marketplace search submits the typed query",async()=>assert.equal(await evaluate('new URLSearchParams(location.search).get("search")'),"Aso Oke"));
  assert.deepEqual(errors,[]);
  console.log(`${passed} read-only checks passed; role visibility used browser fixtures.`);
} finally {
  socket?.close(); browser.kill();
  for(const call of pending.values()) clearTimeout(call.timer);
  await wait(250); await rm(profile,{recursive:true,force:true});
}
