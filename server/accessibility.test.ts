import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageMetadata } from "../shared/page-metadata";
import { accessibilityStatement } from "../shared/accessibility-statement";
import { renderPageHtml } from "./public-pages";

test("HTML declares Nigerian English", () => {
  assert.match(readFileSync("client/index.html", "utf8"), /<html lang="en-NG">/);
});
test("accessibility statement is public, indexable and rendered before JavaScript", () => {
  const metadata = pageMetadata("/accessibility");
  assert.equal(metadata.status, 200);
  assert.equal(metadata.indexable, true);
  assert.equal(metadata.title, "Accessibility Statement | Afrolandx");
  const html = renderPageHtml(readFileSync("client/index.html", "utf8"), metadata);
  assert.match(html, /href="https:\/\/afrolandx\.com\/accessibility"/);
  for (const section of accessibilityStatement.sections) assert.ok(html.includes(section.heading));
  assert.match(html, /support@afrolandx\.com/);
  assert.match(html, /wa\.me\/2347082427348/);
  assert.match(html, /WCAG.*2\.2 Level AA/);
  assert.match(html, /not a claim/);
  assert.match(html, /data-server-rendered/);
});
test("public statement is reachable from interactive and no-JavaScript footers", () => {
  assert.match(readFileSync("client/src/components/site-footer.tsx", "utf8"), /href="\/accessibility"/);
  assert.match(readFileSync("client/src/App.tsx", "utf8"), /path="\/accessibility"/);
  const html = renderPageHtml(readFileSync("client/index.html", "utf8"), pageMetadata("/"));
  assert.match(html, /<footer[\s\S]*href="\/accessibility"/);
});
