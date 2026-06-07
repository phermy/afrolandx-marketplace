export interface AfricanCountry {
  name: string;
  flag: string;
  region: "West" | "East" | "North" | "Central" | "Southern";
  fashionItems: string[];
}

export const AFRICAN_COUNTRIES: AfricanCountry[] = [
  // ── West Africa ──────────────────────────────────────────────────
  {
    name: "Nigeria", flag: "🇳🇬", region: "West",
    fashionItems: ["Agbada", "Aso-Oke", "Ankara", "Buba", "Gele", "Iro", "Kaftan", "Dashiki", "Fila", "Sokoto", "Babariga", "Bante"],
  },
  {
    name: "Ghana", flag: "🇬🇭", region: "West",
    fashionItems: ["Kente", "Kaba", "Batakari", "Fugu", "Smock", "Obroni Wawu", "Ntama"],
  },
  {
    name: "Senegal", flag: "🇸🇳", region: "West",
    fashionItems: ["Grand Boubou", "Kaftan", "Wax Print", "Khaftaan", "Thiébou", "Bazin"],
  },
  {
    name: "Mali", flag: "🇲🇱", region: "West",
    fashionItems: ["Bogolanfini", "Bogolan", "Mud Cloth", "Bazin Riche", "Boubou"],
  },
  {
    name: "Côte d'Ivoire", flag: "🇨🇮", region: "West",
    fashionItems: ["Kita", "Wax Print", "Pagne", "Boubou"],
  },
  {
    name: "Guinea", flag: "🇬🇳", region: "West",
    fashionItems: ["Grand Boubou", "Bazin", "Pagne", "Lansana"],
  },
  {
    name: "Burkina Faso", flag: "🇧🇫", region: "West",
    fashionItems: ["Faso Dan Fani", "Bogolan", "Bazin", "Boubou"],
  },
  {
    name: "Cameroon", flag: "🇨🇲", region: "West",
    fashionItems: ["Toghu", "Bamenda cloth", "Ndop", "Kaba Ngondo"],
  },
  {
    name: "Benin", flag: "🇧🇯", region: "West",
    fashionItems: ["Alede", "Pagne", "Agbada", "Batik"],
  },
  {
    name: "Togo", flag: "🇹🇬", region: "West",
    fashionItems: ["Kente", "Batakari", "Pagne", "Kpokpo"],
  },
  {
    name: "Sierra Leone", flag: "🇸🇱", region: "West",
    fashionItems: ["Gara", "Krio dress", "Buba", "Lappa"],
  },
  {
    name: "Liberia", flag: "🇱🇷", region: "West",
    fashionItems: ["Country cloth", "Lappa", "Kpokpo"],
  },
  {
    name: "Guinea-Bissau", flag: "🇬🇼", region: "West",
    fashionItems: ["Boubou", "Pagne", "Bazin"],
  },
  {
    name: "The Gambia", flag: "🇬🇲", region: "West",
    fashionItems: ["Grand Boubou", "Kaftan", "Bazin"],
  },
  {
    name: "Mauritania", flag: "🇲🇷", region: "West",
    fashionItems: ["Dara'a", "Melahfa", "Boubou"],
  },
  {
    name: "Cape Verde", flag: "🇨🇻", region: "West",
    fashionItems: ["Pano de Terra", "Batuku"],
  },
  {
    name: "Niger", flag: "🇳🇪", region: "West",
    fashionItems: ["Boubou", "Tagelmust", "Bazin"],
  },

  // ── East Africa ──────────────────────────────────────────────────
  {
    name: "Ethiopia", flag: "🇪🇹", region: "East",
    fashionItems: ["Habesha Kemis", "Netela", "Shamma", "Gabi", "Tibeb", "Kuta", "Jano"],
  },
  {
    name: "Kenya", flag: "🇰🇪", region: "East",
    fashionItems: ["Kikoi", "Kitenge", "Kanga", "Maasai Shuka", "Kofia"],
  },
  {
    name: "Tanzania", flag: "🇹🇿", region: "East",
    fashionItems: ["Kitenge", "Kanga", "Kanzu", "Khanga", "Lesso"],
  },
  {
    name: "Uganda", flag: "🇺🇬", region: "East",
    fashionItems: ["Gomesi", "Kanzu", "Busuti", "Suuka"],
  },
  {
    name: "Rwanda", flag: "🇷🇼", region: "East",
    fashionItems: ["Umushanana", "Igitenge", "Inzira"],
  },
  {
    name: "Burundi", flag: "🇧🇮", region: "East",
    fashionItems: ["Umushanana", "Ikiteenge"],
  },
  {
    name: "Somalia", flag: "🇸🇴", region: "East",
    fashionItems: ["Dirac", "Guntiino", "Macawis", "Garbasaar"],
  },
  {
    name: "Eritrea", flag: "🇪🇷", region: "East",
    fashionItems: ["Zuria", "Netela", "Tigrinya dress"],
  },
  {
    name: "Djibouti", flag: "🇩🇯", region: "East",
    fashionItems: ["Dirac", "Guntiino", "Macawis"],
  },
  {
    name: "Madagascar", flag: "🇲🇬", region: "East",
    fashionItems: ["Lamba", "Rabane"],
  },
  {
    name: "Comoros", flag: "🇰🇲", region: "East",
    fashionItems: ["Shashwi", "Kanzu", "Kandu"],
  },
  {
    name: "Mauritius", flag: "🇲🇺", region: "East",
    fashionItems: ["Sari", "Seega"],
  },
  {
    name: "Seychelles", flag: "🇸🇨", region: "East",
    fashionItems: ["Kreol dress", "Sari"],
  },

  // ── North Africa ─────────────────────────────────────────────────
  {
    name: "Morocco", flag: "🇲🇦", region: "North",
    fashionItems: ["Djellaba", "Kaftan", "Takchita", "Burnous", "Jabador", "Haïk", "Jellaba"],
  },
  {
    name: "Egypt", flag: "🇪🇬", region: "North",
    fashionItems: ["Galabiya", "Kaftan", "Abaya", "Jalabiya"],
  },
  {
    name: "Tunisia", flag: "🇹🇳", region: "North",
    fashionItems: ["Jebba", "Kaftan", "Fouta"],
  },
  {
    name: "Algeria", flag: "🇩🇿", region: "North",
    fashionItems: ["Karakou", "Haïk", "Burnous", "Djellaba", "Gandoura"],
  },
  {
    name: "Libya", flag: "🇱🇾", region: "North",
    fashionItems: ["Farashiya", "Jerd", "Burnous"],
  },
  {
    name: "Sudan", flag: "🇸🇩", region: "North",
    fashionItems: ["Thobe", "Jalabiya", "Toub"],
  },
  {
    name: "South Sudan", flag: "🇸🇸", region: "North",
    fashionItems: ["Toub", "Shuka", "Thobe"],
  },

  // ── Central Africa ───────────────────────────────────────────────
  {
    name: "DR Congo", flag: "🇨🇩", region: "Central",
    fashionItems: ["Kitenge", "Sape", "Liputa", "Wax Print"],
  },
  {
    name: "Republic of Congo", flag: "🇨🇬", region: "Central",
    fashionItems: ["Sapeur style", "Kitenge", "Pagne"],
  },
  {
    name: "Gabon", flag: "🇬🇦", region: "Central",
    fashionItems: ["Pagne", "Wax Print", "Kitenge"],
  },
  {
    name: "Central African Republic", flag: "🇨🇫", region: "Central",
    fashionItems: ["Pagne", "Kitenge"],
  },
  {
    name: "Chad", flag: "🇹🇩", region: "Central",
    fashionItems: ["Boubou", "Tobe", "Djellaba"],
  },
  {
    name: "Equatorial Guinea", flag: "🇬🇶", region: "Central",
    fashionItems: ["Pagne", "Wax Print"],
  },
  {
    name: "São Tomé and Príncipe", flag: "🇸🇹", region: "Central",
    fashionItems: ["Pano cloth"],
  },

  // ── Southern Africa ──────────────────────────────────────────────
  {
    name: "South Africa", flag: "🇿🇦", region: "Southern",
    fashionItems: ["Shweshwe", "Isicholo", "Umbhaco", "Ndebele beadwork", "Imibhaco", "Doek"],
  },
  {
    name: "Zimbabwe", flag: "🇿🇼", region: "Southern",
    fashionItems: ["Chitenge", "Shweshwe", "Ndebele attire"],
  },
  {
    name: "Zambia", flag: "🇿🇲", region: "Southern",
    fashionItems: ["Chitenge", "Chitengi"],
  },
  {
    name: "Mozambique", flag: "🇲🇿", region: "Southern",
    fashionItems: ["Capulana", "Chitenge"],
  },
  {
    name: "Malawi", flag: "🇲🇼", region: "Southern",
    fashionItems: ["Chitenge", "Chitengi"],
  },
  {
    name: "Botswana", flag: "🇧🇼", region: "Southern",
    fashionItems: ["Kaross", "Shweshwe"],
  },
  {
    name: "Namibia", flag: "🇳🇦", region: "Southern",
    fashionItems: ["Kaross", "Ohorokova", "Herero dress"],
  },
  {
    name: "Angola", flag: "🇦🇴", region: "Southern",
    fashionItems: ["Pano cloth", "Kitenge", "Capulana"],
  },
  {
    name: "Lesotho", flag: "🇱🇸", region: "Southern",
    fashionItems: ["Basotho blanket", "Mokorotlo"],
  },
  {
    name: "Eswatini", flag: "🇸🇿", region: "Southern",
    fashionItems: ["Emahiya", "Sidvwashi", "Lihiya"],
  },
];

export const COUNTRY_MAP: Record<string, AfricanCountry> = Object.fromEntries(
  AFRICAN_COUNTRIES.map(c => [c.name, c])
);

export function getCountryFlag(countryName: string): string {
  return COUNTRY_MAP[countryName]?.flag ?? "🌍";
}

export function getFashionItemsByCountry(countryName: string): string[] {
  return COUNTRY_MAP[countryName]?.fashionItems ?? [];
}

export const COUNTRIES_BY_REGION = AFRICAN_COUNTRIES.reduce(
  (acc, c) => {
    if (!acc[c.region]) acc[c.region] = [];
    acc[c.region].push(c);
    return acc;
  },
  {} as Record<string, AfricanCountry[]>
);
