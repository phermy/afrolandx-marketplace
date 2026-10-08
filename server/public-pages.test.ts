import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageMetadata, publicNumericId } from "../shared/page-metadata";
import { createPublicProductHandler } from "./public-product";
import { renderPageHtml } from "./public-pages";

const response = () => ({
  statusCode: 200, body: undefined as any,
  status(value: number) { this.statusCode = value; return this; },
  json(value: any) { this.body = value; return this; },
});
test("public product: junk and out-of-range identifiers never query storage", async () => {
  const handler = createPublicProductHandler({ getProduct: async () => { throw new Error("Unexpected read"); } } as any);
  for (const id of ["0", "-2", "12abc", "1.2", "2147483648", "99999999999999999999"]) {
    const res = response();
    await handler({ params: { id } } as any, res as any, () => {});
    assert.equal(res.statusCode, 404, id);
    assert.equal(publicNumericId(id), null);
  }
});
test("public product: approval and verified vendor gates remain mandatory", async () => {
  for (const [status, vendorStatus, verified, expected] of [
    ["approved", "approved", "verified", 200], ["draft", "approved", "verified", 404],
    ["approved", "suspended", "verified", 404], ["approved", "approved", "pending", 404],
  ] as const) {
    const handler = createPublicProductHandler({
      getProduct: async () => ({ id: 12, vendorId: 7, status }),
      getVendor: async () => ({ status: vendorStatus, verificationStatus: verified }),
    } as any);
    const res = response();
    await handler({ params: { id: "12" } } as any, res as any, () => {});
    assert.equal(res.statusCode, expected);
  }
});
test("metadata: private routes and missing pages are not indexable", () => {
  for (const path of ["/admin", "/vendor", "/checkout", "/profile", "/my-orders", "/discover", "/order-success", "/login"]) {
    const metadata = pageMetadata(path);
    assert.equal(metadata.status, 200);
    assert.equal(metadata.indexable, false);
  }
  for (const path of ["/unknown-qa-page", "/products/12abc", "/products/0", "/policies/not-real"]) {
    const metadata = pageMetadata(path);
    assert.equal(metadata.status, 404);
    assert.equal(metadata.indexable, false);
  }
  assert.equal(pageMetadata("/products/12", null).status, 404);
});
test("metadata: page names differ and canonical product URLs exclude tracking", () => {
  assert.notEqual(pageMetadata("/products").title, pageMetadata("/events").title);
  assert.equal(pageMetadata("/Products/0012/?utm_source=qa").path, "/products/12");
  const product = { id: 12, name: "Fixture piece", price: "8500.00", stock: 2 };
  const data = pageMetadata("/products/12", product).structuredData as any;
  assert.equal(data.offers.priceCurrency, "NGN");
  assert.equal(data.offers.price, "8500.00");
  assert.equal(data.offers.availability, "https://schema.org/InStock");
  assert.equal(data.aggregateRating, undefined);
});
test("metadata HTML: escape listing text and protect structured data from script injection", () => {
  const template = readFileSync("client/index.html", "utf8");
  const metadata = pageMetadata("/products/12", { id: 12, name: '</script><script>alert("fixture")</script>', description: 'A "quoted" <piece>', price: "100.00", stock: 0 });
  const html = renderPageHtml(template, metadata);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes('</script><script>alert("fixture")'));
  assert.ok(html.includes("\\u003c/script>"));
  assert.ok(html.includes("<noscript>"));
  assert.ok(html.includes('rel="canonical" href="https://afrolandx.com/products/12"'));
  assert.ok(renderPageHtml(template, metadata, true).includes('name="robots" content="noindex,follow"'));
});
test("metadata HTML: unknown pages do not canonicalize to the homepage", () => {
  const html = renderPageHtml(readFileSync("client/index.html", "utf8"), pageMetadata("/not-a-real-page"));
  assert.ok(!html.includes('rel="canonical"'));
  assert.ok(html.includes('name="robots" content="noindex,follow"'));
});
