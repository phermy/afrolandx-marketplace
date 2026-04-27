import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, MapPin, Phone, Globe, Clock, Hotel, ShoppingBag,
  Utensils, Landmark, Car, Plane, Coffee, Music, Navigation,
  X, ExternalLink, CheckCircle2, PhoneCall, ChevronRight,
} from "lucide-react";
import { africaLocations, getCountriesByRegion, africanRegions } from "@shared/africaLocations";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Place {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  primaryType?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  currentOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text: string };
  photoUri?: string;
}

// ─── Country images via loremflickr keyword search (HTTP 302→200, browser follows) ──
function lf(keywords: string, seed: number) {
  return `https://loremflickr.com/1200/600/${encodeURIComponent(keywords)}/all?lock=${seed}`;
}

const COUNTRY_IMAGES: Record<string, string> = {
  NG: lf("Lagos,Nigeria,skyline", 1),
  EG: lf("Egypt,pyramids,cairo", 2),
  ZA: lf("Cape Town,South Africa,mountain", 3),
  KE: lf("Kenya,Nairobi,savanna,Africa", 4),
  MA: lf("Morocco,Marrakech,medina", 5),
  GH: lf("Ghana,Accra,Africa,coast", 6),
  ET: lf("Ethiopia,Addis Ababa,Africa", 7),
  TZ: lf("Tanzania,Zanzibar,Kilimanjaro", 8),
  SN: lf("Senegal,Dakar,West Africa", 9),
  UG: lf("Uganda,Kampala,Africa", 10),
  RW: lf("Rwanda,Kigali,Africa", 11),
  ZW: lf("Zimbabwe,Victoria Falls,Africa", 12),
  NA: lf("Namibia,desert,dunes,Africa", 13),
  ZM: lf("Zambia,Victoria Falls,Africa", 14),
  BW: lf("Botswana,Okavango,Africa,elephant", 15),
  TN: lf("Tunisia,Carthage,Mediterranean", 16),
  DZ: lf("Algeria,Sahara,desert,Algeria", 17),
  CI: lf("Ivory Coast,Abidjan,Africa", 18),
  CM: lf("Cameroon,Africa,tropical", 19),
  ML: lf("Mali,Timbuktu,Sahel,Africa", 20),
  MZ: lf("Mozambique,Africa,coast,ocean", 21),
  AO: lf("Angola,Luanda,Africa", 22),
  MG: lf("Madagascar,Africa,tropical,island", 23),
  CD: lf("Congo,Africa,rainforest,river", 24),
  SD: lf("Sudan,Nile,Africa,ancient", 25),
  LY: lf("Libya,Sahara,North Africa,ruins", 26),
  NE: lf("Niger,Sahel,Africa,landscape", 27),
  BF: lf("Burkina Faso,West Africa,savanna", 28),
  BJ: lf("Benin,West Africa,Africa,market", 29),
  TG: lf("Togo,Lome,West Africa,coast", 30),
  SL: lf("Sierra Leone,Africa,coast,jungle", 31),
  LR: lf("Liberia,West Africa,jungle,ocean", 32),
  GN: lf("Guinea,West Africa,Africa,tropical", 33),
  GW: lf("Guinea Bissau,Africa,tropical,ocean", 34),
  GM: lf("Gambia,West Africa,river,beach", 35),
  SS: lf("South Sudan,Africa,Nile,landscape", 36),
  ER: lf("Eritrea,Africa,Red Sea,coast", 37),
  SO: lf("Somalia,Africa,Mogadishu,coast", 38),
  DJ: lf("Djibouti,Africa,Red Sea", 39),
  CF: lf("Central Africa,tropical,rainforest", 40),
  CG: lf("Congo Brazzaville,Africa,rainforest", 41),
  GA: lf("Gabon,Africa,rainforest,ocean", 42),
  GQ: lf("Equatorial Guinea,Africa,forest", 43),
  TD: lf("Chad,Africa,Sahara,lake", 44),
  MR: lf("Mauritania,Sahara,desert,Africa", 45),
  LS: lf("Lesotho,South Africa,mountains", 46),
  SZ: lf("Eswatini,Swaziland,Africa,landscape", 47),
  MU: lf("Mauritius,island,tropical,lagoon", 48),
  SC: lf("Seychelles,island,tropical,beach", 49),
  KM: lf("Comoros,Africa,island,ocean", 50),
  ST: lf("Sao Tome,Africa,tropical,island", 51),
  CV: lf("Cape Verde,Africa,island,coast", 52),
};

const COUNTRY_FALLBACK = lf("Africa,savanna,landscape,wildlife", 99);

function getCountryImage(code: string): string {
  return COUNTRY_IMAGES[code] || COUNTRY_FALLBACK;
}

// Country flag emojis
const FLAGS: Record<string, string> = {
  NG:"🇳🇬",EG:"🇪🇬",ZA:"🇿🇦",KE:"🇰🇪",MA:"🇲🇦",GH:"🇬🇭",ET:"🇪🇹",TZ:"🇹🇿",
  SN:"🇸🇳",UG:"🇺🇬",RW:"🇷🇼",ZW:"🇿🇼",NA:"🇳🇦",ZM:"🇿🇲",BW:"🇧🇼",TN:"🇹🇳",
  DZ:"🇩🇿",CM:"🇨🇲",CI:"🇨🇮",ML:"🇲🇱",MZ:"🇲🇿",AO:"🇦🇴",MG:"🇲🇬",CD:"🇨🇩",
  LY:"🇱🇾",SD:"🇸🇩",NE:"🇳🇪",BF:"🇧🇫",MR:"🇲🇷",SO:"🇸🇴",SS:"🇸🇸",ER:"🇪🇷",
  DJ:"🇩🇯",CF:"🇨🇫",CG:"🇨🇬",GA:"🇬🇦",GQ:"🇬🇶",TD:"🇹🇩",SL:"🇸🇱",GN:"🇬🇳",
  GM:"🇬🇲",GW:"🇬🇼",LR:"🇱🇷",TG:"🇹🇬",BJ:"🇧🇯",LS:"🇱🇸",SZ:"🇸🇿",MU:"🇲🇺",
  SC:"🇸🇨",KM:"🇰🇲",ST:"🇸🇹",CV:"🇨🇻",
};

function getFlag(code: string): string {
  return FLAGS[code] || "🌍";
}

// ─── Place categories ──────────────────────────────────────────────────────────
const PLACE_CATEGORIES = [
  { id: "hotel",             label: "Hotels",      icon: Hotel,       emoji: "🏨" },
  { id: "shopping_mall",    label: "Malls",       icon: ShoppingBag, emoji: "🛍️" },
  { id: "restaurant",       label: "Restaurants", icon: Utensils,    emoji: "🍽️" },
  { id: "tourist_attraction", label: "Attractions", icon: Landmark,  emoji: "🏛️" },
  { id: "airport",           label: "Airports",    icon: Plane,       emoji: "✈️" },
  { id: "car_rental",        label: "Car Rentals", icon: Car,         emoji: "🚗" },
  { id: "cafe",              label: "Cafes",       icon: Coffee,      emoji: "☕" },
  { id: "night_club",        label: "Nightlife",   icon: Music,       emoji: "🎵" },
];

const SUBTYPE_EMOJI: Record<string, string> = {
  hotel:"🏨",hostel:"🛏️",motel:"🏩",guest_house:"🏠",mall:"🛍️",supermarket:"🛒",
  department_store:"🏬",marketplace:"🏪",restaurant:"🍽️",fast_food:"🍔",
  food_court:"🍱",attraction:"🏛️",museum:"🏛️",theme_park:"🎡",monument:"🗿",
  ruins:"🏚️",aerodrome:"✈️",car_rental:"🚗",cafe:"☕",nightclub:"🎵",bar:"🍺",pub:"🍺",
};

function getPlaceEmoji(type?: string) {
  return SUBTYPE_EMOJI[type || ""] || "📍";
}

const CARD_GRADIENTS = [
  "from-emerald-500 to-teal-600","from-amber-500 to-orange-600","from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600","from-rose-500 to-pink-600","from-lime-500 to-green-600",
  "from-cyan-500 to-teal-600","from-fuchsia-500 to-purple-600","from-orange-400 to-red-500",
  "from-indigo-500 to-violet-600","from-teal-400 to-emerald-600","from-yellow-500 to-amber-600",
];

function getCardGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length];
}

function formatShortAddress(full: string): string {
  const parts = full.split(",").map(s => s.trim()).filter(Boolean);
  return parts.length <= 2 ? full : parts.slice(0, 3).join(", ");
}

// ─── Place Detail Dialog ───────────────────────────────────────────────────────
function PlaceDetailsDialog({ place, open, onClose }: { place: Place | null; open: boolean; onClose: () => void }) {
  if (!place) return null;
  const emoji = getPlaceEmoji(place.primaryType);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 rounded-2xl">
        <div className="relative h-48 overflow-hidden">
          {place.photoUri ? (
            <img src={place.photoUri} alt={place.displayName.text} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getCardGradient(place.id)} flex items-center justify-center`}>
              <span className="text-6xl">{emoji}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-5">
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs mb-1 capitalize">
              {place.primaryType?.replace(/_/g, " ") || "Place"}
            </Badge>
            <h2 className="text-white text-xl font-bold drop-shadow">{place.displayName.text}</h2>
          </div>
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 text-white rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="max-h-[calc(90vh-192px)]">
          <div className="p-5 space-y-3">
            {place.editorialSummary?.text && (
              <p className="text-muted-foreground text-sm leading-relaxed">{place.editorialSummary.text}</p>
            )}
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Address</p>
                  <p className="text-sm">{place.formattedAddress}</p>
                </div>
              </div>
              {place.internationalPhoneNumber && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <Phone className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Phone</p>
                    <a href={`tel:${place.internationalPhoneNumber}`} className="text-sm text-emerald-600 hover:underline font-medium">{place.internationalPhoneNumber}</a>
                  </div>
                </div>
              )}
              {place.websiteUri && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <Globe className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Website</p>
                    <a href={place.websiteUri} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline truncate block">
                      {place.websiteUri.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </div>
                </div>
              )}
              {place.currentOpeningHours?.weekdayDescriptions?.length && (
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl">
                  <Clock className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Opening Hours</p>
                    {place.currentOpeningHours.weekdayDescriptions.map((d, i) => (
                      <p key={i} className="text-sm text-muted-foreground">{d}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl" onClick={() => {
                const { latitude: lat, longitude: lon } = place.location;
                window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=17`, "_blank");
              }}>
                <Navigation className="h-4 w-4 mr-2" /> Get Directions
              </Button>
              {place.internationalPhoneNumber && (
                <Button variant="outline" className="border-emerald-200 text-emerald-700 rounded-xl" onClick={() => window.open(`tel:${place.internationalPhoneNumber}`, "_self")}>
                  <PhoneCall className="h-4 w-4" />
                </Button>
              )}
              {place.websiteUri && (
                <Button variant="outline" className="border-emerald-200 text-emerald-700 rounded-xl" onClick={() => window.open(place.websiteUri, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Country Card ──────────────────────────────────────────────────────────────
function CountryCard({ code, country, isSelected, onClick }: {
  code: string;
  country: { name: string; cities: any[] };
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-2xl overflow-hidden text-left transition-all duration-300 ${
        isSelected
          ? "ring-4 ring-emerald-500 ring-offset-2 shadow-2xl scale-[1.02]"
          : "hover:shadow-xl hover:scale-[1.03] shadow-md"
      }`}
      style={{ aspectRatio: "4/3" }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${CARD_GRADIENTS[(code.charCodeAt(0) + code.charCodeAt(1)) % CARD_GRADIENTS.length]}`} />
      <img
        src={getCountryImage(code)}
        alt={country.name}
        className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
        loading="lazy"
        style={{ opacity: 0 }}
        onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; }}
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {isSelected && (
        <div className="absolute inset-0 bg-emerald-600/20 ring-4 ring-emerald-400 ring-inset rounded-2xl" />
      )}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-white font-bold text-sm leading-tight drop-shadow">{country.name}</p>
            <p className="text-white/60 text-xs mt-0.5">{country.cities.length} cities</p>
          </div>
          <span className="text-2xl drop-shadow-lg">{getFlag(code)}</span>
        </div>
      </div>
      {isSelected && (
        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
          Selected
        </div>
      )}
    </button>
  );
}

// ─── Place Result Card ─────────────────────────────────────────────────────────
function PlaceCard({ place, tall, onClick }: { place: Place; tall?: boolean; onClick: () => void }) {
  const emoji = getPlaceEmoji(place.primaryType);
  const gradient = getCardGradient(place.id);
  return (
    <Card
      className="cursor-pointer overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group"
      onClick={onClick}
    >
      <div className={`relative overflow-hidden ${tall ? "h-72" : "h-44"}`}>
        {place.photoUri ? (
          <img
            src={place.photoUri}
            alt={place.displayName.text}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2`}>
            <span className="text-6xl drop-shadow-lg">{emoji}</span>
            <span className="text-white/70 text-xs font-medium capitalize tracking-wide">{place.primaryType?.replace(/_/g, " ") || "Place"}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className="text-lg">{emoji}</span>
          <Badge className="bg-black/40 text-white border-white/20 backdrop-blur-sm text-xs capitalize">
            {place.primaryType?.replace(/_/g, " ") || "Place"}
          </Badge>
        </div>
        {place.websiteUri && (
          <Badge className="absolute top-3 right-3 bg-emerald-500/90 text-white border-0 text-xs">
            <Globe className="h-2.5 w-2.5 mr-1" />Online
          </Badge>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-bold text-sm leading-snug drop-shadow line-clamp-2 group-hover:text-emerald-300 transition-colors">
            {place.displayName.text}
          </h3>
          <p className="text-white/70 text-xs mt-1 flex items-center gap-1 line-clamp-1">
            <MapPin className="h-3 w-3 flex-shrink-0 text-emerald-400" />
            {formatShortAddress(place.formattedAddress)}
          </p>
        </div>
      </div>
      <CardContent className="p-3 bg-white">
        <div className="flex items-center gap-3">
          {place.internationalPhoneNumber && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
              <Phone className="h-3 w-3" /> Call
            </span>
          )}
          {place.currentOpeningHours?.weekdayDescriptions?.length && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Hours
            </span>
          )}
          {place.websiteUri && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <Globe className="h-3 w-3" /> Web
            </span>
          )}
          {place.editorialSummary?.text && (
            <p className="text-xs text-muted-foreground line-clamp-1 flex-1 italic">{place.editorialSummary.text}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
const REGION_LABELS: Record<string, string> = {
  "Northern Africa": "North",
  "Western Africa": "West",
  "Central Africa": "Central",
  "Eastern Africa": "East",
  "Southern Africa": "South",
};

export default function DiscoverAfrica() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState("NG");
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeRegion, setActiveRegion] = useState<string>("all");
  const resultsRef = useRef<HTMLDivElement>(null);

  const selectedCountry = africaLocations[selectedCountryCode];
  const selectedCity = useMemo(() => {
    if (!selectedCityName) return selectedCountry.cities[0];
    return selectedCountry.cities.find(c => c.name === selectedCityName) || selectedCountry.cities[0];
  }, [selectedCountry, selectedCityName]);

  // Filtered country list by region tab
  const filteredCountries = useMemo(() => {
    const entries = Object.entries(africaLocations);
    if (activeRegion === "all") return entries;
    return entries.filter(([, c]) => c.region === activeRegion);
  }, [activeRegion]);

  const { data: placesData, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/places/search", searchQuery, activeCategory, selectedCountryCode, selectedCity.name],
    queryFn: async () => {
      if (!searchQuery && !activeCategory) return { places: [] };
      const params = new URLSearchParams({
        lat: selectedCity.lat.toString(),
        lng: selectedCity.lng.toString(),
        radius: "15000",
        city: selectedCity.name,
        country: selectedCountry.name,
      });
      if (activeCategory) params.set("type", activeCategory);
      else params.set("query", `${searchQuery} in ${selectedCity.name}, ${selectedCountry.name}`);
      const res = await fetch(`/api/places/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch places");
      return data;
    },
    enabled: !!(searchQuery || activeCategory),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const places: Place[] = placesData?.places || [];
  const hasSearch = !!(searchQuery || activeCategory);

  function selectCountry(code: string) {
    setSelectedCountryCode(code);
    setSelectedCityName(null);
    setActiveCategory(null);
    setSearchQuery("");
  }

  function triggerSearch(cat?: string) {
    if (cat) setActiveCategory(cat);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* ── Cinematic Hero Banner ────────────────────────────────────────────── */}
      <div className="relative h-[420px] md:h-[500px] overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-700 to-amber-800">
        <img
          key={selectedCountryCode}
          src={getCountryImage(selectedCountryCode)}
          alt={selectedCountry.name}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          loading="eager"
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }}
          onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; }}
          style={{ opacity: 0 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        <div className="absolute inset-0 flex flex-col justify-end px-6 pb-8 md:px-12 md:pb-12">
          <div className="max-w-4xl">
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">Explore the Continent</p>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-5xl drop-shadow-xl">{getFlag(selectedCountryCode)}</span>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-2xl">
                {selectedCountry.name}
              </h1>
            </div>
            <p className="text-white/70 text-base mb-5">
              Hotels, restaurants, attractions and hidden gems across {selectedCountry.name}
            </p>

            {/* City pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              {selectedCountry.cities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => setSelectedCityName(city.name)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all backdrop-blur-sm ${
                    selectedCity.name === city.name
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40"
                      : "bg-white/15 text-white hover:bg-white/30 border border-white/20"
                  }`}
                >
                  {city.name}
                </button>
              ))}
            </div>

            {/* Search bar */}
            <form
              onSubmit={(e) => { e.preventDefault(); setActiveCategory(null); triggerSearch(); }}
              className="relative max-w-2xl"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder={`Search in ${selectedCity.name}, ${selectedCountry.name}…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-28 py-6 text-base text-gray-900 rounded-2xl shadow-2xl border-0 bg-white/95 backdrop-blur"
              />
              <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5">
                Search
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Quick Category Bar ───────────────────────────────────────────────── */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide flex-shrink-0 mr-1">Quick:</span>
            {PLACE_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(isActive ? null : cat.id);
                    setSearchQuery("");
                    if (!isActive) triggerSearch(cat.id);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all flex-shrink-0 ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                      : "border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50/50"
                  }`}
                >
                  <span>{cat.emoji}</span>{cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* ── Results Section ──────────────────────────────────────────────────── */}
        <div ref={resultsRef}>
          {hasSearch && isError && (
            <div className="flex flex-col items-center justify-center py-20 text-center mb-10">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-sm w-full">
                <span className="text-4xl mb-4 block">🔍</span>
                <h3 className="font-semibold text-gray-800 mb-2">Could not load places</h3>
                <p className="text-sm text-amber-700 mb-5">The service is temporarily busy. Please try again in a moment.</p>
                <Button onClick={() => refetch()} className="bg-emerald-600 hover:bg-emerald-700 w-full rounded-xl">Try Again</Button>
              </div>
            </div>
          )}

          {hasSearch && !isError && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {isLoading ? "Searching…" : places.length > 0
                      ? <>{places.length} places in <span className="text-emerald-600">{selectedCity.name}</span></>
                      : "No results found"}
                  </h2>
                  {!isLoading && places.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedCountry.name} · {activeCategory ? PLACE_CATEGORIES.find(c => c.id === activeCategory)?.label : `"${searchQuery}"`}</p>
                  )}
                </div>
              </div>

              {isLoading ? (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="break-inside-avoid mb-4">
                      <Skeleton className={`w-full rounded-2xl ${i % 3 === 0 ? "h-72" : "h-44"}`} />
                      <div className="bg-white rounded-b-2xl p-3 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : places.length > 0 ? (
                /* Masonry-style grid */
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                  {places.map((place, idx) => (
                    <div key={place.id} className="break-inside-avoid mb-4">
                      <PlaceCard
                        place={place}
                        tall={idx % 5 === 0}
                        onClick={() => setSelectedPlace(place)}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Country Explorer ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900">Explore Countries</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Select a destination to discover what's there</p>
            </div>
            <div className="flex items-center text-sm text-emerald-600 font-semibold">
              <span>{Object.keys(africaLocations).length} countries</span>
              <ChevronRight className="h-4 w-4 ml-0.5" />
            </div>
          </div>

          {/* Region tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
            <button
              onClick={() => setActiveRegion("all")}
              className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border-2 flex-shrink-0 ${
                activeRegion === "all"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              🌍 All Africa
            </button>
            {africanRegions.map((region) => (
              <button
                key={region}
                onClick={() => setActiveRegion(activeRegion === region ? "all" : region)}
                className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border-2 flex-shrink-0 ${
                  activeRegion === region
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200"
                    : "border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50"
                }`}
              >
                {REGION_LABELS[region] || region}
              </button>
            ))}
          </div>

          {/* Country photo grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredCountries.map(([code, country]) => (
              <CountryCard
                key={code}
                code={code}
                country={country}
                isSelected={selectedCountryCode === code}
                onClick={() => {
                  selectCountry(code);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ))}
          </div>
        </div>

        {/* ── "Explore by Category" CTA section ─────────────────────────────────── */}
        {!hasSearch && (
          <div className="mt-14">
            <h2 className="text-2xl font-black text-gray-900 mb-1">What are you looking for?</h2>
            <p className="text-sm text-muted-foreground mb-5">Tap a category to instantly discover places in {selectedCity.name}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {PLACE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setSearchQuery(""); triggerSearch(cat.id); }}
                    className="group relative rounded-2xl overflow-hidden text-left shadow-md hover:shadow-xl transition-all hover:-translate-y-1"
                  >
                    <div className={`h-28 bg-gradient-to-br ${CARD_GRADIENTS[PLACE_CATEGORIES.indexOf(cat) % CARD_GRADIENTS.length]} flex items-center justify-center`}>
                      <span className="text-5xl drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{cat.emoji}</span>
                    </div>
                    <div className="bg-white p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-gray-900">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">in {selectedCity.name}</p>
                      </div>
                      <Icon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <PlaceDetailsDialog
        place={selectedPlace}
        open={!!selectedPlace}
        onClose={() => setSelectedPlace(null)}
      />
    </div>
  );
}
