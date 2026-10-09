import crypto from "node:crypto";
import { optimizeProductImage } from "./product-image-processing";
import { prepareProfileImage } from "./profile-image";
import { getR2ImageKey, isR2ImageKey, R2_IMAGE_PREFIX } from "./r2-image-url";

type R2StorageConfig = {
  accountId: string;
  bucketName: string;
  apiToken: string;
};

export class CloudStorageService {
  readonly provider = "cloudflare-r2";
  private readonly baseUrl: string;

  constructor(
    private readonly config: R2StorageConfig,
    private readonly request: typeof fetch = fetch,
  ) {
    if (!/^[a-f0-9]{32}$/.test(config.accountId)
      || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(config.bucketName)
      || !config.apiToken) {
      throw new Error("Cloudflare R2 storage configuration is incomplete.");
    }
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}`;
  }

  private async send(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.request(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          ...init.headers,
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      // Never log request headers, credentials or provider error objects.
      throw new Error("Cloudflare R2 could not be reached. Please try again.");
    }
  }

  private async requireSuccess(response: Response): Promise<void> {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Cloudflare R2 storage credentials are invalid or lack permission.");
    }
    if (!response.ok) throw new Error("Cloudflare R2 could not complete the storage request.");
  }

  async checkConnection(): Promise<{ connectionReady: boolean; status: string }> {
    try {
      const response = await this.send("/objects?per_page=1");
      await this.requireSuccess(response);
      const body = await response.json();
      if (body.success !== true) throw new Error("Cloudflare R2 did not confirm bucket access.");
      return { connectionReady: true, status: "Cloudflare R2 bucket access verified." };
    } catch (error) {
      return {
        connectionReady: false,
        status: error instanceof Error ? error.message : "Could not verify Cloudflare R2 access.",
      };
    }
  }

  async uploadImage(buffer: Buffer, _contentType: string, folder = "products"): Promise<string> {
    if (folder !== "products" && folder !== "profiles") throw new Error("Invalid image storage folder.");
    const image = folder === "profiles"
      ? await prepareProfileImage(buffer)
      : await optimizeProductImage(buffer);
    const key = `${folder}/${Date.now()}-${crypto.randomBytes(16).toString("hex")}.jpg`;
    const response = await this.send(`/objects/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: new Uint8Array(image),
    });
    await this.requireSuccess(response);

    // A write is not sufficient: verify that the stored image can be read
    // before a listing or account reports a successful upload.
    try {
      const stored = await this.readImage(key);
      if (!stored || !stored.buffer.equals(image)) {
        throw new Error("Cloudflare R2 could not verify the saved image.");
      }
    } catch (error) {
      await this.deleteImage(`${R2_IMAGE_PREFIX}${key}`).catch(() => {
        console.error("Unverified R2 image cleanup could not complete.");
      });
      throw error;
    }
    return `${R2_IMAGE_PREFIX}${key}`;
  }

  async readImage(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!isR2ImageKey(key)) throw new Error("Invalid image storage key.");
    const response = await this.send(`/objects/${key}`);
    if (response.status === 404) return null;
    await this.requireSuccess(response);
    return { buffer: Buffer.from(await response.arrayBuffer()), contentType: "image/jpeg" };
  }

  async deleteImage(imageUrl: string): Promise<void> {
    const key = getR2ImageKey(imageUrl);
    // Preserve unrelated images and legacy URLs; never send them to R2 delete.
    if (!key) return;
    const response = await this.send(`/objects/${key}`, { method: "DELETE" });
    if (response.status === 404) return;
    await this.requireSuccess(response);
  }
}

let cloudStorageService: CloudStorageService | null = null;

export function initializeCloudStorage(): void {
  const config = {
    accountId: process.env.R2_ACCOUNT_ID?.trim() || "",
    bucketName: process.env.R2_BUCKET?.trim() || "",
    apiToken: process.env.R2_PHOTO_API_TOKEN?.trim() || process.env.CLOUDFLARE_R2_API_TOKEN?.trim() || "",
  };
  cloudStorageService = null;
  if (!config.accountId || !config.bucketName || !config.apiToken) {
    console.log("Cloudflare R2 is not configured. Durable image uploads are unavailable.");
    return;
  }
  try {
    cloudStorageService = new CloudStorageService(config);
    console.log("Cloudflare R2 configured. Bucket access has not yet been verified.");
  } catch {
    console.error("Cloudflare R2 configuration is invalid. Image uploads are unavailable.");
  }
}

export function reinitializeCloudStorage(): void {
  initializeCloudStorage();
}

export function getCloudStorageService(): CloudStorageService {
  if (!cloudStorageService) throw new Error("Cloudflare R2 image storage is unavailable.");
  return cloudStorageService;
}

export function isCloudStorageEnabled(): boolean {
  return cloudStorageService !== null;
}
