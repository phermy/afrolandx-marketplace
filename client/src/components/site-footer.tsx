import { Link } from "wouter";
import { useMemo } from "react";
import { policies } from "@/lib/policies";

export default function SiteFooter() {
  const year = useMemo(() => new Date().getFullYear(), []);
  return (
    <footer id="site-footer" className="site-footer">
      <div className="site-footer__inner">
        <div>
          <Link href="/" className="site-footer__brand">Afrolandx</Link>
          <p className="site-footer__tagline">African stories, made tangible.</p>
          <p className="site-footer__meta">CAC REG: 7039498</p>
          <a className="site-footer__email" href="mailto:info@afrolandx.com">info@afrolandx.com</a>
        </div>
        <div>
          <p className="site-footer__label">Company</p>
          <Link href="/products">Shop products</Link>
          <Link href="/discover">Discover Africa</Link>
          <Link href="/lookbook">Lookbook</Link>
        </div>
        <div>
          <p className="site-footer__label">Help and support</p>
          <Link href="/policies/shipping-policy">Shipping information</Link>
          <Link href="/policies/return-policy">Returns</Link>
          <a href="mailto:info@afrolandx.com">Contact support</a>
        </div>
        <div>
          <p className="site-footer__label">Vendor resources</p>
          <Link href="/register">Become a vendor</Link>
          <Link href="/policies/vendor-onboarding-data-and-account-security">Onboarding & security</Link>
          <Link href="/policies/vendor-orders-shipping-returns-and-settlement">Vendor operations</Link>
        </div>
        <div>
          <p className="site-footer__label">Legal / Policies</p>
          <Link href="/policies">All policies</Link>
          {policies.slice(0, 5).map((policy) => <Link key={policy.slug} href={`/policies/${policy.slug}`}>{policy.title}</Link>)}
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>© {year} Afrolandx</span>
        <Link href="/policies">Terms, privacy & marketplace standards</Link>
      </div>
    </footer>
  );
}