import { Link } from "wouter";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function SiteFooter() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const { isAuthenticated } = useAuth();
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
          <Link href="/rides/help-safety">Rides Help & Safety</Link>
          <Link href="/policies/marketplace-terms">Marketplace Terms</Link>
          <Link href="/policies/privacy-and-cookie-policy">Privacy</Link>
          <Link href="/policies/shipping-policy">Shipping information</Link>
          <Link href="/policies/return-policy">Returns</Link>
          <Link href="/policies/complaints-and-dispute-resolution">Complaints</Link>
          <a href="mailto:info@afrolandx.com">Contact support</a>
        </div>
        <div>
          <p className="site-footer__label">Vendor resources</p>
          <Link href={isAuthenticated ? "/vendor" : "/register"}>
            {isAuthenticated ? "Vendor dashboard" : "Become a vendor"}
          </Link>
          <Link href="/policies/vendor-onboarding-data-and-account-security">Onboarding & security</Link>
          <Link href="/policies/vendor-orders-shipping-returns-and-settlement">Vendor operations</Link>
        </div>
        <div>
          <p className="site-footer__label">Delivery partners</p>
          <ul className="site-footer__list" aria-label="Delivery partners">
            <li>UPS</li>
            <li>FedEx</li>
            <li>DHL</li>
            <li>CargoNaija</li>
            <li>Terminal Africa</li>
            <li>Haulam</li>
            <li>African Import Export Solutions</li>
            <li>Hezelinks</li>
          </ul>
        </div>
        <div>
          <p className="site-footer__label">Legal / Policies</p>
          <Link href="/policies">All policies</Link>
          <span className="site-footer__meta">Effective dates and policy updates are shown on each document.</span>
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>© {year} Afrolandx</span>
        <Link href="/policies">Trust centre</Link>
      </div>
    </footer>
  );
}