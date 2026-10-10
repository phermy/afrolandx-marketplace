import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { CloudStorageService } from "./r2-storage";
import { getR2ImageKey, isR2ImageKey } from "./r2-image-url";

const config = { accountId: "a".repeat(32), bucketName: "fixture", apiToken: "private-fixture-token" };

test("R2 uploads, verifies and deletes bounded JPEGs without AWS requests", async () => {
  const objects = new Map<string, Buffer>();
  const methods: string[] = [];
  const service = new CloudStorageService(config, async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "api.cloudflare.com");
    assert.equal((init?.headers as any).Authorization, `Bearer ${config.apiToken}`);
    const key = url.pathname.split("/objects/")[1];
    methods.push(init?.method || "GET");
    if (init?.method === "PUT") {
      objects.set(key, Buffer.from(init.body as Uint8Array));
      return new Response(JSON.stringify({ success: true }));
    }
    if (init?.method === "DELETE") {
      objects.delete(key);
      return new Response(null, { status: 204 });
    }
    return objects.has(key)
      ? new Response(new Uint8Array(objects.get(key)!))
      : new Response(null, { status: 404 });
  });
  const source = await sharp({ create: { width: 640, height: 800, channels: 4, background: "#aabbcc" } }).png().toBuffer();
  for (const folder of ["products", "profiles"]) {
    const url = await service.uploadImage(source, "image/png", folder);
    assert.match(url, new RegExp(`^/api/media/${folder}/`));
    const key = getR2ImageKey(url)!;
    const image = await service.readImage(key);
    assert.equal(image?.contentType, "image/jpeg");
    const metadata = await sharp(image!.buffer).metadata();
    assert.equal(metadata.format, "jpeg");
    if (folder === "profiles") assert.ok(metadata.height! <= 512);
    await service.deleteImage(url);
    assert.equal(await service.readImage(key), null);
  }
  const before = methods.length;
  await service.deleteImage("https://unrelated.example/photos/other.jpg");
  await service.deleteImage("https://legacy.s3.amazonaws.com/profiles/old.jpg");
  assert.equal(methods.length, before);
});

test("R2 refuses traversal and unrelated folders before contacting storage", async () => {
  let calls = 0;
  const service = new CloudStorageService(config, async () => { calls++; return new Response(); });
  assert.equal(isR2ImageKey("profiles/../other.jpg"), false);
  assert.equal(getR2ImageKey("https://evil.example/api/media/profiles/test.jpg"), null);
  await assert.rejects(service.readImage("profiles/../other.jpg"));
  await assert.rejects(service.uploadImage(Buffer.from("bad"), "image/jpeg", "private-documents"));
  assert.equal(calls, 0);
});

test("R2 failed connection checks never expose provider details or credentials", async () => {
  for (const status of [401, 403, 429, 500]) {
    const service = new CloudStorageService(config, async () => new Response("private provider details", { status }));
    const result = await service.checkConnection();
    assert.equal(result.connectionReady, false);
    assert.doesNotMatch(result.status, /private provider details|private-fixture-token/);
  }
  const unavailable = new CloudStorageService(config, async () => { throw new Error("private provider details"); });
  assert.doesNotMatch((await unavailable.checkConnection()).status, /private provider details/);
});

test("R2 uploads fail explicitly when stored image bytes cannot be verified", async () => {
  const methods: string[] = [];
  const service = new CloudStorageService(config, async (_input, init) => {
    methods.push(init?.method || "GET");
    return init?.method === "PUT" || init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : new Response("wrong bytes");
  });
  const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#aabbcc" } }).png().toBuffer();
  await assert.rejects(service.uploadImage(image, "image/png"), /verify the saved image/);
  assert.deepEqual(methods, ["PUT", "GET", "DELETE"]);
});
