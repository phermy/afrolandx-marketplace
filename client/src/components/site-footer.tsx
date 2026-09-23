import { Link } from "wouter";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

type Mood = "sad" | "indifferent" | "happy";

const moods: Array<{ value: Mood; face: string; label: string }> = [
  { value: "sad", face: "😢", label: "Sad" },
  { value: "indifferent", face: "😐", label: "Indifferent" },
  { value: "happy", face: "😊", label: "Happy" },
];

export default function SiteFooter() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const { isAuthenticated } = useAuth();
  const [mood, setMood] = useState<Mood | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mood || status === "submitting") return;

    setStatus("submitting");
    try {
      await apiRequest("POST", "/api/experience-feedback", {
        mood,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        pagePath: window.location.pathname,
      });
      setStatus("success");
      setComment("");
    } catch {
      setStatus("error");
    }
  }

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
          <Link href="/policies/marketplace-terms">Marketplace Terms</Link>
          <Link href="/policies/privacy-and-cookie-policy">Privacy</Link>
          <Link href="/policies/shipping-policy">Shipping information</Link>
          <Link href="/policies/return-policy">Returns</Link>
          <Link href="/policies/complaints-and-dispute-resolution">Complaints</Link>
          <a href="mailto:support@afrolandx.com">Contact support</a>
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
      <section className="experience-feedback" aria-labelledby="experience-feedback-title">
        <div className="experience-feedback__copy">
          <p id="experience-feedback-title" className="site-footer__label">A small check-in</p>
          <p>
            <strong>How does Afrolandx feel today?</strong>
            Your honest first impression helps us make this corner of Africa feel more welcoming.
          </p>
        </div>
        <form className="experience-feedback__form" onSubmit={handleSubmit}>
          <fieldset disabled={status === "submitting" || status === "success"}>
            <legend className="sr-only">Choose how Afrolandx feels</legend>
            <div className="experience-feedback__moods">
              {moods.map((item) => (
                <label
                  key={item.value}
                  className={`experience-feedback__mood ${mood === item.value ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="experience-mood"
                    value={item.value}
                    checked={mood === item.value}
                    onChange={() => {
                      setMood(item.value);
                      if (status !== "idle") setStatus("idle");
                    }}
                  />
                  <span aria-hidden="true" className="experience-feedback__face">{item.face}</span>
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <div className="experience-feedback__entry">
              <label htmlFor="experience-comment" className="sr-only">Optional short note</label>
              <input
                id="experience-comment"
                type="text"
                maxLength={240}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="A short note, if you’d like"
              />
              <button type="submit" disabled={!mood}>
                {status === "submitting" ? "Sending…" : "Submit feedback"}
              </button>
            </div>
          </fieldset>
          <p className="experience-feedback__message" role="status" aria-live="polite">
            {status === "success" && "Thank you for sharing how it feels."}
            {status === "error" && "We couldn’t save that just now. Please try again."}
          </p>
        </form>
      </section>
      <div className="site-footer__bottom">
        <span>© {year} Afrolandx</span>
        <Link href="/policies">Trust centre</Link>
      </div>
    </footer>
  );
}