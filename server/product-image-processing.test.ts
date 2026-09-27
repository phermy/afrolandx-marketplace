import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { optimizeProductImage } from "./product-image-processing";

test("product image optimization caps the long edge at 2400 without enlarging", async () => {
  const large = await sharp({
    create: { width: 3200, height: 1600, channels: 3, background: "#b34a38" },
  }).jpeg().toBuffer();
  const optimizedLarge = await sharp(await optimizeProductImage(large)).metadata();
  assert.equal(optimizedLarge.width, 2400);
  assert.equal(optimizedLarge.height, 1200);
  assert.equal(optimizedLarge.format, "jpeg");

  const small = await sharp({
    create: { width: 800, height: 400, channels: 3, background: "#b34a38" },
  }).png().toBuffer();
  const optimizedSmall = await sharp(await optimizeProductImage(small)).metadata();
  assert.equal(optimizedSmall.width, 800);
  assert.equal(optimizedSmall.height, 400);
});

test("product image optimization applies EXIF orientation before sizing", async () => {
  const oriented = await sharp({
    create: { width: 3000, height: 1500, channels: 3, background: "#48715a" },
  }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const metadata = await sharp(await optimizeProductImage(oriented)).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 2400);
});

test("transparent product photos get a clean white background", async () => {
  const transparent = await sharp({
    create: { width: 64, height: 64, channels: 4, background: "#00000000" },
  }).png().toBuffer();
  const pixel = await sharp(await optimizeProductImage(transparent))
    .extract({ left: 32, top: 32, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert.ok([...pixel].slice(0, 3).every(channel => channel >= 245));
});