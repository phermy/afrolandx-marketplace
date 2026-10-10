import { useEffect } from "react";
import { Link, useParams } from "wouter";
import Navbar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";
import { policies, policyDate } from "@/lib/policies";
import { trackEvent } from "@/lib/analytics";
import { COMPANY_ADDRESS } from "@shared/company-contact";

export default function PolicyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const policy = policies.find((item) => item.slug === slug);
  useEffect(() => {
    if (!policy) return;
    const policyIndex = policies.findIndex((item) => item.slug === policy.slug);
    const policyGroup = policyIndex < 7 ? "customer" : policyIndex < 9 ? "marketplace" : "vendor";
    trackEvent("policy_viewed", {
      policy_slug: policy.slug,
      policy_group: policyGroup,
      policy_version: "2026-09-04",
    });
  }, [policy]);
  if (!policy) return <div className="min-h-screen bg-[#fbf8f2]"><Navbar /><main className="policy-shell"><p className="eyebrow">404 / Policy</p><h1 className="policy-title">That policy is not available.</h1><Link href="/policies" className="policy-back">Return to policies →</Link></main><SiteFooter /></div>;
  const index = policies.findIndex((item) => item.slug === policy.slug);
  const previous = policies[index - 1];
  const next = policies[index + 1];
  return <div className="min-h-screen bg-[#fbf8f2]"><Navbar /><main className="policy-detail">
     <Link href="/policies" className="policy-back">← All policies</Link>
     <header className="policy-detail__head"><p className="eyebrow">Afrolandx / Policy</p><h1 className="policy-title">{policy.title}</h1><p className="policy-intro">{policy.summary}</p><p className="policy-date">{policyDate}</p></header>
     <div className="policy-layout">
       <nav className="policy-toc" aria-label="On this page"><p className="policy-toc__label">On this page</p>{policy.sections.map((section, sectionIndex) => <a key={section.heading} href={`#section-${sectionIndex + 1}`}>{sectionIndex + 1}. {section.heading}</a>)}</nav>
       <div><article className="policy-article">{policy.sections.map((section, sectionIndex) => <section id={`section-${sectionIndex + 1}`} key={section.heading}><h2>{sectionIndex + 1}. {section.heading}</h2><p>{section.body}</p></section>)}</article>
       <p className="policy-contact">Questions? <a href="mailto:info@afrolandx.com">info@afrolandx.com</a></p>
        <address className="policy-contact not-italic"><strong>Company address:</strong> {COMPANY_ADDRESS}</address>
       <nav className="policy-related" aria-label="Related policies">{previous ? <Link href={`/policies/${previous.slug}`}>← {previous.title}</Link> : <span />}{next ? <Link href={`/policies/${next.slug}`}>{next.title} →</Link> : <span />}</nav></div>
     </div>
   </main><SiteFooter /></div>;
}