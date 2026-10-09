// Signed-out, disposable-browser check. Only guest cart writes are permitted.
// No authentication, approval changes, Paystack calls or carrier bookings.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const fixtureMode=process.argv.includes("--browser-fixtures");
const fixtureProduct={id:900001,vendorId:900001,name:"Browser fixture garment",description:"Browser-only fixture; not a real listing.",price:"8500.00",stock:5,status:"approved",sizes:["M"],imageUrl:"/favicon.ico",images:[],categoryId:1,weight:"1.00",dimensions:"20x10x5",vendor:{businessName:"Browser fixture maker"}};
let fixtureCart=fixtureMode?[{id:900001,productId:fixtureProduct.id,quantity:1,selectedSize:"M",product:fixtureProduct}]:[];
const profile = await mkdtemp(join(tmpdir(),"guest-checkout-"));
const browser = spawn("chromium",["--headless","--no-sandbox","--disable-dev-shm-usage","--remote-debugging-port=0",`--user-data-dir=${profile}`,"about:blank"],{stdio:["ignore","ignore","pipe"]});
const wait = ms=>new Promise(r=>setTimeout(r,ms));
let ws, sequence=0;const pending=new Map();const errors=[];
function rpc(method,params={}) {return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression) {
  const r=await rpc("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails) throw Error(r.exceptionDetails.text);
  return r.result?.value;
}
async function clickText(text) {
  let rect;
  for(let attempt=0;attempt<40&&!rect;attempt++){
    rect=await evaluate(`(()=>{const el=Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled);if(!el)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    if(!rect)await wait(250);
  }
  if(!rect)console.log("Browser state:",await evaluate("({url:location.href,text:document.body.innerText.slice(0,2200)})"),errors);
  assert.ok(rect,`Button unavailable: ${text}`);
  await rpc("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...rect});
  await rpc("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...rect});
  await wait(400);
}
async function fill(id,value) {
  const tag=await evaluate(`document.getElementById(${JSON.stringify(id)})?.tagName`);
  if(tag==="BUTTON") {
    await evaluate(`document.getElementById(${JSON.stringify(id)}).focus()`);
    await rpc("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
    await rpc("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
    await wait(200);
    const rect=await evaluate(`(()=>{const e=Array.from(document.querySelectorAll('[role=option]')).find(e=>e.textContent.trim()===${JSON.stringify(value)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    assert.ok(rect,`Select option missing: ${value}`);
    await rpc("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...rect});
    await rpc("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...rect});
    await wait(150);return;
  }
  assert.ok(await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;e.focus();e.select();return true})()`),`Input missing: ${id}`);
  await rpc("Input.insertText",{text:value});
}
try {
  const endpoint=await new Promise((resolve,reject)=>{
    let output="";browser.stderr.on("data",b=>{output+=b;const m=output.match(/DevTools listening on (ws:\/\/\S+)/);if(m)resolve(m[1]);});browser.once("error",reject);
    setTimeout(()=>reject(Error("Browser startup timed out")),12000).unref();
  });
  const port=new URL(endpoint).port;
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(targets.find(t=>t.type==="page").webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.once("open",resolve);ws.once("error",reject);});
  ws.on("message",b=>{const m=JSON.parse(String(b));if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}else if(m.method==="Runtime.exceptionThrown")errors.push(m.params.exceptionDetails.text);});
  if(fixtureMode) {
    ws.on("message",async b=>{
      const m=JSON.parse(String(b));if(m.method!=="Fetch.requestPaused")return;
      const {request,requestId}=m.params;const path=new URL(request.url).pathname;
      let body;let status=200;
      if(path==="/api/products")body=[fixtureProduct];
      else if(path===`/api/products/${fixtureProduct.id}`)body=fixtureProduct;
      else if(path==="/api/cart"){
        if(request.method==="POST"){const input=JSON.parse(request.postData);fixtureCart=[{id:900001,productId:fixtureProduct.id,quantity:input.quantity,selectedSize:input.selectedSize,product:fixtureProduct}];}
        if(request.method==="DELETE")fixtureCart=[];
        body=fixtureCart;
      }else if(path==="/api/checkout/rates"){status=409;body={message:"Browser fixture maker must finish their pickup address setup before these items can be shipped."};}
      else if(request.method!=="GET"){status=403;body={message:"Browser fixture mode blocks server writes."};}
      else {await rpc("Fetch.continueRequest",{requestId});return;}
      await rpc("Fetch.fulfillRequest",{requestId,responseCode:status,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from(JSON.stringify(body)).toString("base64")});
    });
    await rpc("Fetch.enable",{patterns:[{urlPattern:"*/api/*"}]});
  }
  await rpc("Runtime.enable");await rpc("Page.enable");
  await rpc("Page.navigate",{url:`${base}/products`});await wait(3500);
  const product=fixtureMode?fixtureProduct:await evaluate(`fetch('/api/products').then(r=>r.json()).then(d=>(Array.isArray(d)?d:d.products||[]).find(p=>p.stock>0&&p.status==='approved'))`);
  assert.ok(product,"An approved stocked product is required.");
  if(!fixtureMode){
    await rpc("Page.navigate",{url:`${base}/products/${product.id}`});await wait(2000);
    if(Array.isArray(product.sizes)&&product.sizes.length) await clickText(product.sizes[0]);
    await clickText("Add to Cart");await wait(1200);
  }
  const cart=await evaluate(`fetch('/api/cart').then(r=>r.json())`);
  assert.ok(cart.some(c=>c.productId===product.id),"Guest addition must persist server-side.");
  assert.equal(await evaluate(`fetch('/api/auth/user').then(r=>r.status)`),401,"A guest cart must not create an authenticated account.");
  await rpc("Page.navigate",{url:`${base}/checkout`});await wait(1800);
  const before=await evaluate("document.body.innerText");
  assert.ok(before.includes("Guest checkout"),"Guest checkout must render instead of login.");
  assert.ok(before.includes("Full order total"));
  assert.ok(!before.includes("Testing mode")&&!before.includes("Test shipping"));
  const inputs=await evaluate(`Array.from(document.querySelectorAll('input')).map(e=>({id:e.id,type:e.type}))`);
  console.log("Checkout inputs:",inputs);
  for(const [id,value] of Object.entries({"checkout-email":"fixture@example.test","checkout-phone":"+2348000000000",firstName:"Fixture",lastName:"Buyer",address1:"123 Fictional Street",city:"Lagos",state:"Lagos",postalCode:"100001"})) await fill(id,value);
  await clickText("Get live delivery options");await wait(1800);
  const after=await evaluate("document.body.innerText");
  assert.match(after,/pickup address setup|shipping weight|parcel dimensions|shipping provider/i,"Missing shipping prerequisites must be explained.");
  assert.ok(!after.includes("₦1 test"),"No deposit fallback.");
  await rpc("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await wait(300);
  assert.ok(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+2"),"Checkout must not overflow mobile width.");
  assert.equal(errors.length,0,`Browser exceptions: ${errors.join(";")}`);
  await evaluate(`fetch('/api/cart',{method:'DELETE'})`);
  console.log(`PASS: ${fixtureMode?"checkout UI with browser-only cart fixtures (not real cart creation)":"real guest cart"}, no auto-login, contact form, missing-setup payment block and mobile layout. No payments or carrier bookings made.`);
} finally {
  ws?.close();browser.kill();await wait(150);await rm(profile,{recursive:true,force:true});
}
