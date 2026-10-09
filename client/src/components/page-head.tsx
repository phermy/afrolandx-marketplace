import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { pageMetadata, publicNumericId, PUBLIC_SITE_ORIGIN, type MetadataProduct, type MetadataEntity } from "@shared/page-metadata";
import { policies } from "@/lib/policies";

export default function PageHead() {
  const [location] = useLocation();
  const path = location.split("?")[0];
  const id = publicNumericId(path.match(/^\/products\/([^/]+)$/)?.[1]);
  const productQuery = useQuery<MetadataProduct>({
    queryKey: ["/api/products", id], enabled: !!id, retry: false,
  });
  const product = productQuery.isError ? null : productQuery.data;
  const entityMatch = path.match(/^\/(vendors|collab-drops|quizzes)\/([^/]+)$/);
  const entityId = publicNumericId(entityMatch?.[2]);
  const entityKind = entityMatch?.[1];
  const entityQuery = useQuery<any>({
    queryKey: [entityKind === "vendors" ? "/api/public/vendors" : `/api/${entityKind}`, entityId],
    enabled: !!entityId, retry: false,
  });
  const entityRecord = entityKind === "vendors" ? entityQuery.data?.vendor : entityQuery.data;
  const entity: MetadataEntity | null | undefined = entityQuery.isError ? null : entityRecord
    ? { id: entityId!, name: entityRecord.businessName || entityRecord.name || entityRecord.title,
      description: entityRecord.description, imageUrl: entityRecord.coverImage } : undefined;
  useEffect(() => {
    const metadata = pageMetadata(path, product, policies.find(policy => path === `/policies/${policy.slug}`), entity);
    document.title = metadata.title;
    const setMeta = (attribute: "name" | "property", name: string, content?: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
      if (!content) { element?.remove(); return; }
      if (!element) { element = document.createElement("meta"); element.setAttribute(attribute, name); document.head.append(element); }
      element.content = content;
    };
    setMeta("name", "description", metadata.description);
    setMeta("name", "robots", metadata.indexable ? "index,follow" : "noindex,follow");
    setMeta("property", "og:title", metadata.title);
    setMeta("property", "og:description", metadata.description);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", "Afrolandx");
    setMeta("property", "og:image", metadata.image);
    setMeta("name", "twitter:card", metadata.image ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", metadata.title);
    setMeta("name", "twitter:description", metadata.description);
    setMeta("name", "twitter:image", metadata.image);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (metadata.status !== 200) { canonical?.remove(); setMeta("property", "og:url", undefined); }
    else {
      if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
      canonical.href = `${PUBLIC_SITE_ORIGIN}${metadata.path}`;
      setMeta("property", "og:url", canonical.href);
    }
    document.querySelector('script[data-page-metadata]')?.remove();
    if (metadata.structuredData) {
      const script = document.createElement("script");
      script.type = "application/ld+json"; script.dataset.pageMetadata = "";
      script.textContent = JSON.stringify(metadata.structuredData);
      document.head.append(script);
    }
  }, [path, product, entityQuery.data, entityQuery.isError]);
  return null;
}
