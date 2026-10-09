import sharp from "sharp";
import { readFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const sourceNames = [
  "maasai_warriors_kenya", "african_leader_mandela_tribute", "ethiopian_traditional_timkat",
  "ghanaian_ashanti_chief", "moroccan_berber_culture", "ndebele_south_africa",
  "pan_african_diversity", "rwandan_intore_dancer", "african_kente_cloth__8cfc9c20",
  "yoruba-crown-detail", "dogon-ancestor", "north-africa-amazigh", "central-africa-kuba-textile",
  "kente-weaving", "benin-bronzes", "east-africa-ethiopian-garment", "southern-africa-ndebele-beadwork",
  "nigerian_tribal_chie_11b29bb3", "hausa_traditional_cr_fa5db11d",
  "nigeria_cultural_her_0933402b", "nigerian_tribal_chie_4e3710c4",
];
const output = "client/public/images/home";
await mkdir(output, { recursive: true });
let before = 0, after = 0;
for (const name of sourceNames) {
  let input;
  try { input = await readFile(join("attached_assets/stock_images", `${name}.webp`)); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    // Editorial assets may live alongside the source component instead.
    try { input = await readFile(join("attached_assets/stock_images", `${name}.jpg`)); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      input = await readFile(join("attached_assets/heritage", `${name}.webp`));
    }
  }
  before += input.length;
  for (const width of [640, 1280]) {
    const path = join(output, `${name}-${width}.webp`);
    await sharp(input).rotate().resize({ width })
      .webp({ quality: 72, effort: 6 }).toFile(path);
    if (width === 1280) after += (await stat(path)).size;
  }
}
await mkdir("client/public/images/social", { recursive: true });
await sharp("attached_assets/Group 1000002646_1749631956471.png").resize({ width: 256 })
  .webp({ quality: 85 }).toFile("client/public/images/social/logo.webp");
const social = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#fbf8f2"/><rect x="60" y="60" width="1080" height="510" rx="12" fill="#173c2e"/><text x="115" y="310" fill="#fbf8f2" font-family="sans-serif" font-weight="700" font-size="108">Afrolandx</text><text x="120" y="400" fill="#dbc499" font-family="sans-serif" font-size="36">African stories, made tangible.</text></svg>`;
await sharp(Buffer.from(social)).jpeg({ quality: 80, mozjpeg: true })
  .toFile("client/public/images/social/afrolandx.jpg");
console.log(JSON.stringify({ originalBytes: before, optimizedDesktopBytes: after, reductionPercent: Math.round((1 - after / before) * 100) }));
