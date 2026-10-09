import { Link } from "wouter";
import Navbar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";
import { policies } from "@/lib/policies";

export default function Policies() {
  const groups = [
    { label: "Customer policies", description: "For buying, receiving, returning and reviewing an order.", slugs: ["marketplace-terms", "privacy-and-cookie-policy", "shipping-policy", "return-policy", "complaints-and-dispute-resolution", "reviews-and-ratings", "promotions-and-vouchers"] },
    { label: "Marketplace standards", description: "The shared rules for safe, accurate marketplace activity.", slugs: ["prohibited-and-restricted-products", "product-listing-and-marketplace-standards"] },
    { label: "Vendor policies", description: "Operational guidance for independent vendors on Afrolandx.", slugs: ["vendor-agreement-and-code-of-conduct", "vendor-onboarding-data-and-account-security", "vendor-orders-shipping-returns-and-settlement"] },
  ];
  return <div className="min-h-screen bg-[#fbf8f2]"><Navbar />
    <main className="policy-shell">
      <p className="eyebrow">Afrolandx / Trust centre</p>
      <h1 className="policy-title">Clear rules for a considered marketplace.</h1>
      <p className="policy-intro">A practical directory of the policies that guide customers, independent vendors and Afrolandx. Start with the group that matches your role.</p>
      <p className="policy-date">Effective dates and updates are shown on each policy.</p>
      <div className="policy-notice"><strong>Looking for refunds?</strong> Refunds are handled under the <Link href="/policies/return-policy">Return Policy</Link> and <Link href="/policies/complaints-and-dispute-resolution">Complaints Policy</Link> until an approved standalone Refund Policy is published.</div>
      <div className="policy-notice"><strong>Need a buying answer?</strong> <Link href="/faq">Browse FAQs</Link>, <Link href="/size-guide">check the size guide</Link>, read <Link href="/shipping-information">shipping information</Link>, or see <Link href="/returns">how returns work</Link>. For help, <Link href="/contact">contact support</Link>.</div>
      {groups.map((group) => <section className="policy-group" key={group.label}>
        <div className="policy-group__heading"><span>{group.label}</span><div>{group.description}</div></div>
        <div className="policy-grid">{group.slugs.map((slug) => {
          const policy = policies.find((item) => item.slug === slug);
          if (!policy) return null;
          return <Link key={policy.slug} href={`/policies/${policy.slug}`} className="policy-card">
            <span className="policy-card__arrow" aria-hidden="true">↗</span><h2>{policy.title}</h2><p>{policy.summary}</p><span className="policy-card__read">Read policy</span>
          </Link>;
        })}</div>
      </section>)}
    </main><SiteFooter />
  </div>;
}