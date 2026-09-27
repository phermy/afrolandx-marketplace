import sharp from "sharp";

export const PRODUCT_IMAGE_MAX_EDGE = 2400;

export async function optimizeProductImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(PRODUCT_IMAGE_MAX_EDGE, PRODUCT_IMAGE_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .toColourspace("srgb")
    .flatten({ background: "#ffffff" })
    .jpeg({
      quality: 95,
      chromaSubsampling: "4:4:4",
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer();
}