import sharp from "sharp";

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
export const PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class InvalidProfileImageError extends Error {}

export async function prepareProfileImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: "error" });
    const { format } = await image.metadata();
    if (!format || !["jpeg", "png", "webp"].includes(format)) {
      throw new InvalidProfileImageError("Choose a JPEG, PNG, or WebP image.");
    }
    return await image
      .rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (error) {
    if (error instanceof InvalidProfileImageError) throw error;
    throw new InvalidProfileImageError("This image could not be opened. Choose another JPEG, PNG, or WebP image.");
  }
}

export function isManagedProfileImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    const expectedHost = `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;
    return parsed.protocol === "https:"
      && parsed.hostname === expectedHost
      && parsed.pathname.startsWith("/profiles/");
  } catch {
    return false;
  }
}