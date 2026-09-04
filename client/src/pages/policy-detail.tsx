import { Link, useParams } from "wouter";
import Navbar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";
import { policies, policyDate } from "@/lib/policies";

export default function PolicyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const policy = policies.find((item) => item.slug === slug);
  if (!policy) return <div className="min-h-screen bg-[#fbf8f2]"><Navbar /><main className="policy-shell"><p className="eyebrow">404 / Policy</p><h1 className="policy-title">That policy is not available.</h1><Link href="/policies" className="policy-back">Return to policies →</Link></main><SiteFooter /></div>;
  return <div className="min-h-screen bg-[#fbf8f2]"><Navbar /><main className="policy-detail">
    <Link href="/policies" className="policy-back">← All policies</Link><p className="eyebrow">Afrolandx / Policy</p><h1 className="policy-title">{policy.title}</h1><p className="policy-intro">{policy.summary}</p><p className="policy-date">{policyDate}</p>
    <article className="policy-article">{policy.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></section>)}</article>
    <p className="policy-contact">Questions? <a href="mailto:info@afrolandx.com">info@afrolandx.com</a></p>
  </main><SiteFooter /></div>;
}