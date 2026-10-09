import { mkdir, writeFile } from "node:fs/promises";
const source = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";
const response = await fetch(source, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36" } });
if (!response.ok) throw new Error("Font stylesheet download failed");
let css = await response.text();
const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(match => match[1]))];
if (!urls.length) throw new Error("No font files found");
await mkdir("client/public/fonts", { recursive: true });
for (const [index, url] of urls.entries()) {
  const font = await fetch(url);
  if (!font.ok) throw new Error("Font download failed");
  const extension = url.includes(".woff2") ? "woff2" : "ttf";
  const name = `afrolandx-font-${index}.${extension}`;
  await writeFile(`client/public/fonts/${name}`, Buffer.from(await font.arrayBuffer()));
  css = css.replaceAll(url, `/fonts/${name}`);
}
if (/https?:\/\//.test(css)) throw new Error("External font resource remains");
await writeFile("client/public/fonts/fonts.css", css);
for (const family of ["dmsans", "spacegrotesk"]) {
  const license = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`);
  if (!license.ok) throw new Error("Font license download failed");
  await writeFile(`client/public/fonts/${family}-OFL.txt`, await license.text());
}
console.log(`Self-hosted ${urls.length} font files with their OFL licenses; no visitor requests to Google Fonts.`);
