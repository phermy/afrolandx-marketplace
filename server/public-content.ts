import { escapeHtml as escape } from "./html-utils";
import { policies, type Policy } from "../client/src/lib/policies";
import { SUPPORT_HOURS } from "../shared/customer-support";
import { faqItems } from "../shared/support-faq";
import { accessibilityStatement } from "../shared/accessibility-statement";
import { publicPages, type MetadataProduct, type MetadataEntity, type PageMetadata } from "../shared/page-metadata";

export interface PublicContentData {
  catalog?: MetadataProduct[];
  product?: MetadataProduct;
  policy?: Policy;
  entity?: MetadataEntity;
}
const link = (path: string, label: string) => `<a href="${escape(path)}">${escape(label)}</a>`;
const paragraph = (text: string) => `<p>${escape(text)}</p>`;
function policyBody(policy: Policy): string {
  return `${policy.lastUpdated ? paragraph(`Last updated: ${policy.lastUpdated}`) : ""}
    <article class="policy-article">${policy.sections.map(section =>
      `<section><h2>${escape(section.heading)}</h2>${paragraph(section.body)}</section>`).join("")}</article>`;
}
function catalogBody(items: MetadataProduct[]): string {
  return items.length ? `<ul class="ssr-catalog">${items.map(item => `<li>${link(`/products/${item.id}`, item.name)}
    ${paragraph(`₦${Number(item.price).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`)}</li>`).join("")}</ul>`
    : paragraph("No products are currently available. Please check back for new listings.");
}

/** Actual request-time content, inside #root, visible with JavaScript disabled.
 * React takes over interactive rendering; never server-render account/private data.
 */
export function renderPublicContent(metadata: PageMetadata, data: PublicContentData = {}): string {
  if (metadata.status !== 200) return `<main class="policy-shell" data-server-rendered><h1>${metadata.status === 404 ? "Page not found" : "Temporarily unavailable"}</h1>
    ${paragraph(metadata.description)}${link("/products", "Browse products")}</main>`;
  const path = metadata.path;
  if (!metadata.indexable && !data.entity) return "";
  let title = metadata.title.replace(/ \| Afrolandx$/, "");
  let content = "";
  if (path === "/" || path === "/products") {
    title = path === "/" ? "African stories, made tangible." : "Shop African fashion";
    content = path === "/" ? `${paragraph("Discover African clothing, textiles, accessories and craftsmanship from independent makers.")}
      <img src="/images/home/pan_african_diversity-1280.webp"
        srcset="/images/home/pan_african_diversity-640.webp 640w, /images/home/pan_african_diversity-1280.webp 1280w"
        sizes="(max-width: 640px) 100vw, 800px" width="1280" height="698" alt="African heritage and traditional dress" fetchpriority="high"
        style="max-width:100%;height:auto">${link("/products", "Explore the collection")}` : "";
    content += `<h2>Available products</h2>${catalogBody(data.catalog || [])}`;
  } else if (data.product) {
    title = data.product.name;
    content = `${paragraph(data.product.description || metadata.description)}
      ${paragraph(`Price: ₦${Number(data.product.price).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`)}
      ${paragraph(Number(data.product.stock) > 0 ? "In stock" : "Out of stock")}
      ${link("/size-guide", "Size guide")} · ${link("/shipping-information", "Shipping information")} · ${link("/returns", "Returns")}`;
  } else if (data.policy) {
    title = data.policy.title;
    content = policyBody(data.policy);
  } else if (path === "/policies") {
    content = `<ul>${policies.map(policy => `<li>${link(`/policies/${policy.slug}`, policy.title)}${paragraph(policy.summary)}</li>`).join("")}</ul>`;
  } else if (path === "/faq") {
    content = faqItems.map(item => `<section><h2>${escape(item.q)}</h2>${paragraph(item.a)}</section>`).join("");
  } else if (path === "/accessibility") {
    title = accessibilityStatement.title;
    content = `${paragraph(accessibilityStatement.intro)}${paragraph(`Last updated: ${accessibilityStatement.updated}`)}
      ${accessibilityStatement.sections.map(section => `<section><h2>${escape(section.heading)}</h2>${paragraph(section.body)}</section>`).join("")}
      <h2>Accessibility support</h2>${link("mailto:support@afrolandx.com", "support@afrolandx.com")} ·
      ${link("https://wa.me/2347082427348", "WhatsApp: +234 708 242 7348")}${paragraph(`Support hours: ${SUPPORT_HOURS}.`)}`;
  } else if (path === "/contact") {
    content = `<h2>Email support</h2>${link("mailto:support@afrolandx.com", "support@afrolandx.com")}
      <h2>WhatsApp</h2>${link("https://wa.me/2347082427348", "+234 708 242 7348")}
      <h2>Customer support hours</h2>${paragraph(SUPPORT_HOURS)}
      <h2>Payment and refund questions</h2>${link("mailto:payments@afrolandx.com", "payments@afrolandx.com")}`;
  } else if (path === "/returns" || path === "/shipping-information") {
    content = policyBody(policies.find(policy => policy.slug === (path === "/returns" ? "return-policy" : "shipping-policy"))!);
  } else if (path === "/size-guide") {
    content = `${paragraph("Each maker uses their own sizes. Compare the individual listing’s garment measurements with a similar item that fits you. Use centimetres (cm).")}
      <h2>Body measurements</h2>${paragraph("Measure around the fullest part of your bust or chest and hips. Measure your natural waist without pulling the tape tight. Keep the tape level.")}
      <h2>Garment measurements</h2>${paragraph("Lay the garment flat without stretching. Measure chest width underarm to underarm, and length from the shoulder or waistband to the hem. A flat width is not a circumference. Follow the vendor’s measurement method.")}
      ${paragraph("No size label or measurement guarantees a particular fit.")}`;
  } else if (data.entity) {
    title = data.entity.name;
    content = paragraph(data.entity.description || metadata.description);
  } else if (publicPages[path]) {
    content = `${paragraph(metadata.description)}${link("/products", "Browse the collection")} · ${link("/contact", "Contact support")}`;
  } else return "";
  return `<div data-server-rendered class="min-h-screen bg-[#fbf8f2]">
    <header class="ssr-nav">${link("/", "Afrolandx")} ${link("/products", "Products")} ${link("/policies", "Policies")} ${link("/contact", "Contact")}</header>
    <main class="policy-shell"><h1 class="policy-title">${escape(title)}</h1>${content}</main>
    <footer class="ssr-nav">${link("/faq", "FAQ")} ${link("/size-guide", "Size guide")} ${link("/shipping-information", "Shipping")} ${link("/returns", "Returns")}
    ${link("/accessibility", "Accessibility")}
    ${paragraph("Afrolandx · CAC REG: 7039498")}</footer></div>`;
}
