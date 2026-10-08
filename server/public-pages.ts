import type { Express } from "express";
import { pageMetadata, publicNumericId, publicPages, PUBLIC_SITE_ORIGIN, type PageMetadata } from "../shared/page-metadata";
import { policies } from "../client/src/lib/policies";
import { storage } from "./storage";
import { getPublicProduct } from "./public-product";
import { db } from "./db";
import { products, vendors } from "../shared/schema";
import { and, eq, asc } from "drizzle-orm";

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export function renderPageHtml(template: string, metadata: PageMetadata, preview = false): string {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonical = `${PUBLIC_SITE_ORIGIN}${metadata.path}`;
  const indexable = metadata.indexable && !preview;
  const head = [
    `<meta name="description" content="${description}">`,
    `<meta name="robots" content="${indexable ? "index,follow" : "noindex,follow"}">`,
    ...(metadata.status === 200 ? [`<link rel="canonical" href="${escapeHtml(canonical)}">`] : []),
    `<meta property="og:site_name" content="Afrolandx">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    ...(metadata.status === 200 ? [`<meta property="og:url" content="${escapeHtml(canonical)}">`] : []),
    ...(metadata.image ? [`<meta property="og:image" content="${escapeHtml(metadata.image)}">`] : []),
    `<meta name="twitter:card" content="${metadata.image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    ...(metadata.image ? [`<meta name="twitter:image" content="${escapeHtml(metadata.image)}">`] : []),
    `<link rel="manifest" href="/manifest.json">`,
    ...(metadata.structuredData ? [`<script type="application/ld+json" data-page-metadata>${JSON.stringify(metadata.structuredData).replace(/</g, "\\u003c")}</script>`] : []),
  ].join("\n");
  const noScript = `<noscript><section style="max-width:52rem;margin:2rem auto;padding:1rem;font-family:sans-serif"><h1>${title}</h1><p>${description}</p><p>Enable JavaScript to browse interactive features, manage your account and complete checkout.</p><nav><a href="/">Home</a> · <a href="/products">Shop</a> · <a href="/policies">Marketplace policies</a></nav></section></noscript>`;
  return template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace("<!--afrolandx:seo-->", head).replace('<div id="root"></div>', `${noScript}<div id="root"></div>`);
}
export function registerPublicPages(app: Express) {
  const preview = app.get("env") !== "production";
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(preview ? "User-agent: *\nDisallow: /\n" :
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /vendor$\nDisallow: /vendor/\nDisallow: /checkout\nDisallow: /profile\nDisallow: /my-orders\nDisallow: /order-success\nDisallow: /discover\nSitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml\n`);
  });
  app.get("/manifest.json", (_req, res) => res.type("application/manifest+json").json({
    name: "Afrolandx", short_name: "Afrolandx", start_url: "/", scope: "/", display: "standalone",
    theme_color: "#14532d", background_color: "#ffffff",
  }));
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const ids = await db.select({ id: products.id }).from(products)
        .innerJoin(vendors, eq(products.vendorId, vendors.id))
        .where(and(eq(products.status, "approved"), eq(vendors.status, "approved"), eq(vendors.verificationStatus, "verified")))
        .orderBy(asc(products.id)).limit(49000);
      const paths = [...Object.keys(publicPages), ...policies.map(policy => `/policies/${policy.slug}`), ...ids.map(product => `/products/${product.id}`)];
      res.type("application/xml").set("Cache-Control", "public, max-age=300").send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${escapeHtml(`${PUBLIC_SITE_ORIGIN}${path}`)}</loc></url>`).join("")}</urlset>`,
      );
    } catch { res.status(503).type("text/plain").send("Sitemap temporarily unavailable"); }
  });
  app.use(async (req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) || req.path.includes(".") || /^\/(?:api|assets|src|uploads|downloads|node_modules|@)/.test(req.path)) return next();
    const path = req.path.replace(/\/+$/, "").toLowerCase() || "/";
    let metadata = pageMetadata(path, undefined, policies.find(policy => path === `/policies/${policy.slug}`));
    if (metadata.status === 200 && req.path !== metadata.path) {
      const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
      return res.redirect(308, metadata.path + query);
    }
    const productId = path.match(/^\/products\/([^/]+)$/)?.[1];
    if (productId && publicNumericId(productId)) {
      try { metadata = pageMetadata(path, await getPublicProduct(storage, publicNumericId(productId)!) || null); }
      catch {
        metadata = { ...metadata, title: "Temporarily Unavailable | Afrolandx", description: "This product could not be loaded. Please try again shortly.", status: 503, indexable: false };
        res.set("Retry-After", "30");
      }
    }
    res.locals.pageMetadata = metadata;
    res.set("X-Robots-Tag", metadata.indexable && !preview ? "index, follow" : "noindex, follow");
    next();
  });
}
