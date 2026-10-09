import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Mail, MessageCircle, Ruler, PackageCheck, RotateCcw, CircleHelp } from "lucide-react";
import Navbar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";
import { policies } from "@/lib/policies";
import { SUPPORT_HOURS } from "@shared/customer-support";
import { faqItems } from "@shared/support-faq";

function SupportLayout({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <div className="min-h-screen bg-[#fbf8f2]"><Navbar />
    <main className="policy-shell support-page">
      <p className="eyebrow">Afrolandx / {eyebrow}</p>
      <h1 className="policy-title">{title}</h1>
      <p className="policy-intro">{intro}</p>
      {children}
    </main>
    <SiteFooter />
  </div>;
}

function PolicyContent({ slug }: { slug: string }) {
  const policy = policies.find((item) => item.slug === slug);
  if (!policy) return null;
  return <div className="policy-article support-policy">
    {policy.sections.map((section) => <section key={section.heading}>
      <h2>{section.heading}</h2><p>{section.body}</p>
    </section>)}
  </div>;
}

export function ContactPage() {
  return <SupportLayout eyebrow="Contact" title="Talk to a real person about your order." intro="Questions about a product, payment, delivery or return? Choose the contact that fits your question and include your order number when you have one.">
    <div className="support-contact-grid">
      <a className="support-contact-card" href="mailto:support@afrolandx.com">
        <span className="support-icon"><Mail aria-hidden="true" /></span>
        <span className="support-card-label">Email support</span>
        <strong>support@afrolandx.com</strong>
        <span>For order, account and marketplace questions</span>
      </a>
      <a className="support-contact-card" href="https://wa.me/2347082427348" target="_blank" rel="noreferrer">
        <span className="support-icon"><MessageCircle aria-hidden="true" /></span>
        <span className="support-card-label">WhatsApp</span>
        <strong>+234 708 242 7348</strong>
        <span>Open a WhatsApp conversation</span>
      </a>
      <a className="support-contact-card" href="mailto:payments@afrolandx.com">
        <span className="support-icon"><CircleHelp aria-hidden="true" /></span>
        <span className="support-card-label">Payment questions</span>
        <strong>payments@afrolandx.com</strong>
        <span>Include the order or transaction reference</span>
      </a>
    </div>
    <section className="support-callout" aria-labelledby="support-hours-title">
      <h2 id="support-hours-title" className="font-semibold">Customer support hours</h2>
      <p>{SUPPORT_HOURS}.</p>
      <p>You can send an email or WhatsApp message outside these hours. Our support team responds during support hours.</p>
    </section>
    <p className="support-note">Never send a password, card security code or full bank account details by email or WhatsApp.</p>
    <div className="support-next-links"><Link href="/faq">Browse common questions <ArrowRight aria-hidden="true" /></Link><Link href="/policies">Visit the trust centre <ArrowRight aria-hidden="true" /></Link></div>
  </SupportLayout>;
}

export function FaqPage() {
  return <SupportLayout eyebrow="Help / FAQ" title="Good questions, clear answers." intro="A practical guide to buying from independent makers on Afrolandx. For the full conditions, read the linked policy or contact support.">
    <div className="support-faq-list">{faqItems.map((item, index) => <details className="support-faq-item" key={item.q} open={index === 0}>
      <summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p>
    </details>)}</div>
    <div className="support-callout"><strong>Still unsure before you buy?</strong><p>Ask us before checkout. We can help you find the right listing or policy.</p><Link href="/contact">Contact support <ArrowRight aria-hidden="true" /></Link></div>
  </SupportLayout>;
}

export function SizeGuidePage() {
  return <SupportLayout eyebrow="Buying guide / Size" title="Measure the garment, not the label." intro="Independent makers may use different sizing conventions. Treat each listing’s stated measurements and fit notes as specific to that product and vendor.">
    <div className="support-measure-intro"><Ruler aria-hidden="true" /><div><strong>Use centimetres (cm)</strong><p>Lay a similar garment flat on a firm surface, smooth it without stretching, and measure with a flexible tape. Compare like with like: a flat garment measurement is not the same as a body measurement.</p></div></div>
    <div className="support-measure-grid">
      <section><span className="support-step">01</span><h2>Take your body measurements</h2><ul><li><strong>Bust / chest:</strong> measure around the fullest part, tape level and comfortably close.</li><li><strong>Waist:</strong> measure around your natural waist without pulling the tape tight.</li><li><strong>Hip:</strong> measure around the fullest part of your hips and seat.</li><li><strong>Shoulder:</strong> measure from shoulder point to shoulder point across the back.</li><li><strong>Sleeve:</strong> measure from the shoulder point to the wrist with your arm relaxed.</li></ul></section>
      <section><span className="support-step">02</span><h2>Measure a garment that fits</h2><ul><li><strong>Chest width:</strong> lay flat and measure straight across underarm to underarm.</li><li><strong>Waist / hip width:</strong> measure straight across at the garment’s corresponding seam or widest point.</li><li><strong>Length:</strong> measure from the shoulder or waistband to the hem, as appropriate.</li><li><strong>Rise / inseam:</strong> for trousers, follow the listing’s stated start and end points.</li></ul></section>
    </div>
    <p className="support-note">A flat width is not a circumference; doubling it is only a rough comparison and may not account for ease, stretch, cut or construction. Follow the measurement method shown by the vendor. No size label or measurement guarantees a particular fit.</p>
    <div className="support-next-links"><Link href="/products">Browse product listings <ArrowRight aria-hidden="true" /></Link><Link href="/contact">Ask us about a measurement <ArrowRight aria-hidden="true" /></Link></div>
  </SupportLayout>;
}

export function ShippingInformationPage() {
  return <SupportLayout eyebrow="Buying guide / Delivery" title="Shipping, explained before it moves." intro="Orders are prepared by independent vendors. Handling time is shown on the listing; delivery timing depends on the order and destination.">
    <div className="support-policy-lead"><PackageCheck aria-hidden="true" /><p>Check the listing for its handling time and the checkout for the information available for your destination. Delivery estimates can vary with verification, carrier, customs and events outside Afrolandx’s control.</p></div>
    <PolicyContent slug="shipping-policy" />
    <div className="support-next-links"><Link href="/policies/shipping-policy">Read the full Shipping Policy <ArrowRight aria-hidden="true" /></Link><Link href="/contact">Report an order issue <ArrowRight aria-hidden="true" /></Link></div>
  </SupportLayout>;
}

export function ReturnsPage() {
  return <SupportLayout eyebrow="Buying guide / Returns" title="Know the return terms before checkout." intro="Return eligibility is shown on each product listing. Start with the order page and wait for the instructions specific to your return before shipping an item.">
    <div className="support-policy-lead"><RotateCcw aria-hidden="true" /><p>Open your order and select “Request a return”, or contact support with the order number and reason. Do not send an item back until you have received the return instructions for that order.</p></div>
    <PolicyContent slug="return-policy" />
    <div className="support-callout"><strong>Questions about payment or refund processing?</strong><p>For help with the status of an approved refund, contact <a href="mailto:payments@afrolandx.com">payments@afrolandx.com</a> with your order or transaction reference.</p></div>
    <div className="support-next-links"><Link href="/policies/return-policy">Read the full Return Policy <ArrowRight aria-hidden="true" /></Link><Link href="/contact">Contact support <ArrowRight aria-hidden="true" /></Link></div>
  </SupportLayout>;
}
