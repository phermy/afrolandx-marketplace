const FALLBACK = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/320px-No_image_available.svg.png";

export interface Leader {
  url: string;
  name: string;
  title: string;
  country: string;
  era: string;
}

export const AFRICAN_LEADERS: Leader[] = [
  /* ── WEST AFRICA ───────────────────────────────────────── */
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Nnamdi_Azikiwe.jpg/400px-Nnamdi_Azikiwe.jpg",
    name: "Nnamdi Azikiwe",
    title: "First President",
    country: "Nigeria",
    era: "1963–1966",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/en/thumb/d/d5/Chief_Obafemi_Awolowo.jpg/400px-Chief_Obafemi_Awolowo.jpg",
    name: "Obafemi Awolowo",
    title: "Statesman & Premier",
    country: "Nigeria",
    era: "1952–1983",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Ahmadu_Bello.jpg/400px-Ahmadu_Bello.jpg",
    name: "Ahmadu Bello",
    title: "Premier of the North",
    country: "Nigeria",
    era: "1954–1966",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Kwame_Nkrumah.jpg/400px-Kwame_Nkrumah.jpg",
    name: "Kwame Nkrumah",
    title: "First President",
    country: "Ghana",
    era: "1960–1966",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Am%C3%ADlcar_Cabral.jpg/400px-Am%C3%ADlcar_Cabral.jpg",
    name: "Amilcar Cabral",
    title: "Liberation Leader",
    country: "Guinea-Bissau",
    era: "1956–1973",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Sekou_Toure.jpg/400px-Sekou_Toure.jpg",
    name: "Ahmed Sékou Touré",
    title: "First President",
    country: "Guinea",
    era: "1958–1984",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/L%C3%A9opold_S%C3%A9dar_Senghor.jpg/400px-L%C3%A9opold_S%C3%A9dar_Senghor.jpg",
    name: "Léopold Sédar Senghor",
    title: "First President & Poet",
    country: "Senegal",
    era: "1960–1980",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Thomas_Sankara.jpg/400px-Thomas_Sankara.jpg",
    name: "Thomas Sankara",
    title: "Revolutionary President",
    country: "Burkina Faso",
    era: "1983–1987",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Modibo_Keita.jpg/400px-Modibo_Keita.jpg",
    name: "Modibo Keïta",
    title: "First President",
    country: "Mali",
    era: "1960–1968",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/F%C3%A9lix_Houphou%C3%ABt-Boigny.jpg/400px-F%C3%A9lix_Houphou%C3%ABt-Boigny.jpg",
    name: "Félix Houphouët-Boigny",
    title: "First President",
    country: "Ivory Coast",
    era: "1960–1993",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Sylvanus_Olympio.jpg/400px-Sylvanus_Olympio.jpg",
    name: "Sylvanus Olympio",
    title: "First President",
    country: "Togo",
    era: "1960–1963",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Hubert_Maga.jpg/400px-Hubert_Maga.jpg",
    name: "Hubert Maga",
    title: "First President",
    country: "Benin",
    era: "1960–1963",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Ahmadou_Ahidjo.jpg/400px-Ahmadou_Ahidjo.jpg",
    name: "Ahmadou Ahidjo",
    title: "First President",
    country: "Cameroon",
    era: "1960–1982",
  },

  /* ── EAST AFRICA ───────────────────────────────────────── */
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Julius_Nyerere_1965_%28cropped%29.jpg/400px-Julius_Nyerere_1965_%28cropped%29.jpg",
    name: "Julius Nyerere",
    title: "First President – Mwalimu",
    country: "Tanzania",
    era: "1961–1985",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Jomo_Kenyatta.jpg/400px-Jomo_Kenyatta.jpg",
    name: "Jomo Kenyatta",
    title: "First President – Mzee",
    country: "Kenya",
    era: "1963–1978",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Haile_Selassie_1970_%28cropped%29.jpg/400px-Haile_Selassie_1970_%28cropped%29.jpg",
    name: "Haile Selassie",
    title: "Emperor of Ethiopia",
    country: "Ethiopia",
    era: "1930–1974",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Oginga_Odinga.jpg/400px-Oginga_Odinga.jpg",
    name: "Oginga Odinga",
    title: "VP & Opposition Leader",
    country: "Kenya",
    era: "1963–1994",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Abebe_Bikila_%28cropped%29.jpg/400px-Abebe_Bikila_%28cropped%29.jpg",
    name: "Abebe Bikila",
    title: "Olympic Marathon Legend",
    country: "Ethiopia",
    era: "1960–1968",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Milton_Obote.jpg/400px-Milton_Obote.jpg",
    name: "Milton Obote",
    title: "First Prime Minister",
    country: "Uganda",
    era: "1962–1971",
  },

  /* ── SOUTHERN AFRICA ───────────────────────────────────── */
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Nelson_Mandela_1994.jpg/400px-Nelson_Mandela_1994.jpg",
    name: "Nelson Mandela",
    title: "President – Madiba",
    country: "South Africa",
    era: "1994–1999",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Oliver_Tambo.jpg/400px-Oliver_Tambo.jpg",
    name: "Oliver Tambo",
    title: "ANC President",
    country: "South Africa",
    era: "1967–1991",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Albert_Luthuli.jpg/400px-Albert_Luthuli.jpg",
    name: "Albert Luthuli",
    title: "Nobel Peace Laureate",
    country: "South Africa",
    era: "1952–1967",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Steve_Biko_portrait.jpg/400px-Steve_Biko_portrait.jpg",
    name: "Steve Biko",
    title: "Black Consciousness Leader",
    country: "South Africa",
    era: "1968–1977",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Kenneth_Kaunda.jpg/400px-Kenneth_Kaunda.jpg",
    name: "Kenneth Kaunda",
    title: "First President",
    country: "Zambia",
    era: "1964–1991",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Samora_Machel.jpg/400px-Samora_Machel.jpg",
    name: "Samora Machel",
    title: "First President",
    country: "Mozambique",
    era: "1975–1986",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Eduardo_Mondlane.jpg/400px-Eduardo_Mondlane.jpg",
    name: "Eduardo Mondlane",
    title: "FRELIMO Founder",
    country: "Mozambique",
    era: "1962–1969",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Joshua_Nkomo.jpg/400px-Joshua_Nkomo.jpg",
    name: "Joshua Nkomo",
    title: "Father of Zimbabwe",
    country: "Zimbabwe",
    era: "1960–1999",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Seretse_Khama.jpg/400px-Seretse_Khama.jpg",
    name: "Seretse Khama",
    title: "First President",
    country: "Botswana",
    era: "1966–1980",
  },

  /* ── NORTH AFRICA ──────────────────────────────────────── */
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Gamal_Abdel_Nasser.jpg/400px-Gamal_Abdel_Nasser.jpg",
    name: "Gamal Abdel Nasser",
    title: "President & Pan-Arabist",
    country: "Egypt",
    era: "1954–1970",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Habib_Bourguiba.jpg/400px-Habib_Bourguiba.jpg",
    name: "Habib Bourguiba",
    title: "Father of Tunisia",
    country: "Tunisia",
    era: "1956–1987",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Mohammed_V_of_Morocco.jpg/400px-Mohammed_V_of_Morocco.jpg",
    name: "Mohammed V",
    title: "King & Independence Leader",
    country: "Morocco",
    era: "1927–1961",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Ahmed_Ben_Bella.jpg/400px-Ahmed_Ben_Bella.jpg",
    name: "Ahmed Ben Bella",
    title: "First President",
    country: "Algeria",
    era: "1963–1965",
  },

  /* ── CENTRAL AFRICA ────────────────────────────────────── */
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Patrice_Lumumba.jpg/400px-Patrice_Lumumba.jpg",
    name: "Patrice Lumumba",
    title: "First Prime Minister",
    country: "DR Congo",
    era: "1960",
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Fulbert_Youlou.jpg/400px-Fulbert_Youlou.jpg",
    name: "Fulbert Youlou",
    title: "First President",
    country: "Congo-Brazzaville",
    era: "1960–1963",
  },
];

/* ── backward-compat alias used in landing.tsx ── */
export const AFRICAN_PRODUCTS = AFRICAN_LEADERS.map((l) => ({
  url: l.url,
  label: l.name,
  country: l.country,
}));

const FALLBACK_IMG = FALLBACK;
const ROWS: { speed: number; dir: "left" | "right" }[] = [
  { speed: 35, dir: "left" },
  { speed: 28, dir: "right" },
  { speed: 40, dir: "left" },
];

export default function AfricanLeaderCarousel() {
  const third = Math.ceil(AFRICAN_LEADERS.length / 3);
  const rows = [
    AFRICAN_LEADERS.slice(0, third),
    AFRICAN_LEADERS.slice(third, third * 2),
    AFRICAN_LEADERS.slice(third * 2),
  ];

  return (
    <div className="space-y-4">
      {rows.map((leaders, rowIdx) => {
        const doubled = [...leaders, ...leaders];
        const { speed, dir } = ROWS[rowIdx];
        return (
          <div key={rowIdx} className="overflow-hidden">
            <div
              className="flex gap-4"
              style={{
                animation: `${dir === "left" ? "marqueeLeft" : "marqueeRight"} ${speed}s linear infinite`,
                width: "max-content",
              }}
            >
              {doubled.map((leader, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-36 md:w-44 rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm shadow-lg border border-white/20"
                >
                  <div className="relative w-full h-36 md:h-44">
                    <img
                      src={leader.url}
                      alt={leader.name}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMG;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <span className="absolute top-2 right-2 text-xs font-bold bg-nigerian-gold text-gray-900 px-1.5 py-0.5 rounded-full">
                      {leader.era.split("–")[0].slice(-2)}s
                    </span>
                  </div>
                  <div className="px-2 py-2 text-center">
                    <p className="text-white font-bold text-xs leading-tight truncate">{leader.name}</p>
                    <p className="text-nigerian-gold text-[10px] leading-tight truncate">{leader.country}</p>
                    <p className="text-white/60 text-[9px] leading-tight truncate">{leader.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
