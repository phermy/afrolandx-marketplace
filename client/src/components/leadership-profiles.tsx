import genesisPortrait from "@assets/WhatsApp_Image_2026-09-23_at_2.00.25_PM_1790170453875.jpeg";
import helenPortrait from "@assets/WhatsApp_Image_2026-09-21_at_9.51.03_AM_1790170887996.jpeg";
import femiPortrait from "@assets/femi-elegbeleye-original-blue-suit-card-v2.webp";

type Leader =
  | {
      kind: "profile";
      id: string;
      name: string;
      label: string;
      role: string;
      portrait: string;
      imagePosition: string;
      bio: string[];
    }
  | { kind: "name-only"; id: string; name: string };

const leaders: Leader[] = [
  {
    kind: "profile",
    id: "femi-elegbeleye",
    name: "Dr. Femi A. Elegbeleye",
    label: "Co-founder",
    role: "Co-Founder & Lead Senior Software Engineer",
    portrait: femiPortrait,
    imagePosition: "center",
    bio: [
      "Femi leads the design, development and technical strategy of Afrolandx’s digital platforms, including the marketplace and Afrolandx Rides. His research spans Artificial Intelligence, Machine Learning, Cybersecurity, IoT, Blockchain, Trustworthy AI and intelligent software systems.",
      "Drawing on software engineering, academic research and technology development, he builds secure, scalable platforms that support African businesses and cross-border commerce. He focuses on translating research and innovation into practical solutions for Africa’s digital economy.",
    ],
  },
  { kind: "name-only", id: "babajide-omojowo", name: "Mr. Babajide Omojowo" },
  {
    kind: "profile",
    id: "helen-oni",
    name: "Dr. Helen Oni",
    label: "Co-founder",
    role: "Co-Founder & Head of Research, Policy & Strategy",
    portrait: helenPortrait,
    imagePosition: "center 22%",
    bio: [
      "Helen leads research, policy development and strategic planning across the marketplace, including vendor onboarding, customer protection, payments, logistics and international market opportunities.",
      "Drawing on her experience in research, evaluation, project management and business operations, she translates evidence and market insights into practical strategies that support African vendors and connect their products with customers worldwide.",
    ],
  },
  { kind: "name-only", id: "nathan-chibuike", name: "Mr. Nathan C. Chibuike" },
  {
    kind: "profile",
    id: "genesis-francis",
    name: "Genesis Francis Esq.",
    label: "Legal lead",
    role: "Legal Lead · Notary Public",
    portrait: genesisPortrait,
    imagePosition: "center 28%",
    bio: [
      "Genesis is a Nigerian legal practitioner with more than 14 years of post-call experience across litigation, corporate and commercial law, regulatory compliance, and legal advisory services.",
      "He is the Principal Partner and Co-Founder of Hilltop Attorneys, where he leads the firm’s Nigerian office. His work includes corporate governance, commercial agreements, dispute resolution, and advising organisations on complex legal and business matters.",
      "Appointed a Notary Public in 2022, Genesis also serves as National Director of the Directorate of Anti-Corruption, Rule of Law and Good Governance at the Christian Lawyers Fellowship of Nigeria (CLASFON).",
    ],
  },
];

export default function LeadershipProfiles() {
  return (
    <section aria-labelledby="leadership-title" className="mt-12 md:mt-16">
      <div className="mb-6 md:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1a5c2a]">Our people</p>
        <h3 id="leadership-title" className="mt-2 font-nigerian text-2xl font-bold text-gray-900 sm:text-3xl">
          Meet the team behind Afrolandx
        </h3>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {leaders.map((leader, index) => (
          <li key={leader.id} className="flex items-center gap-4 rounded-xl border border-[#e7e4d9] bg-white p-4 shadow-sm">
            <span aria-hidden="true" className="font-nigerian text-lg font-bold text-[#1a5c2a]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-nigerian font-semibold leading-snug text-gray-900">{leader.name}</span>
          </li>
        ))}
      </ol>
      <div className="mt-10 md:mt-12">
        <h4 className="mb-5 font-nigerian text-xl font-bold text-gray-900">Team profiles</h4>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {leaders.filter((leader): leader is Extract<Leader, { kind: "profile" }> => leader.kind === "profile").map((leader) => (
            <article
              key={leader.id}
              aria-labelledby={`${leader.id}-name`}
              className="overflow-hidden rounded-2xl border border-[#e7e4d9] bg-white shadow-sm"
            >
              <div className="h-52 overflow-hidden bg-[#e9ede8] sm:h-56">
                <img
                  src={leader.portrait}
                  alt={`Portrait of ${leader.name}`}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: leader.imagePosition }}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1a5c2a]">
                  {leader.label}
                </p>
                <h5 id={`${leader.id}-name`} className="mt-2 font-nigerian text-xl font-bold leading-tight text-gray-900">
                  {leader.name}
                </h5>
                <p className="mt-2 text-sm font-medium leading-snug text-[#315d3a]">{leader.role}</p>
                <div className="mt-5 space-y-3 text-sm leading-6 text-gray-600">
                  {leader.bio.map((paragraph) => <p key={paragraph} className="reading-copy">{paragraph}</p>)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}