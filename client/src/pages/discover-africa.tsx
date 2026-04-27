import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, MapPin, Phone, Globe, Clock, Hotel, ShoppingBag,
  Utensils, Landmark, Car, Plane, Coffee, Music, Navigation,
  X, ExternalLink, CheckCircle2, PhoneCall, ChevronRight,
  Star, TrendingUp, Users, Crown, Briefcase, Tag, Sparkles,
  BadgePercent, Building2, ArrowRight, Loader2, PartyPopper,
} from "lucide-react";
import { africaLocations, getCountriesByRegion, africanRegions } from "@shared/africaLocations";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

// ─── BASE DEAL PRICES (NGN) ────────────────────────────────────────────────────
const DEAL_BASE_PRICES: Record<string, number> = {
  "Lagos Luxury Stay": 120000,
  "Dinner for Two": 35000,
  "Cairo City Tour": 45000,
  "Cape Town Getaway": 180000,
  "Nairobi Safari": 220000,
  "Marrakech Medina Tour": 55000,
};

// ─── BookingDialog ─────────────────────────────────────────────────────────────
interface DealInfo { title: string; emoji: string; badge: string; off: string; country: string; type: string }

function BookingDialog({ deal, open, onClose }: { deal: DealInfo | null; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState((user as any)?.firstName || "");
  const [email, setEmail] = useState((user as any)?.email || "");
  const [guests, setGuests] = useState(1);
  const [date, setDate] = useState("");
  const [done, setDone] = useState(false);

  const basePrice = deal ? (DEAL_BASE_PRICES[deal.title] || 50000) : 50000;
  const discountPct = deal ? parseInt(deal.off) / 100 : 0;
  const perPerson = Math.round(basePrice * (1 - discountPct));
  const total = perPerson * guests;

  const bookMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/discover/bookings/initialize", {
        dealTitle: deal!.title, dealType: deal!.type,
        guestName: name, guestEmail: email, guestCount: guests,
        bookingDate: date, totalAmountNgn: total,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authorizationUrl) {
        window.open(data.authorizationUrl, "_blank");
        setDone(true);
      }
    },
    onError: () => toast({ title: "Booking failed", description: "Please try again.", variant: "destructive" }),
  });

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
        <div className={`h-32 bg-gradient-to-br ${CARD_GRADIENTS[Object.keys(DEAL_BASE_PRICES).indexOf(deal.title) % CARD_GRADIENTS.length]} flex items-center justify-center relative`}>
          <span className="text-6xl">{deal.emoji}</span>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute bottom-3 left-4">
            <Badge className="bg-white/90 text-gray-800 border-0 font-bold text-xs">{deal.badge}</Badge>
          </div>
          <div className="absolute top-3 right-3 bg-rose-500 text-white text-sm font-black px-2 py-0.5 rounded-full">-{deal.off}</div>
        </div>
        <div className="p-5">
          {done ? (
            <div className="text-center py-4">
              <PartyPopper className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-black text-gray-900 mb-1">Booking Initiated!</h3>
              <p className="text-sm text-muted-foreground">Complete your payment in the Paystack window to confirm your booking.</p>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl w-full" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <>
              <DialogHeader className="mb-4 p-0">
                <DialogTitle>{deal.title}</DialogTitle>
                <DialogDescription>{deal.country} · Exclusive AfrolandX deal</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">Full Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="rounded-xl" required />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">Email</Label>
                    <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email" className="rounded-xl" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">Date</Label>
                    <Input value={date} onChange={e => setDate(e.target.value)} type="date" min={new Date().toISOString().split("T")[0]} className="rounded-xl" required />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">Guests</Label>
                    <Input value={guests} onChange={e => setGuests(Math.max(1, parseInt(e.target.value) || 1))} type="number" min={1} max={20} className="rounded-xl" />
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{guests} guest{guests > 1 ? "s" : ""} × ₦{perPerson.toLocaleString()}</p>
                    <p className="font-black text-lg text-emerald-700">₦{total.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs line-through text-gray-400">₦{(basePrice * guests).toLocaleString()}</p>
                    <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">You save ₦{((basePrice - perPerson) * guests).toLocaleString()}</Badge>
                  </div>
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-5 font-bold text-base"
                  disabled={!name || !email || !date || bookMutation.isPending}
                  onClick={() => bookMutation.mutate()}
                >
                  {bookMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : `Pay ₦${total.toLocaleString()} with Paystack`}
                </Button>
                <p className="text-xs text-center text-gray-400">Secure payment · Cancel anytime before your booking date</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── InquiryDialog (Guide Registration, Business Claim, Deal Listing, Destination Feature) ──
interface InquiryConfig {
  type: string;
  title: string;
  description: string;
  emoji: string;
  fields: { key: string; label: string; type: string; placeholder: string; required?: boolean }[];
  submitLabel: string;
  successTitle: string;
  successMsg: string;
}

const INQUIRY_CONFIGS: Record<string, InquiryConfig> = {
  guide_registration: {
    type: "guide_registration",
    title: "Register as a Local Expert Guide",
    description: "Join our network of African city experts and earn by hosting tours.",
    emoji: "🧭",
    submitLabel: "Submit Application",
    successTitle: "Application Received!",
    successMsg: "We'll review your application and contact you within 3 business days.",
    fields: [
      { key: "name", label: "Full Name", type: "text", placeholder: "Your full name", required: true },
      { key: "email", label: "Email Address", type: "email", placeholder: "you@email.com", required: true },
      { key: "phone", label: "Phone Number", type: "tel", placeholder: "+234 xxx xxx xxxx" },
      { key: "city", label: "City / Country", type: "text", placeholder: "e.g. Lagos, Nigeria", required: true },
      { key: "languages", label: "Languages Spoken", type: "text", placeholder: "e.g. English, Yoruba, French" },
      { key: "specialty", label: "Tour Specialty", type: "textarea", placeholder: "Describe what tours you'd like to offer…" },
    ],
  },
  business_claim: {
    type: "business_claim",
    title: "Claim Your Business Listing",
    description: "Manage your business profile, add photos and get discovered by thousands.",
    emoji: "🏢",
    submitLabel: "Claim Listing",
    successTitle: "Claim Request Sent!",
    successMsg: "We'll verify your ownership and activate your listing within 24 hours.",
    fields: [
      { key: "name", label: "Your Name", type: "text", placeholder: "Your full name", required: true },
      { key: "email", label: "Business Email", type: "email", placeholder: "business@email.com", required: true },
      { key: "phone", label: "Business Phone", type: "tel", placeholder: "+234 xxx xxx xxxx" },
      { key: "businessName", label: "Business Name", type: "text", placeholder: "Name of your business", required: true },
      { key: "website", label: "Website (optional)", type: "url", placeholder: "https://yourbusiness.com" },
      { key: "description", label: "Brief Description", type: "textarea", placeholder: "What does your business do?" },
    ],
  },
  deal_listing: {
    type: "deal_listing",
    title: "List Your Deal on AfrolandX",
    description: "Reach 50,000+ monthly travellers and promote your exclusive offer.",
    emoji: "🏷️",
    submitLabel: "Submit Deal",
    successTitle: "Deal Submitted!",
    successMsg: "Our partnerships team will review your deal and get in touch within 48 hours.",
    fields: [
      { key: "name", label: "Contact Name", type: "text", placeholder: "Your name", required: true },
      { key: "email", label: "Business Email", type: "email", placeholder: "contact@yourbusiness.com", required: true },
      { key: "phone", label: "Phone Number", type: "tel", placeholder: "+234 xxx xxx xxxx" },
      { key: "dealTitle", label: "Deal Title", type: "text", placeholder: "e.g. 30% off dinner for two", required: true },
      { key: "discount", label: "Discount Offered", type: "text", placeholder: "e.g. 20%, buy one get one free" },
      { key: "details", label: "Deal Details", type: "textarea", placeholder: "Describe your deal, validity, and terms…" },
    ],
  },
  destination_feature: {
    type: "destination_feature",
    title: "Feature Your Destination",
    description: "Get your country, city or region promoted to thousands of AfrolandX users.",
    emoji: "🌍",
    submitLabel: "Request Feature",
    successTitle: "Request Received!",
    successMsg: "Our advertising team will contact you with a custom sponsorship package.",
    fields: [
      { key: "name", label: "Contact Name", type: "text", placeholder: "Your name", required: true },
      { key: "email", label: "Email", type: "email", placeholder: "you@organization.com", required: true },
      { key: "phone", label: "Phone", type: "tel", placeholder: "+234 xxx xxx xxxx" },
      { key: "organization", label: "Organisation", type: "text", placeholder: "e.g. Nigeria Tourism Board", required: true },
      { key: "destination", label: "Destination to Feature", type: "text", placeholder: "Country, city or region", required: true },
      { key: "budget", label: "Estimated Budget (NGN)", type: "text", placeholder: "e.g. ₦500,000" },
      { key: "goals", label: "Campaign Goals", type: "textarea", placeholder: "What do you hope to achieve?" },
    ],
  },
};

function InquiryDialog({ configKey, open, onClose }: { configKey: string | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const config = configKey ? INQUIRY_CONFIGS[configKey] : null;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/discover/inquiries", {
        type: config!.type,
        name: form.name,
        email: form.email,
        phone: form.phone,
        details: form,
      });
      return res.json();
    },
    onSuccess: () => setDone(true),
    onError: () => toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" }),
  });

  if (!config) return null;

  function handleClose() { setDone(false); setForm({}); onClose(); }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden max-h-[92vh]">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 pb-4">
          <div className="text-4xl mb-2">{config.emoji}</div>
          <DialogHeader className="p-0">
            <DialogTitle className="text-white text-xl">{config.title}</DialogTitle>
            <DialogDescription className="text-white/75 text-sm mt-1">{config.description}</DialogDescription>
          </DialogHeader>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="p-5">
            {done ? (
              <div className="text-center py-6">
                <PartyPopper className="h-14 w-14 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-black text-gray-900 mb-1">{config.successTitle}</h3>
                <p className="text-sm text-muted-foreground mb-5">{config.successMsg}</p>
                <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl w-full" onClick={handleClose}>Close</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {config.fields.map(f => (
                  <div key={f.key}>
                    <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                      {f.label}{f.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        placeholder={f.placeholder}
                        value={form[f.key] || ""}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="rounded-xl text-sm resize-none"
                        rows={3}
                      />
                    ) : (
                      <Input
                        type={f.type}
                        placeholder={f.placeholder}
                        value={form[f.key] || ""}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="rounded-xl"
                      />
                    )}
                  </div>
                ))}
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-5 font-bold mt-2"
                  disabled={!form.name || !form.email || submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : config.submitLabel}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── PremiumDialog ─────────────────────────────────────────────────────────────
function PremiumDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState((user as any)?.email || "");
  const [done, setDone] = useState(false);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/discover/premium/initialize", { email });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authorizationUrl) {
        window.open(data.authorizationUrl, "_blank");
        setDone(true);
      }
    },
    onError: () => toast({ title: "Payment failed", description: "Please try again.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={() => { setDone(false); onClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-6 w-6 text-yellow-400" />
            <Badge className="bg-yellow-400 text-yellow-900 border-0 font-bold">Premium</Badge>
          </div>
          <h2 className="text-2xl font-black text-white mb-1">AfrolandX Explorer Premium</h2>
          <p className="text-white/75 text-sm">₦2,500/month · Cancel anytime · 7-day free trial</p>
        </div>
        <div className="p-5">
          {done ? (
            <div className="text-center py-4">
              <Crown className="h-12 w-12 text-violet-500 mx-auto mb-3" />
              <h3 className="text-lg font-black text-gray-900 mb-1">Premium Activated!</h3>
              <p className="text-sm text-muted-foreground">Complete your payment in the Paystack window. Your Premium access will activate automatically.</p>
              <Button className="mt-4 bg-violet-600 hover:bg-violet-700 rounded-xl w-full" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { icon: "📖", text: "Curated city guides for 20+ African cities" },
                  { icon: "🏷️", text: "Exclusive members-only deals & discounts" },
                  { icon: "🔔", text: "Trending spot alerts & early access" },
                  { icon: "⭐", text: "Your business at the top of every search" },
                ].map(f => (
                  <div key={f.text} className="flex items-start gap-2 bg-violet-50 rounded-xl p-3">
                    <span className="text-lg flex-shrink-0">{f.icon}</span>
                    <p className="text-xs text-gray-700 leading-relaxed">{f.text}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-600 mb-1 block">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <Button
                  className="w-full bg-violet-600 hover:bg-violet-700 rounded-xl py-5 font-bold text-base"
                  disabled={!email || subscribeMutation.isPending}
                  onClick={() => subscribeMutation.mutate()}
                >
                  {subscribeMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : <><Crown className="h-4 w-4 mr-2" />Start Free Trial — ₦2,500/mo</>}
                </Button>
                <p className="text-xs text-center text-gray-400">Secure payment via Paystack · No charge during 7-day trial</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── GuideLearnMoreDialog ──────────────────────────────────────────────────────
function GuideLearnMoreDialog({ open, onClose, onRegister }: { open: boolean; onClose: () => void; onRegister: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">How AfrolandX Expert Guides Work</DialogTitle>
          <DialogDescription>Everything you need to know about earning as a local guide</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-2">
            {[
              { step: "1", title: "Register & Get Verified", body: "Submit your application with your city, specialties, and languages. Our team verifies guides within 3 business days." },
              { step: "2", title: "Create Your Tours", body: "Build custom tour packages — street food walks, cultural visits, market tours, nightlife guides, or anything unique to your city." },
              { step: "3", title: "Accept Bookings", body: "Travellers book directly through AfrolandX. You receive confirmed bookings with guest details and payment guaranteed upfront." },
              { step: "4", title: "Earn & Grow", body: "Keep 85% of every booking fee. AfrolandX takes 15% to cover platform, insurance, and marketing. Build reviews to command higher prices." },
            ].map(s => (
              <div key={s.step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0">{s.step}</div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{s.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{s.body}</p>
                </div>
              </div>
            ))}
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <p className="font-semibold text-emerald-800 text-sm mb-1">Typical earnings</p>
              <p className="text-sm text-emerald-700">City tour guide in Lagos charging ₦15,000 per person with 5 guests earns <strong>₦63,750</strong> for a 3-hour tour.</p>
            </div>
          </div>
        </ScrollArea>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl" onClick={() => { onClose(); onRegister(); }}>
            <Users className="h-4 w-4 mr-2" /> Register as a Guide
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DiscoverAfrica() {
  // ── Discovery state ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState("NG");
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeRegion, setActiveRegion] = useState<string>("all");
  const resultsRef = useRef<HTMLDivElement>(null);
  const dealsRef = useRef<HTMLDivElement>(null);

  // ── Monetization dialog state ─────────────────────────────────────────────
  const [bookingDeal, setBookingDeal] = useState<DealInfo | null>(null);
  const [inquiryType, setInquiryType] = useState<string | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [showGuideLearnMore, setShowGuideLearnMore] = useState(false);

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

      {/* ══ REVENUE STREAM 1: AfrolandX Travel Deals (Commission-based bookings) ══ */}
      <div className="bg-white border-b" ref={dealsRef}>
        <div className="container mx-auto px-4 max-w-7xl py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5 text-rose-500" />
              <h2 className="font-bold text-gray-900">AfrolandX Exclusive Deals</h2>
              <Badge className="bg-rose-100 text-rose-700 border-0 text-xs font-semibold">Save up to 40%</Badge>
            </div>
            <button
              className="text-xs text-emerald-600 font-semibold flex items-center gap-1 hover:underline"
              onClick={() => dealsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              See all deals <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { emoji:"🏨", title:"Lagos Luxury Stay", sub:"Eko Hotels & Suites", off:"25%", badge:"Hotel Deal", color:"from-blue-500 to-indigo-600", country:"Nigeria", type:"hotel" },
              { emoji:"🍽️", title:"Dinner for Two", sub:"Nkoyo Restaurant, Abuja", off:"30%", badge:"Dining Deal", color:"from-amber-500 to-orange-600", country:"Nigeria", type:"restaurant" },
              { emoji:"✈️", title:"Cairo City Tour", sub:"Guided Pyramid Experience", off:"20%", badge:"Tour Deal", color:"from-yellow-500 to-amber-600", country:"Egypt", type:"tour" },
              { emoji:"🏖️", title:"Cape Town Getaway", sub:"V&A Waterfront Hotel", off:"35%", badge:"Stay & Explore", color:"from-sky-500 to-blue-600", country:"S. Africa", type:"hotel" },
              { emoji:"🌿", title:"Nairobi Safari", sub:"Maasai Mara Day Trip", off:"15%", badge:"Adventure Deal", color:"from-emerald-500 to-teal-600", country:"Kenya", type:"adventure" },
              { emoji:"☕", title:"Marrakech Medina Tour", sub:"Old City Walking Guide", off:"40%", badge:"Experience", color:"from-rose-500 to-pink-600", country:"Morocco", type:"tour" },
            ].map((deal, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-56 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer group"
                onClick={() => setBookingDeal({ title: deal.title, emoji: deal.emoji, badge: deal.badge, off: deal.off, country: deal.country, type: deal.type })}
              >
                <div className={`h-28 bg-gradient-to-br ${deal.color} flex flex-col items-center justify-center relative`}>
                  <span className="text-4xl group-hover:scale-110 transition-transform duration-300">{deal.emoji}</span>
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-white/90 text-gray-800 border-0 text-xs font-bold shadow">{deal.badge}</Badge>
                  </div>
                  <div className="absolute top-2 right-2 bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow">
                    -{deal.off}
                  </div>
                </div>
                <div className="bg-white p-3">
                  <p className="font-bold text-sm text-gray-900 line-clamp-1">{deal.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{deal.sub}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-emerald-600 font-semibold">{deal.country}</span>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3"
                      onClick={e => { e.stopPropagation(); setBookingDeal({ title: deal.title, emoji: deal.emoji, badge: deal.badge, off: deal.off, country: deal.country, type: deal.type }); }}
                    >Book</Button>
                  </div>
                </div>
              </div>
            ))}
            {/* CTA to list your own deal */}
            <div
              className="flex-shrink-0 w-44 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-300 bg-emerald-50 flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-emerald-100 transition-all group"
              onClick={() => setInquiryType("deal_listing")}
            >
              <Tag className="h-8 w-8 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-bold text-emerald-700 text-center">List a Deal</p>
              <p className="text-xs text-emerald-600 text-center mt-1">Reach 50K+ travellers</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            AfrolandX earns a small commission on bookings made through these deals. Partners keep 85–95% of the booking value.
          </p>
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
                    <>
                      <div key={place.id} className="break-inside-avoid mb-4">
                        <PlaceCard
                          place={place}
                          tall={idx % 5 === 0}
                          onClick={() => setSelectedPlace(place)}
                        />
                      </div>
                      {/* ══ REVENUE STREAM 3: "Claim Your Business" inline ad (every 8th card) ══ */}
                      {idx > 0 && (idx + 1) % 8 === 0 && (
                        <div key={`claim-${idx}`} className="break-inside-avoid mb-4">
                          <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 flex flex-col items-center text-center cursor-pointer hover:border-emerald-500 hover:shadow-lg transition-all group">
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-emerald-200 transition-colors">
                              <Building2 className="h-6 w-6 text-emerald-600" />
                            </div>
                            <p className="font-bold text-gray-900 text-sm mb-1">Is this your business?</p>
                            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                              Claim your listing, add photos, respond to reviews and get discovered by thousands.
                            </p>
                            <div className="space-y-1 w-full mb-3">
                              {["Priority placement in search", "Direct booking link", "Analytics dashboard"].map(f => (
                                <div key={f} className="flex items-center gap-2 text-xs text-emerald-700">
                                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" />{f}
                                </div>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 rounded-xl w-full text-xs"
                              onClick={() => setInquiryType("business_claim")}
                            >
                              Claim Free Listing
                            </Button>
                            <p className="text-xs text-gray-400 mt-2">Free tier available · Premium from ₦5,000/mo</p>
                          </div>
                        </div>
                      )}
                    </>
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

          {/* ══ REVENUE STREAM 2: Sponsored Destination Feature (Tourism board paid placement) ══ */}
          <div className="relative rounded-2xl overflow-hidden mb-6 cursor-pointer group shadow-xl hover:shadow-2xl transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600" />
            <img
              src={lf("Nigeria,Lagos,Africa,culture", 42)}
              alt="Featured Destination"
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              style={{ opacity: 0 }}
              onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "0.4"; }}
            />
            <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-yellow-400 text-yellow-900 border-0 font-bold text-xs shadow">
                    ⭐ Sponsored Destination
                  </Badge>
                  <Badge className="bg-white/20 text-white border-white/30 text-xs">
                    Featured Partner
                  </Badge>
                </div>
                <h3 className="text-2xl font-black text-white mb-1">🇳🇬 Discover Nigeria</h3>
                <p className="text-white/80 text-sm mb-3">
                  From Lagos's vibrant nightlife to Abuja's modern skyline and Calabar's cultural festivals — Nigeria is calling.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["🏙️ Lagos", "🏛️ Abuja", "🎭 Calabar", "🌊 Port Harcourt"].map(tag => (
                    <span key={tag} className="px-3 py-1 bg-white/15 text-white text-xs rounded-full border border-white/20">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  className="bg-white text-orange-600 hover:bg-white/90 font-bold rounded-xl shadow-lg px-6"
                  onClick={() => { selectCountry("NG"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                >
                  Explore Now <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                <p className="text-white/60 text-xs text-center">Promoted by Nigeria Tourism</p>
              </div>
            </div>
          </div>

          {/* "Feature your destination" upsell note */}
          <p className="text-xs text-gray-400 text-right mb-4">
            <span
              className="font-semibold text-emerald-600 cursor-pointer hover:underline"
              onClick={() => setInquiryType("destination_feature")}
            >Feature your country or city here</span> — reach 50,000+ monthly travellers.
          </p>

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

        {/* ══ REVENUE STREAM 4: Become a Local Expert Guide (Platform takes 15% fee) ══ */}
        <div className="mt-14 rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-600" />
          <img
            src={lf("Africa,guide,tour,culture,people", 77)}
            alt="Local Guides"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0 }}
            onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
          />
          <div className="relative p-8 md:p-12">
            <div className="max-w-2xl">
              <Badge className="bg-yellow-400 text-yellow-900 border-0 font-bold mb-4">New Opportunity</Badge>
              <h2 className="text-3xl font-black text-white mb-3">
                Turn Your Local Knowledge Into Income
              </h2>
              <p className="text-white/80 text-base mb-6 leading-relaxed">
                Are you a local in Lagos, Nairobi, Cairo, Cape Town or any African city? 
                Register as an AfrolandX Expert Guide and earn by showing visitors the real, 
                authentic side of your city — street food, hidden markets, cultural tours and more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
                {[
                  { icon: "💰", title: "Keep 85% of fees", desc: "AfrolandX takes only a 15% platform fee per tour" },
                  { icon: "📅", title: "Set your schedule", desc: "Accept bookings on your own terms, any time" },
                  { icon: "⭐", title: "Build your reputation", desc: "Collect reviews and grow your guide profile" },
                ].map(b => (
                  <div key={b.title} className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/15">
                    <span className="text-2xl mb-2 block">{b.icon}</span>
                    <p className="font-bold text-white text-sm mb-1">{b.title}</p>
                    <p className="text-white/70 text-xs leading-relaxed">{b.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold rounded-xl px-6 shadow-lg"
                  onClick={() => setInquiryType("guide_registration")}
                >
                  <Users className="h-4 w-4 mr-2" /> Register as a Guide
                </Button>
                <Button
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/15 rounded-xl"
                  onClick={() => setShowGuideLearnMore(true)}
                >
                  Learn more
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ══ REVENUE STREAM 5: Explorer Premium Membership (Monthly subscription) ══ */}
        <div className="mt-10 mb-6">
          <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 md:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-5 w-5 text-yellow-400" />
                <Badge className="bg-yellow-400 text-yellow-900 border-0 font-bold">Premium</Badge>
                <span className="text-white/60 text-xs">Monthly subscription · ₦2,500/mo</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
                AfrolandX Explorer Premium
              </h2>
              <p className="text-white/70 text-sm mb-6 max-w-xl">
                Unlock the full power of AfrolandX Discover — curated city guides, exclusive deals, 
                offline access and priority support for travellers who want more.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
                {[
                  { icon: <Sparkles className="h-5 w-5 text-yellow-400" />, title: "Curated City Guides", desc: "Expert-written guides for 20+ African cities" },
                  { icon: <BadgePercent className="h-5 w-5 text-rose-400" />, title: "Members-Only Deals", desc: "Exclusive discounts you won't find anywhere else" },
                  { icon: <TrendingUp className="h-5 w-5 text-emerald-400" />, title: "Trending Alerts", desc: "Get notified when hot new places open nearby" },
                  { icon: <Star className="h-5 w-5 text-sky-400" />, title: "Priority Listings", desc: "Your business listed at the top of every search" },
                ].map(f => (
                  <div key={f.title} className="bg-white/10 rounded-2xl p-4 border border-white/15 backdrop-blur-sm">
                    <div className="mb-2">{f.icon}</div>
                    <p className="font-bold text-white text-sm mb-1">{f.title}</p>
                    <p className="text-white/60 text-xs leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Button
                  className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-black rounded-xl px-8 py-5 text-base shadow-xl"
                  onClick={() => setShowPremium(true)}
                >
                  <Crown className="h-4 w-4 mr-2" /> Upgrade to Premium — ₦2,500/mo
                </Button>
                <div className="text-white/60 text-xs">
                  Cancel anytime · 7-day free trial
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <PlaceDetailsDialog
        place={selectedPlace}
        open={!!selectedPlace}
        onClose={() => setSelectedPlace(null)}
      />

      {/* ── Monetization dialogs ───────────────────────────────────────────── */}
      <BookingDialog
        deal={bookingDeal}
        open={!!bookingDeal}
        onClose={() => setBookingDeal(null)}
      />
      <InquiryDialog
        configKey={inquiryType}
        open={!!inquiryType}
        onClose={() => setInquiryType(null)}
      />
      <PremiumDialog
        open={showPremium}
        onClose={() => setShowPremium(false)}
      />
      <GuideLearnMoreDialog
        open={showGuideLearnMore}
        onClose={() => setShowGuideLearnMore(false)}
        onRegister={() => setInquiryType("guide_registration")}
      />
    </div>
  );
}
