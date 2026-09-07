import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import OpenAI, { toFile } from "openai";
import { getCloudStorageService, isCloudStorageEnabled } from "./cloudStorage";

export async function enhanceProductImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .normalize()
    .sharpen({ sigma: 0.7 })
    .jpeg({ quality: 90, progressive: true, mozjpeg: true })
    .toBuffer();
}

export async function storeProductImage(buffer: Buffer, folder = "products"): Promise<string> {
  const enhanced = await enhanceProductImage(buffer);
  if (isCloudStorageEnabled()) {
    return getCloudStorageService().uploadImage(enhanced, "image/jpeg", folder);
  }

  const uploadDir = path.join(process.cwd(), "uploads", folder);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `product-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.jpg`;
  fs.writeFileSync(path.join(uploadDir, filename), enhanced);
  return `/uploads/${folder}/${filename}`;
}

export async function retouchProductImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) throw new Error("AI image enhancement is not configured");

  const openai = new OpenAI({ apiKey, baseURL });
  const source = await toFile(buffer, "product-image.png", { type: mimeType });
  const result = await openai.images.edit({
    model: "gpt-image-1",
    image: source,
    prompt:
      "Retouch this ecommerce product photograph only: improve exposure, white balance, sharpness, and background cleanliness. Keep the exact product, colours, pattern, material appearance, proportions, branding, labels, and all design details unchanged. Do not add or remove product features. Use a neutral natural-looking studio background.",
    size: "1024x1024",
    quality: "medium",
  });
  const encoded = result.data?.[0]?.b64_json;
  if (!encoded) throw new Error("AI enhancement did not return an image");
  return Buffer.from(encoded, "base64");
}

export type ProductListingSuggestion = {
  title: string;
  shortDescription: string;
  description: string;
  categoryId: number;
};

export async function suggestProductListing(
  buffer: Buffer,
  mimeType: string,
  categories: Array<{ id: number; name: string }>,
): Promise<ProductListingSuggestion> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) throw new Error("AI product listing is not configured");

  const image = await sharp(buffer)
    .rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const openai = new OpenAI({ apiKey, baseURL });
  const categoryChoices = categories.map(category => `${category.id}: ${category.name}`).join("\n");
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `Create factual ecommerce listing copy from this product photo.

Return JSON with exactly: title, shortDescription, description, categoryId.
- title: concise, professional, no unsupported claims.
- shortDescription: one sentence, maximum 180 characters.
- description: 2-3 concise sentences describing only visible design, colour, pattern, silhouette, and apparent product type.
- categoryId: choose exactly one ID from the list below.
- Never infer or claim material composition, country of origin, traditional authenticity, brand, size, stock, care instructions, production method, or sustainability.
- Do not include a price.

Categories:
${categoryChoices}`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${image.toString("base64")}`, detail: "high" },
        },
      ],
    }],
  });
  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  const validCategoryIds = new Set(categories.map(category => category.id));
  return {
    title: String(parsed.title || "").trim().slice(0, 240),
    shortDescription: String(parsed.shortDescription || "").trim().slice(0, 240),
    description: String(parsed.description || "").trim().slice(0, 10000),
    categoryId: validCategoryIds.has(Number(parsed.categoryId)) ? Number(parsed.categoryId) : categories[0]?.id,
  };
}