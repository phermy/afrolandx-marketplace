import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle, ArrowRight, CarFront, Check, ChevronDown, CircleHelp,
  ClipboardList, CreditCard, ExternalLink, FileWarning, Headphones,
  LockKeyhole, MapPin, Search, ShieldCheck, Smartphone, UserRound,
} from "lucide-react";
import Navbar from "@/components/navbar";
import SiteFooter from "@/components/site-footer";

type Topic = { title: string; text: string; tags: string[]; icon: typeof CarFront };

const topics: Topic[] = [
  { title: "Trip issues", text: "Driver or rider did not arrive, pickup or destination changes, navigation, cancellations, unauthorised trips and fare calculations.", tags: ["trip", "booking", "fare", "cancel"], icon: CarFront },
  { title: "Payment & fare", text: "Incorrect fares, payment failures, duplicate charges, unauthorised payments, refunds, promos and balance questions.", tags: ["payment", "fare", "refund", "wallet"], icon: CreditCard },
  { title: "Account & login", text: "Sign-in, password, phone or email changes, verification, restrictions, duplicate accounts and account security.", tags: ["account", "login", "verification"], icon: UserRound },
  { title: "Driver support", text: "Registration, driver and vehicle verification, documents, activation, earnings, settlements, app problems and safety incidents.", tags: ["driver", "vehicle", "earnings"], icon: ClipboardList },
  { title: "Rider support", text: "Booking, driver verification, payment, trip problems, lost property, complaints, account problems and safety concerns.", tags: ["rider", "booking", "lost"], icon: Smartphone },
  { title: "Lost property", text: "Report an item through the relevant completed trip with the trip reference, description, approximate location and preferred contact method.", tags: ["lost", "item", "completed trip"], icon: MapPin },
];

const safetySteps = [
  ["Before", "Check the driver name, profile photo, vehicle make and model, and registration or plate number against the app. Do not enter if they do not match."],
  ["During", "Use the active-trip Safety Center for urgent safety concerns. Where available, use trip sharing, driver or rider information, vehicle details and safety tools."],
  ["After", "Use completed trip history to report a concern or lost item. Ratings and reports can help distinguish safety feedback from ordinary service quality issues."],
];

const seriousIncidents = ["Physical assault", "Sexual misconduct", "Threats of violence", "Robbery", "Kidnapping or attempted kidnapping", "Dangerous driving", "Serious accident", "Weapon-related threats", "Unauthorised account use"];

export default function RidesHelpSafety() {
  const [query, setQuery] = useState("");
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((topic) => !q || `${topic.title} ${topic.text} ${topic.tags.join(" ")}`.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="rides-help-page">
      <Navbar />
      <main>
        <section className="rides-hero">
          <div className="rides-hero__inner">
            <div className="rides-breadcrumb"><Link href="/">Afrolandx</Link><span>/</span><span>Rides</span><span>/</span><strong>Help & Safety</strong></div>
            <div className="rides-hero__copy">
              <p className="rides-kicker"><ShieldCheck size={16} /> AfrolandX Rides support</p>
              <h1>Help when the road<br /><em>gets complicated.</em></h1>
              <p className="rides-lede">Clear answers for riders and drivers, from a missed pickup to a serious safety concern. Find the right next step without the runaround.</p>
              <div className="rides-search">
                <Search size={20} aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trips, payments, lost items…" aria-label="Search help topics" />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">Clear</button>}
              </div>
              <p className="rides-search-hint">Try “lost item”, “duplicate charge” or “driver verification”.</p>
            </div>
            <div className="rides-hero__signal" aria-hidden="true"><span>R</span><span>I</span><span>D</span><span>E</span><span>S</span><b>01</b></div>
          </div>
        </section>

        <section className="rides-emergency" aria-labelledby="emergency-heading">
          <div className="rides-emergency__mark"><AlertTriangle size={23} /></div>
          <div><p className="rides-kicker">Immediate danger</p><h2 id="emergency-heading">Contact local emergency services first.</h2><p>AfrolandX Rides is not a substitute for local emergency services. If your life, health or physical safety is at risk, get immediate help from the appropriate local emergency service.</p></div>
          <div className="rides-emergency__actions"><a className="rides-button rides-button--light" href="tel:+2347082427348">Safety assistance <ArrowRight size={16} /></a><span>+234 708 242 7348</span></div>
        </section>

        <div className="rides-content-shell">
          <aside className="rides-toc" aria-label="Help page sections">
            <p>On this page</p>
            <a href="#quick-start">Quick start</a><a href="#safety">Safety, step by step</a><a href="#report">Report a concern</a><a href="#roles">For riders & drivers</a><a href="#community">Community standards</a><a href="#privacy">Privacy & support</a>
          </aside>
          <div className="rides-main">
            <section id="quick-start" className="rides-section rides-quick">
              <div className="rides-section-heading"><div><p className="rides-kicker">Start here</p><h2>Find your next move.</h2></div><span className="rides-section-number">01 / 06</span></div>
              <div className="rides-channel-grid">
                <a href="#report" className="rides-channel rides-channel--dark"><span className="rides-channel-icon"><Headphones size={20} /></span><div><h3>In-app Help & Support</h3><p>For bookings, payments, account access, technical problems and non-emergency issues.</p></div><ArrowRight size={18} /></a>
                <a href="#safety" className="rides-channel"><span className="rides-channel-icon"><ShieldCheck size={20} /></span><div><h3>Active-trip Safety Center</h3><p>For urgent safety concerns during a current trip. Keep critical tools close at hand.</p></div><ArrowRight size={18} /></a>
                <a href="#lost-property" className="rides-channel"><span className="rides-channel-icon"><MapPin size={20} /></span><div><h3>Completed trip history</h3><p>Report a lost item or follow up on a trip after it has ended.</p></div><ArrowRight size={18} /></a>
              </div>
            </section>

            <section className="rides-section" aria-labelledby="topics-heading">
              <div className="rides-section-heading"><div><p className="rides-kicker">Browse support</p><h2 id="topics-heading">What can we help with?</h2></div><span className="rides-result-count">{filtered.length} topics</span></div>
              {filtered.length === 0 ? <div className="rides-empty"><CircleHelp size={24} /><h3>No close match yet.</h3><p>Try a broader search, or use In-app Help & Support to describe what happened.</p></div> :
                <div className="rides-topic-list">{filtered.map((topic) => { const Icon = topic.icon; const open = openTopic === topic.title; return <div className={`rides-topic ${open ? "is-open" : ""}`} key={topic.title}><button onClick={() => setOpenTopic(open ? null : topic.title)} aria-expanded={open}><span className="rides-topic__icon"><Icon size={19} /></span><span><strong>{topic.title}</strong><small>{topic.text}</small></span><ChevronDown size={19} /></button>{open && <div className="rides-topic__details"><p>Use the <strong>AfrolandX Rides Help & Support</strong> section in the app menu, current trip screen, completed trip history or your account area, depending on the issue.</p><span>{topic.tags.map((tag) => <i key={tag}>{tag}</i>)}</span></div>}</div>; })}</div>}
            </section>

            <section id="safety" className="rides-section rides-safety-section">
              <div className="rides-section-heading"><div><p className="rides-kicker">A calmer journey</p><h2>Safety, step by step.</h2></div><span className="rides-section-number">02 / 06</span></div>
              <div className="rides-steps">{safetySteps.map(([title, text], i) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
              <div className="rides-safety-note"><ShieldCheck size={19} /><p><strong>Safety tools may vary.</strong> Features can depend on your country, city, technology availability and applicable laws. Use the Safety Center from the active trip screen when it is available.</p></div>
            </section>

            <section id="report" className="rides-section rides-report">
              <div className="rides-section-heading"><div><p className="rides-kicker">If something happens</p><h2>Report with the details you have.</h2></div><span className="rides-section-number">03 / 06</span></div>
              <p className="rides-copy">For non-emergency issues, use in-app Help & Support. For urgent safety concerns, use the Safety Center and SOS/Emergency feature where available. Include the trip ID, location and a clear description. For an accident, add the date and time, injuries, vehicle information and photographs only if it is safe to do so.</p>
              <div className="rides-report-grid"><div><FileWarning size={20} /><h3>Serious safety incidents</h3><p>Report immediately. If there is immediate danger, contact the appropriate emergency authority first.</p><ul>{seriousIncidents.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul></div><div id="lost-property"><MapPin size={20} /><h3>Lost property</h3><p>Report it through the relevant completed trip. Share the trip reference, item description, approximate location and preferred contact method. Do not confront or locate another user independently.</p></div></div>
            </section>

            <section id="roles" className="rides-section rides-roles">
              <div className="rides-section-heading"><div><p className="rides-kicker">For every seat</p><h2>Different roles. Shared care.</h2></div><span className="rides-section-number">04 / 06</span></div>
              <div className="rides-role-columns"><div><p className="rides-role-label">Riders</p><h3>Before you get in</h3><p>Match the driver, photo, vehicle and registration details shown in the app. Choose a visible pickup location where possible, and avoid stopping in moving traffic or isolated places when a safer alternative exists.</p></div><div><p className="rides-role-label">Drivers</p><h3>Ready to drive safely</h3><p>Follow traffic laws, use seat belts, avoid distraction and impairment, keep a reasonable speed, maintain the vehicle and take a safe break when tired. Never allow another person to operate your driver account.</p></div></div>
            </section>

            <section id="community" className="rides-section">
              <div className="rides-section-heading"><div><p className="rides-kicker">How we share the road</p><h2>Respect is a safety feature.</h2></div><span className="rides-section-number">05 / 06</span></div>
              <div className="rides-community"><p>AfrolandX Rides does not tolerate harassment, threats, sexual harassment or misconduct, physical violence, discrimination, intimidation, stalking, unwanted contact or abusive behaviour. Do not use the platform for illegal activities, weapons or controlled substances.</p><p>Concerns about another rider or driver can be reported. Depending on the circumstances, AfrolandX Rides may request information, review trip or verification details, restrict or suspend an account, deactivate it, or refer matters to appropriate authorities where legally required or appropriate.</p></div>
            </section>

            <section id="privacy" className="rides-section rides-privacy">
              <div className="rides-section-heading"><div><p className="rides-kicker">Trust and discretion</p><h2>Support without oversharing.</h2></div><span className="rides-section-number">06 / 06</span></div>
              <div className="rides-privacy-grid"><LockKeyhole size={22} /><div><p>Support information is handled under applicable laws and the <Link href="/policies/privacy-and-cookie-policy">Privacy Policy</Link>. Avoid adding sensitive personal information unnecessarily. Where possible, use AfrolandX Rides systems rather than exposing private phone numbers.</p><p>Support availability and response times may vary by issue type and severity. Urgent safety reports should receive priority over ordinary customer-service requests.</p></div></div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}