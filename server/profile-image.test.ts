import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { InvalidProfileImageError, isManagedProfileImage, prepareProfileImage } from "./profile-image";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { users } from "../shared/schema";
import { ProfilePhotoAccountNotFoundError, updateProfilePhoto } from "./profile-photo-service";

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
  assert.equal(isManagedProfileImage("/api/media/profiles/portrait.jpg"), true);
  assert.equal(isManagedProfileImage("/api/media/products/portrait.jpg"), false);
  assert.equal(isManagedProfileImage("/api/media/profiles/../portrait.jpg"), false);
});

test("profile photos store durable R2 links, replace, persist and remove", async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Profile photo tests must not run in production.");
  const ids = [randomUUID(), randomUUID()].map(id => `profile-photo-${id}`);
  const images = new Map<string, Buffer>();
  const imageStorage = {
    uploadImage: async (buffer: Buffer, contentType: string, folder: string) => {
      assert.equal(contentType, "image/jpeg");
      assert.equal(folder, "profiles");
      const url = `/api/media/profiles/${randomUUID()}.jpg`;
      images.set(url, buffer);
      return url;
    },
    deleteImage: async (url: string) => { images.delete(url); },
  };
  try {
    await db.insert(users).values(ids.map(id => ({ id, email: `${id}@example.test`, roles: ["customer"] })));
    const makePhoto = (background: string) => sharp({
      create: { width: 640, height: 800, channels: 3, background },
    }).png().toBuffer();
    const first = await updateProfilePhoto(ids[0], await makePhoto("#cc7744"), storage, imageStorage);
    assert.match(first.user.profileImageUrl!, /^\/api\/media\/profiles\//);
    const [persisted] = await db.select().from(users).where(eq(users.id, ids[0]));
    assert.equal(persisted.profileImageUrl, first.user.profileImageUrl);
    const bytes = images.get(persisted.profileImageUrl!)!;
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.height, 512);

    await assert.rejects(
      updateProfilePhoto(ids[0], Buffer.from("not an image"), storage, imageStorage),
      InvalidProfileImageError,
    );
    assert.equal((await storage.getUser(ids[0]))?.profileImageUrl, first.user.profileImageUrl);
    const replacement = await updateProfilePhoto(ids[0], await makePhoto("#4488cc"), storage, imageStorage);
    assert.notEqual(replacement.user.profileImageUrl, first.user.profileImageUrl);
    assert.equal(replacement.previousImageUrl, first.user.profileImageUrl);
    assert.equal((await storage.getUser(ids[0]))?.profileImageUrl, replacement.user.profileImageUrl);
    assert.equal((await storage.getUser(ids[1]))?.profileImageUrl, null);

    const removed = await updateProfilePhoto(ids[0], null, storage);
    assert.equal(removed.user.profileImageUrl, null);
    assert.equal((await storage.getUser(ids[0]))?.profileImageUrl, null);
    assert.equal((await updateProfilePhoto(ids[0], null, storage)).user.profileImageUrl, null);
  } finally {
    await db.delete(users).where(inArray(users.id, ids));
  }
});

test("failed R2 writes preserve the old photo; failed account writes clean up only the new photo", async () => {
  const source = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#4488cc" } }).png().toBuffer();
  let writes = 0;
  const repository = {
    getUser: async () => ({ profileImageUrl: "/api/media/profiles/original.jpg" } as any),
    updateUserProfile: async () => { writes++; throw new Error("Account write failed"); },
  };
  const deleted: string[] = [];
  await assert.rejects(updateProfilePhoto("account", source, repository, {
    uploadImage: async () => { throw new Error("R2 unavailable"); },
    deleteImage: async (url) => { deleted.push(url); },
  }), /R2 unavailable/);
  assert.equal(writes, 0);
  await assert.rejects(updateProfilePhoto("account", source, repository, {
    uploadImage: async () => "/api/media/profiles/new.jpg",
    deleteImage: async (url) => { deleted.push(url); },
  }), /Account write failed/);
  assert.deepEqual(deleted, ["/api/media/profiles/new.jpg"]);
});

test("missing accounts and failed persistence do not report a successful photo update", async () => {
  const missing = {
    getUser: async () => undefined,
    updateUserProfile: async () => { throw new Error("Must not write for a missing account"); },
  };
  await assert.rejects(updateProfilePhoto("missing", null, missing), ProfilePhotoAccountNotFoundError);
  await assert.rejects(updateProfilePhoto("account", null, {
    getUser: async () => ({ profileImageUrl: null } as any),
    updateUserProfile: async () => { throw new Error("Database unavailable"); },
  }), /Database unavailable/);
});