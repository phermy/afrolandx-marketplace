import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageMetadata, publicPages, DEFAULT_SOCIAL_IMAGE } from "../shared/page-metadata";
import { faqItems } from "../shared/support-faq";
import { renderPageHtml } from "./public-pages";
import { renderPublicContent } from "./public-content";
import { policies } from "../client/src/lib/policies";

test("every static public page has social imagery, canonical metadata and structured data", () => {
  for (const path of Object.keys(publicPages)) {
    const metadata = pageMetadata(path);
    assert.equal(metadata.image, DEFAULT_SOCIAL_IMAGE);
    assert.ok(metadata.structuredData);
    const html = renderPageHtml(readFileSync("client/index.html", "utf8"), metadata);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /property="og:image"/);
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /data-server-rendered/);
    assert.ok(!html.includes('<div id="root"></div>'));
  }
});
test("FAQ structured data uses the same answers as HTML and the interactive app", () => {
  const metadata = pageMetadata("/faq");
  const graph = metadata.structuredData?.["@graph"] as any[];
  const faq = graph.find(item => item["@type"] === "FAQPage");
  assert.equal(faq.mainEntity.length, faqItems.length);
  for (const item of faqItems) assert.ok(renderPublicContent(metadata).includes(item.q));
});
test("key pages contain meaningful, escaped server-rendered content without JavaScript", () => {
  const product = { id: 12, name: '<script>alert("unsafe")</script>', description: "Actual garment", price: "8500", stock: 4 };
  const html = renderPublicContent(pageMetadata("/products/12", product), { product });
  assert.ok(!html.includes('<script>alert("unsafe")'));
  assert.match(html, /Actual garment/);
  assert.match(html, /₦8,500\.00/);
  assert.match(renderPublicContent(pageMetadata("/contact")), /8:00 AM to 6:00 PM WAT/);
  const policy = policies.find(item => item.slug === "return-policy")!;
  assert.match(renderPublicContent(pageMetadata("/policies/return-policy", undefined, policy), { policy }), /5 to 14 business days/);
});
test("404 pages have no canonical and do not publish structured data", () => {
  for (const path of ["/unknown", "/file-does-not-exist.pdf", "/products/2147483648", "/vendors/nope", "/policies/none"]) {
    const metadata = pageMetadata(path);
    assert.equal(metadata.status, 404);
    const html = renderPageHtml(readFileSync("client/index.html", "utf8"), metadata);
    assert.ok(!html.includes('rel="canonical"'));
    assert.ok(!html.includes('type="application/ld+json"'));
    assert.match(html, /Page not found/);
  }
});
test("dynamic entity metadata distinguishes actual public names from missing records", () => {
  assert.equal(pageMetadata("/vendors/42", undefined, undefined, null).status, 404);
  const metadata = pageMetadata("/vendors/42", undefined, undefined, { id: 42, name: "Verified Maker", description: "Handmade textiles" });
  assert.equal(metadata.title, "Verified Maker | Afrolandx");
  assert.equal(metadata.indexable, true);
  assert.ok(metadata.structuredData);
  assert.equal(pageMetadata("/discover").indexable, false);
  assert.equal(pageMetadata("/admin").indexable, false);
});
