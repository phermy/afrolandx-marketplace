import helenPortrait from "@assets/WhatsApp_Image_2026-09-21_at_9.51.03_AM_1790170887996.jpeg";

export default function ResearchLeadProfile() {
  return (
    <article
      aria-labelledby="research-lead-name"
      className="mt-6 overflow-hidden rounded-3xl border border-[#e7e4d9] bg-white shadow-sm"
    >
      <div className="grid md:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.5fr)]">
        <div className="bg-[#e9ede8]">
          <img
            src={helenPortrait}
            alt="Portrait of Dr Helen Oni"
            loading="lazy"
            decoding="async"
            className="h-72 w-full object-cover object-top sm:h-96 md:h-full md:min-h-[440px]"
          />
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#1a5c2a]">
            Meet our co-founder
          </p>
          <h3 id="research-lead-name" className="font-nigerian text-2xl font-bold text-gray-900 sm:text-3xl">
            Dr Helen Oni
          </h3>
          <p className="mt-2 text-sm font-medium text-[#315d3a]">
            Co-Founder &amp; Head of Research, Policy &amp; Strategy, Afrolandx
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-gray-600 sm:text-base">
            <p>
              Helen leads research, policy development and strategic planning across
              the marketplace, including vendor onboarding, customer protection,
              payments, logistics and international market opportunities.
            </p>
            <p>
              Drawing on her experience in research, evaluation, project management
              and business operations, she translates evidence and market insights
              into practical strategies that support African vendors and connect
              their products with customers worldwide.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}