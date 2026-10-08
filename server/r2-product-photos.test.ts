import test, { mock } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  deleteR2ProductPhoto, getR2ProductPhotoStatus, isR2PhotoStorageSelected,
  r2PhotoConfig, R2PhotoStorageError, uploadR2ProductPhoto, useR2ForFolder,
} from "./r2-product-photos";
import { requiresDurableProductImageStorage, storeProductImage } from "./product-image";

function configure(t: any) {
  const values = {
    NODE_ENV: "development", PRODUCT_PHOTO_STORAGE: "r2",
    R2_PHOTO_ACCOUNT_ID: "a".repeat(32), R2_PHOTO_BUCKET: "fixture-photos",
    R2_PHOTO_PUBLIC_URL: `https://pub-${"b".repeat(32)}.r2.dev`,
  };
  const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

const sourceImage = () => sharp({ create: { width: 20, height: 20, channels: 3, background: "#995511" } }).png().toBuffer();
const envelope = (success: boolean, status = 200) => new Response(JSON.stringify({ success }), { status });

test("R2 rollout is development-only and never selects profiles or private documents", t => {
  configure(t);
  assert.equal(useR2ForFolder("products"), true);
  for (const folder of ["profiles", "documents", "vendors", "products/../documents"]) {
    assert.equal(useR2ForFolder(folder), false);
  }
  assert.equal(requiresDurableProductImageStorage(), true);
  process.env.NODE_ENV = "production";
  assert.equal(isR2PhotoStorageSelected(), false);
  assert.equal(useR2ForFolder("products"), false);
  assert.equal(requiresDurableProductImageStorage(), true);
});

test("R2 config rejects invalid account, bucket, and unsafe delivery destinations", t => {
  configure(t);
  assert.equal(r2PhotoConfig().bucket, "fixture-photos");
  for (const url of ["http://pub-abc.r2.dev", "https://localhost", "https://pub-abc.r2.dev/path",
    "https://user:pass@pub-abc.r2.dev", "https://pub-abc.r2.dev?token=private", "https://pub-abc.r2.dev#fragment"]) {
    process.env.R2_PHOTO_PUBLIC_URL = url;
    assert.throws(r2PhotoConfig, R2PhotoStorageError);
  }
  process.env.R2_PHOTO_PUBLIC_URL = "https://pub-abc.r2.dev";
  process.env.R2_PHOTO_BUCKET = "../private";
  assert.throws(r2PhotoConfig, R2PhotoStorageError);
  process.env.R2_PHOTO_BUCKET = "fixture-photos";
  process.env.R2_PHOTO_ACCOUNT_ID = "not-an-account";
  assert.throws(r2PhotoConfig, R2PhotoStorageError);
});

test("product storage uploads optimized binary JPEG then verifies unsigned delivery before returning a URL", async t => {
  configure(t);
  let image: Buffer | undefined;
  let path = "";
  mock.method(ReplitConnectors.prototype, "proxy", async (provider: string, endpoint: string, options: any) => {
    assert.equal(provider, "cloudflare");
    assert.equal(options.method, "PUT");
    assert.equal(options.headers["Content-Type"], "image/jpeg");
    assert.ok(Buffer.isBuffer(options.body));
    image = options.body;
    path = endpoint;
    assert.match(path, /\/v4\/accounts\/[a-f0-9]{32}\/r2\/buckets\/fixture-photos\/objects\/products\/\d+-[a-f0-9]{32}\.jpg$/);
    return envelope(true);
  });
  mock.method(globalThis, "fetch", async (url: string, options: any) => {
    assert.ok(image);
    assert.equal(new URL(url).pathname, path.split("/objects")[1]);
    assert.ok(options.signal);
    assert.equal(options.headers, undefined);
    return new Response(image, { headers: { "Content-Type": "image/jpeg" } });
  });
  const result = await storeProductImage(await sourceImage());
  assert.match(result, /^https:\/\/pub-[a-f0-9]+\.r2\.dev\/products\//);
  assert.equal((await sharp(image).metadata()).format, "jpeg");
});

test("API denial does not verify delivery, return a URL, or fall back to local product storage", async t => {
  configure(t);
  mock.method(ReplitConnectors.prototype, "proxy", async () => envelope(false, 400));
  const delivery = mock.method(globalThis, "fetch", async () => { throw new Error("Must not fetch after denied upload"); });
  await assert.rejects(storeProductImage(await sourceImage()), R2PhotoStorageError);
  assert.equal(delivery.mock.callCount(), 0);
});

for (const failure of ["missing", "html", "different", "offline"]) {
  test(`unverified ${failure} delivery never returns a product photo URL`, async t => {
    configure(t);
    mock.method(ReplitConnectors.prototype, "proxy", async () => envelope(true));
    mock.method(globalThis, "fetch", async () => {
      if (failure === "offline") throw new Error("Fixture outage");
      return new Response("not-the-uploaded-image", {
        status: failure === "missing" ? 404 : 200,
        headers: { "Content-Type": failure === "html" ? "text/html" : "image/jpeg" },
      });
    });
    await assert.rejects(uploadR2ProductPhoto(await sourceImage()), R2PhotoStorageError);
  });
}

test("R2 cleanup only deletes this bucket's generated product photo keys", async t => {
  configure(t);
  const calls: string[] = [];
  mock.method(ReplitConnectors.prototype, "proxy", async (_provider: string, path: string, options: any) => {
    assert.equal(options.method, "DELETE");
    calls.push(path);
    return envelope(true);
  });
  const origin = r2PhotoConfig().publicUrl;
  for (const url of ["https://legacy.s3.af-south-1.amazonaws.com/products/photo.jpg",
    `${origin}/documents/file.jpg`, `${origin}/profiles/file.jpg`, `${origin}/products/photo.jpg`,
    `${origin}/products/123-${"c".repeat(32)}.jpg?token=private`]) {
    assert.equal(await deleteR2ProductPhoto(url), false);
  }
  assert.equal(calls.length, 0);
  assert.equal(await deleteR2ProductPhoto(`${origin}/products/123-${"c".repeat(32)}.jpg`), true);
  assert.equal(calls.length, 1);
});

test("R2 status labels read access separately from working uploads", async t => {
  configure(t);
  mock.method(ReplitConnectors.prototype, "proxy", async () => envelope(true));
  const status = await getR2ProductPhotoStatus();
  assert.equal(status.connectionReady, true);
  assert.ok(status.status.includes("still need testing"));
});

test("configured R2 failures cannot enter development local fallback on create or add images", () => {
  const source = readFileSync("server/routes.ts", "utf8");
  for (const start of ["app.post('/api/products',", "app.post('/api/products/:id/images',", "app.post('/api/admin/vendors/:vendorId/products',"]) {
    const route = source.slice(source.indexOf(start), source.indexOf("\n  app.", source.indexOf(start) + 1));
    assert.ok(route.includes("requiresDurableProductImageStorage()"), start);
    assert.ok(route.includes("storeProductImage("), start);
    assert.ok(route.includes("status(503)"), start);
  }
});
