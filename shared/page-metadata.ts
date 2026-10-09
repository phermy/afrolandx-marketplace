// Verified against deployment metadata. Never use a preview host for canonical URLs.
import { faqItems } from "./support-faq";
export const PUBLIC_SITE_ORIGIN = "https://afrolandx.com";
export const DEFAULT_SOCIAL_IMAGE = `${PUBLIC_SITE_ORIGIN}/images/social/afrolandx.jpg`;
export const publicPages: Record<string, { title: string; description: string }> = {
  "/": { title: "Afrolandx | Authentic African Fashion", description: "Discover authentic African clothing, textiles and accessories from verified makers. Explore African craftsmanship and shop on Afrolandx." },
  "/products": { title: "Shop African Fashion | Afrolandx", description: "Browse African clothing, textiles and accessories. Discover makers, compare pieces and find your next purchase on Afrolandx." },
  "/reviews": { title: "Customer Reviews | Afrolandx", description: "Read published customer feedback about shopping, products and delivery on Afrolandx." },
  "/collab-drops": { title: "Collaborative Collections | Afrolandx", description: "Explore collaborative collections and limited releases from African makers on Afrolandx." },
  "/events": { title: "Event Planning | Afrolandx", description: "Explore event planning services and send your event requirements to Afrolandx." },
  "/lookbook": { title: "African Fashion Lookbook | Afrolandx", description: "Explore African fashion inspiration and discover pieces to create your next look." },
  "/policies": { title: "Marketplace Policies | Afrolandx", description: "Read Afrolandx policies for shopping, shipping, returns, privacy and selling on the marketplace." },
  "/contact": { title: "Contact Us | Afrolandx", description: "Contact Afrolandx support by email or WhatsApp for help with shopping, orders and marketplace questions." },
  "/faq": { title: "Frequently Asked Questions | Afrolandx", description: "Find answers about shopping, payments, delivery, returns, sizing and assisted tools on Afrolandx." },
  "/size-guide": { title: "Size Guide | Afrolandx", description: "Learn how to take body and garment measurements and compare them with each maker’s sizing information." },
  "/shipping-information": { title: "Shipping Information | Afrolandx", description: "Understand delivery quotes, tracking, preparation and shipping responsibilities before ordering on Afrolandx." },
  "/returns": { title: "Returns and Refunds | Afrolandx", description: "Learn how to request a return, follow approved return instructions and contact Afrolandx about refunds." },
};
const privatePages: Record<string, string> = {
  "/login": "Sign In", "/register": "Create an Account", "/forgot-password": "Reset Password",
  "/checkout": "Checkout", "/profile": "Your Profile", "/my-orders": "Your Orders",
  "/order-success": "Payment Confirmation", "/admin": "Administration", "/admin/finance": "Administration Finance",
  "/vendor": "Vendor Dashboard", "/vendor/finance": "Vendor Finance", "/vendor/workshop": "Vendor Workshop",
  "/shipping": "Shipping Operations", "/discover": "Discover Preview", "/measurements": "Your Measurements",
  "/messages": "Your Messages", "/loyalty": "Your Rewards",
};
export interface MetadataProduct {
  id: number; name: string; description?: string | null; metaTitle?: string | null;
  metaDescription?: string | null; imageUrl?: string | null; price: string | number; stock?: number | null;
}
export interface MetadataEntity {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}
export interface PageMetadata {
  title: string; description: string; path: string; indexable: boolean; status: number;
  image?: string; structuredData?: Record<string, unknown>;
}
export function publicNumericId(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}
function basePageMetadata(
  rawPath: string,
  product?: MetadataProduct | null,
  policy?: { slug: string; title: string; summary: string },
): PageMetadata {
  const path = rawPath.split("?")[0].replace(/\/+$/, "").toLowerCase() || "/";
  const notFound = (): PageMetadata => ({ title: "Page Not Found | Afrolandx", description: "This page is not available. Browse products or marketplace policies on Afrolandx.", path, indexable: false, status: 404 });
  if (publicPages[path]) return { ...publicPages[path], path, indexable: true, status: 200,
    ...(path === "/" ? { structuredData: { "@context": "https://schema.org", "@type": "WebSite", name: "Afrolandx", url: PUBLIC_SITE_ORIGIN } } : {}) };
  if (privatePages[path]) return { title: `${privatePages[path]} | Afrolandx`, description: "Manage your Afrolandx account securely.", path, indexable: false, status: 200 };
  const productMatch = path.match(/^\/products\/([^/]+)$/);
  if (productMatch) {
    const id = publicNumericId(productMatch[1]);
    if (!id || product === null || (product && product.id !== id)) return notFound();
    const canonicalPath = `/products/${id}`;
    if (!product) return { title: "Product | Afrolandx", description: "Discover this piece on Afrolandx.", path: canonicalPath, indexable: true, status: 200 };
    let image: string | undefined;
    try {
      const url = new URL(product.imageUrl || "", PUBLIC_SITE_ORIGIN);
      if (product.imageUrl && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password) image = url.href;
    } catch { /* Do not publish malformed media URLs. */ }
    const description = (product.metaDescription || product.description || `Shop ${product.name} on Afrolandx.`).replace(/\s+/g, " ").trim().slice(0, 240);
    const price = Number(product.price);
    return {
      title: (product.metaTitle?.trim() || `${product.name} | Afrolandx`).slice(0, 180),
      description, path: canonicalPath, indexable: true, status: 200, image,
      structuredData: {
        "@context": "https://schema.org", "@type": "Product", name: product.name, description,
        ...(image ? { image } : {}),
        ...(Number.isFinite(price) && price >= 0 ? { offers: {
          "@type": "Offer", price: price.toFixed(2), priceCurrency: "NGN",
          url: `${PUBLIC_SITE_ORIGIN}${canonicalPath}`,
          availability: Number(product.stock) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        } } : {}),
      },
    };
  }
  if (policy && path === `/policies/${policy.slug}`) return { title: `${policy.title} | Afrolandx`, description: policy.summary, path, indexable: true, status: 200 };
  const dynamic = path.match(/^\/(vendors|collab-drops|quizzes|admin\/products)\/(\d+)$/);
  if (dynamic && publicNumericId(dynamic[2])) return { title: `${dynamic[1] === "vendors" ? "Maker" : dynamic[1] === "collab-drops" ? "Collaborative Collection" : dynamic[1] === "quizzes" ? "Cultural Quiz" : "Product Review"} | Afrolandx`, description: "Explore Afrolandx.", path: `/${dynamic[1]}/${Number(dynamic[2])}`, indexable: false, status: 200 };
  return notFound();
}

export function pageMetadata(
  rawPath: string,
  product?: MetadataProduct | null,
  policy?: { slug: string; title: string; summary: string },
  entity?: MetadataEntity | null,
): PageMetadata {
  const metadata = basePageMetadata(rawPath, product, policy);
  const dynamic = metadata.path.match(/^\/(vendors|collab-drops|quizzes)\/(\d+)$/);
  if (dynamic && (entity === null || (entity && entity.id !== Number(dynamic[2])))) {
    return { title: "Page Not Found | Afrolandx", description: "This page is not available.", path: metadata.path,
      status: 404, indexable: false, image: DEFAULT_SOCIAL_IMAGE };
  }
  if (dynamic && entity) {
    metadata.title = `${entity.name} | Afrolandx`;
    metadata.description = (entity.description || `Explore ${entity.name} on Afrolandx.`).replace(/\s+/g, " ").slice(0, 240);
    metadata.indexable = dynamic[1] !== "quizzes";
    try {
      const image = new URL(entity.imageUrl || "", PUBLIC_SITE_ORIGIN);
      if (entity.imageUrl && ["https:", "http:"].includes(image.protocol) && !image.username && !image.password) metadata.image = image.href;
    } catch { /* Never expose invalid media URLs in metadata. */ }
  }
  metadata.image ||= DEFAULT_SOCIAL_IMAGE;
  if (!metadata.indexable || metadata.status !== 200 || metadata.structuredData?.["@type"] === "Product") return metadata;
  const url = `${PUBLIC_SITE_ORIGIN}${metadata.path}`;
  metadata.structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${PUBLIC_SITE_ORIGIN}/#organization`, name: "Afrolandx", url: PUBLIC_SITE_ORIGIN,
        logo: `${PUBLIC_SITE_ORIGIN}/images/social/logo.webp`, email: "info@afrolandx.com" },
      { "@type": "WebSite", "@id": `${PUBLIC_SITE_ORIGIN}/#website`, name: "Afrolandx", url: PUBLIC_SITE_ORIGIN,
        publisher: { "@id": `${PUBLIC_SITE_ORIGIN}/#organization` } },
      { "@type": metadata.path === "/faq" ? "FAQPage" : metadata.path === "/contact" ? "ContactPage"
          : ["/products", "/reviews", "/collab-drops", "/lookbook", "/policies"].includes(metadata.path) ? "CollectionPage" : "WebPage",
        "@id": `${url}#page`, url, name: metadata.title, description: metadata.description,
        isPartOf: { "@id": `${PUBLIC_SITE_ORIGIN}/#website` },
        ...(metadata.path === "/faq" ? { mainEntity: faqItems.map(item => ({
          "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a },
        })) } : {}) },
      ...(metadata.path !== "/" ? [{ "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: PUBLIC_SITE_ORIGIN },
        { "@type": "ListItem", position: 2, name: policy?.title || metadata.title.replace(/ \| Afrolandx$/, ""), item: url },
      ] }] : []),
    ],
  };
  return metadata;
}
