// Read-only checks against production static serving, without application startup
// cleanup, seed jobs, auth, payment initialization, or writes to the database.
import assert from "node:assert/strict";
import express from "express";
import compression from "compression";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import http from "node:http";
import { registerPublicPages } from "../server/public-pages";
import { serveStatic } from "../server/vite";

const app = express();
app.set("env", "production");
app.use(compression({ level: 6 }));
registerPublicPages(app);
serveStatic(app, path.resolve("dist/public"));
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const port = (server.address() as { port: number }).port;
const base = `http://127.0.0.1:${port}`;
try {
  for (const route of ["/", "/products", "/contact", "/faq", "/size-guide", "/returns",
    "/accessibility",
    "/shipping-information", "/policies", "/policies/prohibited-and-restricted-products"]) {
    const response = await fetch(base + route);
    const html = await response.text();
    assert.equal(response.status, 200, route);
    assert.match(html, /data-server-rendered/, route);
    assert.match(html, /<html lang="en-NG">/, route);
    assert.match(html, /property="og:image"/, route);
    assert.match(html, /rel="canonical"/, route);
    assert.match(html, /application\/ld\+json/, route);
    assert.equal(response.headers.get("x-robots-tag"), "index, follow", route);
    console.log(`PASS 200 server-rendered ${route}`);
  }
  for (const route of ["/seo-missing-page", "/missing.file.html", "/products/999999999",
    "/products/12junk", "/vendors/999999999", "/collab-drops/999999999", "/policies/unknown",
    "/assets/missing.js", "/images/missing.webp"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 404, route);
    console.log(`PASS real 404 ${route}`);
  }
  const redirect = await fetch(base + "/FAQ/?utm_source=test", { redirect: "manual" });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "/faq?utm_source=test");
  const robots = await (await fetch(base + "/robots.txt")).text();
  assert.match(robots, /Disallow: \/discover/);
  const sitemap = await (await fetch(base + "/sitemap.xml")).text();
  assert.match(sitemap, /https:\/\/afrolandx\.com\/contact/);
  assert.ok(!sitemap.includes("<loc>https://afrolandx.com/discover</loc>"));
  const manifest = JSON.parse(await readFile("dist/public/.vite/manifest.json", "utf8"));
  const entry = Object.values(manifest).find((item: any) => item.isEntry) as { file: string };
  const original = await readFile(`dist/public/${entry.file}`);
  await new Promise<void>((resolve, reject) => {
    http.get(`${base}/${entry.file}`, { headers: { "Accept-Encoding": "gzip" } }, response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        try {
          assert.equal(response.statusCode, 200);
          assert.equal(response.headers["content-encoding"], "gzip");
          assert.match(String(response.headers["cache-control"]), /immutable/);
          const compressed = Buffer.concat(chunks);
          assert.deepEqual(gunzipSync(compressed), original);
          assert.ok(compressed.length < original.length);
          console.log(`PASS real gzip asset transfer: ${original.length} → ${compressed.length} bytes`);
          resolve();
        } catch (error) { reject(error); }
      });
    }).on("error", reject);
  });
  const image = await fetch(base + "/images/home/pan_african_diversity-640.webp");
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type") || "", /image\/webp/);
  console.log("PASS responsive home image and production SEO checks");
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
}
