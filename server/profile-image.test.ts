import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { InvalidProfileImageError, isManagedProfileImage, prepareProfileImage } from "./profile-image";

test("prepares a bounded JPEG from a portrait without changing its proportions", async () => {
  const source = await sharp({
    create: { width: 800, height: 1200, channels: 4, background: "#cc7744" },
  }).png().toBuffer();
  const result = await prepareProfileImage(source);
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 341);
  assert.equal(metadata.height, 512);
});

test("rejects malformed files and unsupported formats instead of saving them", async () => {
  await assert.rejects(prepareProfileImage(Buffer.from("not an image")), InvalidProfileImageError);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>');
  await assert.rejects(prepareProfileImage(svg), InvalidProfileImageError);
});

test("does not treat arbitrary URLs as our stored profile photos", () => {
  assert.equal(isManagedProfileImage("https://example.com/profiles/portrait.jpg"), false);
  assert.equal(isManagedProfileImage("not a URL"), false);
});