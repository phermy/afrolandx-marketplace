import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import type { Product } from "../shared/schema";
import { eligibleForTryOn, runVirtualTryOn } from "./virtual-try-on";

const product = {
  id: 12, status: "approved", stock: 3, images: ["https://images.example.test/garment.jpg"],
  imageUrl: null,
} as Product;

test("try-on is offered only for approved, stocked clothing with a usable image and configured provider", () => {
  assert.equal(eligibleForTryOn(product, "approved", "Traditional Wear", true), true);
  assert.equal(eligibleForTryOn(product, "suspended", "Traditional Wear", true), false);
  assert.equal(eligibleForTryOn(product, "approved", "Women's Accessories", true), false);
  assert.equal(eligibleForTryOn(product, "approved", "Traditional Wear", false), false);
  assert.equal(eligibleForTryOn({ ...product, images: ["/uploads/local.jpg"] }, "approved", "Traditional Wear", true), false);
  assert.equal(eligibleForTryOn({ ...product, status: "pending" }, "approved", "Traditional Wear", true), false);
});

test("the provider receives the photo in memory and the preview is returned without storage", async () => {
  const output = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#345678" } }).jpeg().toBuffer();
  const fetcher: typeof fetch = async (input, options) => {
    if (String(input).includes("/predictions")) {
      const body = JSON.parse(String(options?.body));
      assert.match(body.input.person_image, /^data:image\/jpeg;base64,/);
      assert.deepEqual(body.input.garment_images, ["https://images.example.test/garment.jpg"]);
      return new Response(JSON.stringify({ status: "succeeded", output: "https://replicate.delivery/test/output.jpg" }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    assert.equal(String(input), "https://replicate.delivery/test/output.jpg");
    assert.equal(options?.redirect, "manual");
    return new Response(new Uint8Array(output), { status: 200, headers: { "content-type": "image/jpeg" } });
  };
  const result = await runVirtualTryOn(output, "https://images.example.test/garment.jpg", "test-token", fetcher);
  assert.equal((await sharp(result).metadata()).format, "jpeg");
});

test("a provider cannot make the server download arbitrary URLs", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    status: "succeeded", output: "http://127.0.0.1/internal",
  }), { status: 200, headers: { "content-type": "application/json" } });
  await assert.rejects(runVirtualTryOn(Buffer.from("photo"), "https://images.example.test/garment.jpg", "test-token", fetcher),
    /unexpected image URL/);
});

test("the image downloader refuses redirects even from a trusted output host", async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => {
    requests++;
    if (requests === 1) return new Response(JSON.stringify({
      status: "succeeded", output: "https://replicate.delivery/test/output.jpg",
    }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  };
  await assert.rejects(runVirtualTryOn(Buffer.from("photo"), "https://images.example.test/garment.jpg", "test-token", fetcher),
    /download failed/);
  assert.equal(requests, 2);
});