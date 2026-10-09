import crypto from "crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { optimizeProductImage } from "./product-image-processing";

export class R2PhotoStorageError extends Error {
  constructor() {
    super("R2 product photo storage is unavailable. Please try again later.");
    this.name = "R2PhotoStorageError";
  }
}

// This rollout is deliberately development-only. Existing AWS photos and
// non-product uploads retain their original storage and URLs.
export function isR2PhotoStorageSelected(): boolean {
  return process.env.NODE_ENV === "development" && process.env.PRODUCT_PHOTO_STORAGE === "r2";
}

export function useR2ForFolder(folder: string): boolean {
  return folder === "products" && isR2PhotoStorageSelected();
}

export function r2PhotoConfig() {
  const accountId = process.env.R2_PHOTO_ACCOUNT_ID?.trim() || "";
  const bucket = process.env.R2_PHOTO_BUCKET?.trim() || "";
  const publicUrl = process.env.R2_PHOTO_PUBLIC_URL?.trim() || "";
  if (!isR2PhotoStorageSelected() || !/^[a-f0-9]{32}$/.test(accountId)
    || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(bucket)) {
    throw new R2PhotoStorageError();
  }
  try {
    const url = new URL(publicUrl);
    // r2.dev is suitable for this development rollout only, not production.
    if (url.protocol !== "https:" || !/^pub-[a-f0-9]+\.r2\.dev$/.test(url.hostname)
      || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") {
      throw new R2PhotoStorageError();
    }
    return { accountId, bucket, publicUrl: url.origin };
  } catch {
    throw new R2PhotoStorageError();
  }
}

async function request(path: string, method: string, body?: Buffer) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = process.env.R2_PHOTO_API_TOKEN?.trim();
    const response = await Promise.race([
      token
        ? fetch(`https://api.cloudflare.com/client${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { "Content-Type": "image/jpeg" } : {}),
          },
          ...(body ? { body: new Uint8Array(body) } : {}),
          signal: AbortSignal.timeout(20_000),
          redirect: "error",
        })
        : new ReplitConnectors().proxy("cloudflare", path, {
          method,
          ...(body ? { body, headers: { "Content-Type": "image/jpeg" } } : {}),
        }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new R2PhotoStorageError()), 20_000);
      }),
    ]);
    const result = await response.json();
    if (!response.ok || result.success !== true) throw new R2PhotoStorageError();
    return result;
  } catch {
    // Never return provider errors, authentication headers or token values.
    throw new R2PhotoStorageError();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function uploadR2ProductPhoto(buffer: Buffer): Promise<string> {
  const config = r2PhotoConfig();
  const image = await optimizeProductImage(buffer);
  const key = `products/${Date.now()}-${crypto.randomBytes(16).toString("hex")}.jpg`;
  const path = `/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}/objects/${encodeURIComponent(key)}`;
  await request(path, "PUT", image);
  const url = `${config.publicUrl}/${key}`;
  try {
    // A write alone is not success: verify unsigned image delivery before
    // allowing any product record to reference this URL.
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/jpeg")) {
      throw new R2PhotoStorageError();
    }
    const delivered = Buffer.from(await response.arrayBuffer());
    if (!delivered.equals(image)) throw new R2PhotoStorageError();
    return url;
  } catch {
    // The object may exist, but an unreadable photo must not be saved to a
    // listing or silently replaced by a temporary local file.
    throw new R2PhotoStorageError();
  }
}

export async function deleteR2ProductPhoto(url: string): Promise<boolean> {
  const config = r2PhotoConfig();
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.origin !== config.publicUrl || parsed.username || parsed.password || parsed.search || parsed.hash
    || !/^\/products\/\d+-[a-f0-9]{32}\.jpg$/.test(parsed.pathname)) return false;
  await request(`/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}/objects/${encodeURIComponent(parsed.pathname.slice(1))}`, "DELETE");
  return true;
}

export async function getR2ProductPhotoStatus() {
  if (!isR2PhotoStorageSelected()) return { selected: false, connectionReady: false, status: "R2 product photos are not selected." };
  try {
    const config = r2PhotoConfig();
    await request(`/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}`, "GET");
    return { selected: true, connectionReady: true, status: "R2 connection verified. Upload and image delivery still need testing." };
  } catch {
    return { selected: true, connectionReady: false, status: "R2 access could not be verified. Check the product photo credential and bucket settings." };
  }
}
