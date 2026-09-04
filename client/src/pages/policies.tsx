import { Link } from "wouter";
import Navbar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";
import { policies, policyDate } from "@/lib/policies";

export default function Policies() {
  return <div className="min-h-screen bg-[#fbf8f2]"><Navbar />
    <main className="policy-shell">
      <p className="eyebrow">Afrolandx / Trust centre</p>
      <h1 className="policy-title">Policies that keep the marketplace clear.</h1>
      <p className="policy-intro">Plain-language guidance for customers, vendors and everyone who helps Afrolandx move culture with care.</p>
      <p className="policy-date">{policyDate}</p>
      <div className="policy-grid">{policies.map((policy) => <Link key={policy.slug} href={`/policies/${policy.slug}`} className="policy-card">
        <span className="policy-card__arrow">↗</span><h2>{policy.title}</h2><p>{policy.summary}</p><span className="policy-card__read">Read policy</span>
      </Link>)}</div>
    </main><SiteFooter />
  </div>;
}