import { BookOpen, ExternalLink, MapPin, ShieldCheck } from "lucide-react";
import beninBronzes from "@assets/heritage/benin-bronzes.webp";
import crownDetail from "@assets/heritage/yoruba-crown-detail.webp";
import kenteWeaving from "@assets/heritage/kente-weaving.webp";
import dogonAncestor from "@assets/heritage/dogon-ancestor.webp";

type HeritageStory = {
  image: string;
  title: string;
  place: string;
  body: string;
  source: string;
  sourceUrl: string;
  wide?: boolean;
};

const stories: HeritageStory[] = [
  {
    image: beninBronzes,
    title: "The court in cast metal",
    place: "Benin City, present-day Nigeria",
    body: "Benin court artists developed the lost-wax process into a language of memory, rank, and ritual. These works belong to a historic royal tradition; they are shown here for learning, not sale.",
    source: "Wikimedia Commons · Benin bronzes documentation",
    sourceUrl: "https://commons.wikimedia.org/wiki/Category:Benin_bronzes",
    wide: true,
  },
  {
    image: crownDetail,
    title: "A crown detail, closely read",
    place: "Edo / Benin court context",
    body: "Ivory and coral court regalia carried layered ideas of authority and protection. This detail is associated with Iyoba court art; the available documentation does not establish Yoruba provenance.",
    source: "Wikimedia Commons · Benin ivory documentation",
    sourceUrl: "https://commons.wikimedia.org/wiki/Category:Benin_ivories",
  },
  {
    image: kenteWeaving,
    title: "The rhythm of narrow strips",
    place: "Northern Ghana",
    body: "Strip weaving turns colour, repetition, and patient handwork into cloth. Kente has many regional histories; this image records a weaving practice in northern Ghana rather than a product listing.",
    source: "Wikimedia Commons · Ghanaian textile documentation",
    sourceUrl: "https://commons.wikimedia.org/wiki/Category:Kente",
  },
  {
    image: dogonAncestor,
    title: "A figure for the ancestors",
    place: "Dogon region, Mali",
    body: "Dogon sculpture has been discussed in relation to lineage, memory, and ritual life. This museum-held figure is presented with care: its meaning belongs to the communities and histories that made it.",
    source: "Musée du Louvre · collections documentation",
    sourceUrl: "https://collections.louvre.fr/en/",
  },
];

export default function HeritageEditorial() {
  return (
    <section className="heritage-editorial" aria-labelledby="heritage-heading">
      <div className="heritage-editorial__intro">
        <div>
          <p className="heritage-kicker"><BookOpen size={15} /> Field notes · material heritage</p>
          <h2 id="heritage-heading">Before the marketplace, there is the making.</h2>
        </div>
        <p className="heritage-editorial__lede">
          AfrolandX is a marketplace for living makers. This small editorial archive gives context to the materials, techniques, and histories that deserve to be understood — without turning museum objects into inventory.
        </p>
      </div>
      <div className="heritage-notice">
        <ShieldCheck size={17} aria-hidden="true" />
        <span><strong>Editorial archive, not a shop.</strong> These images document heritage and museum collections. None of the objects shown here are for sale.</span>
      </div>
      <div className="heritage-grid">
        {stories.map((story, index) => (
          <article className={`heritage-card ${story.wide ? "heritage-card--wide" : ""}`} key={story.title}>
            <div className="heritage-card__image-wrap">
              <img src={story.image} alt={`${story.title}, ${story.place}`} loading={index === 0 ? "eager" : "lazy"} decoding="async" />
              <span className="heritage-card__index">0{index + 1}</span>
            </div>
            <div className="heritage-card__body">
              <p className="heritage-card__place"><MapPin size={13} /> {story.place}</p>
              <h3>{story.title}</h3>
              <p className="heritage-card__copy">{story.body}</p>
              <a href={story.sourceUrl} target="_blank" rel="noreferrer" className="heritage-card__source">
                Source: {story.source} <ExternalLink size={13} />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}