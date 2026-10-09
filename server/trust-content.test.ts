import test from "node:test";
import assert from "node:assert/strict";
import { pageMetadata } from "../shared/page-metadata";
import { policies } from "../client/src/lib/policies";

test("support pages are public and have distinct, accurate metadata", () => {
  const routes = ["/contact", "/faq", "/size-guide", "/shipping-information", "/returns"];
  const titles = new Set<string>();
  for (const route of routes) {
    const metadata = pageMetadata(route);
    assert.equal(metadata.status, 200, route);
    assert.equal(metadata.indexable, true, route);
    assert.equal(metadata.path, route);
    assert.ok(metadata.description.length > 20, route);
    titles.add(metadata.title);
  }
  assert.equal(titles.size, routes.length);
  assert.equal(pageMetadata("/shipping").indexable, false, "Shipping operations must stay private");
});

test("antiquities rule requires documented provenance and lawful trade", () => {
  const policy = policies.find(item => item.slug === "prohibited-and-restricted-products");
  assert.ok(policy);
  const section = policy.sections.find(item => item.heading === "Antiquities, cultural heritage and provenance");
  assert.ok(section);
  for (const wording of ["Stolen or looted", "verifiable provenance", "lawful ownership", "export and import permits", "review and approval", "must not be listed", "reproductions"]) {
    assert.ok(section.body.includes(wording), wording);
  }
  assert.equal(policy.lastUpdated, "2026-10-09");
  assert.equal(policies.find(item => item.slug === "return-policy")?.lastUpdated, undefined);
});
