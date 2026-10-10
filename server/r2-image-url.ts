export const R2_IMAGE_PREFIX = "/api/media/";

export function isR2ImageKey(key: string): boolean {
  return /^(products|profiles)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}\.jpg$/.test(key)
    && !key.includes("..");
}

export function getR2ImageKey(imageUrl: string): string | null {
  if (!imageUrl.startsWith(R2_IMAGE_PREFIX)) return null;
  const key = imageUrl.slice(R2_IMAGE_PREFIX.length);
  return isR2ImageKey(key) ? key : null;
}
