import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { gzipSync, brotliCompressSync } from "node:zlib";

const budget = 300000; // Decimal KB, compressed fresh-load JS including shared imports.
const manifest = JSON.parse(await readFile("dist/public/.vite/manifest.json", "utf8"));
const entry = Object.keys(manifest).find(key => manifest[key].isEntry);
if (!entry) throw new Error("Vite build manifest has no application entry");
const pages = Object.keys(manifest).filter(key => /^src\/pages\/.*\.tsx$/.test(key));
const visit = (key, found = new Set()) => {
  if (found.has(key)) return found;
  found.add(key);
  for (const imported of manifest[key]?.imports || []) visit(imported, found);
  return found;
};
const stats = new Map();
for (const [key, chunk] of Object.entries(manifest)) {
  if (!chunk.file.endsWith(".js")) continue;
  const content = await readFile(`dist/public/${chunk.file}`);
  stats.set(key, { file: chunk.file, raw: content.length, gzip: gzipSync(content, { level: 6 }).length,
    brotli: brotliCompressSync(content).length });
}
const shared = visit(entry);
const rows = pages.map(page => {
  const keys = new Set([...shared, ...visit(page)]);
  const chunks = [...keys].map(key => stats.get(key)).filter(Boolean);
  return { page, files: chunks.map(chunk => chunk.file),
    rawBytes: chunks.reduce((sum, chunk) => sum + chunk.raw, 0),
    gzipBytes: chunks.reduce((sum, chunk) => sum + chunk.gzip, 0),
    brotliBytes: chunks.reduce((sum, chunk) => sum + chunk.brotli, 0) };
}).sort((a, b) => b.gzipBytes - a.gzipBytes);
if (rows.length < 25) throw new Error("Expected separate chunks for all page modules");
// Verify every homepage image reference has both real responsive candidates.
for (const file of ["client/src/pages/landing.tsx", "client/src/pages/home.tsx",
  "client/src/components/heritage-carousel.tsx", "client/src/components/heritage-editorial.tsx"]) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/["'](\/images\/home\/[^"']+)["']/g)) {
    const base = match[1].replace(/-(640|1280)\.webp$/, "");
    for (const size of [640, 1280]) await access(`client/public${base}-${size}.webp`);
  }
}
await mkdir("reports", { recursive: true });
await writeFile("reports/route-javascript-budget.json", JSON.stringify({
  measurement: "Fresh route load: application entry plus route chunk and all static JS imports; gzip level 6; deferred interaction-only imports excluded",
  budgetBytes: budget, routes: rows,
}, null, 2));
console.table(rows.map(({ page, rawBytes, gzipBytes, brotliBytes }) =>
  ({ page: page.replace("src/pages/", ""), rawKB: (rawBytes / 1000).toFixed(1),
    gzipKB: (gzipBytes / 1000).toFixed(1), brotliKB: (brotliBytes / 1000).toFixed(1) })));
const failed = rows.filter(row => row.gzipBytes >= budget);
if (failed.length) throw new Error(`JavaScript budget exceeded: ${failed.map(row => row.page).join(", ")}`);
console.log(`PASS: ${rows.length} page modules below 300 KB gzip, including shared JavaScript.`);
