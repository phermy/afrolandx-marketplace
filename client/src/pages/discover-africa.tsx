import { useState, useMemo } from "react";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  Phone,
  Globe,
  Clock,
  Building2,
  Hotel,
  ShoppingBag,
  Utensils,
  Landmark,
  Car,
  Plane,
  Coffee,
  Music,
  Navigation,
  X,
  ExternalLink,
  CheckCircle2,
  PhoneCall,
} from "lucide-react";
import { africaLocations, getCountriesByRegion, africanRegions, type Country, type City } from "@shared/africaLocations";

interface Place {
  id: string;
  displayName: { text: string; languageCode?: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryType?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  editorialSummary?: { text: string };
}

const PLACE_CATEGORIES = [
  { id: "hotel",            label: "Hotels",       icon: Hotel,       emoji: "🏨", color: "from-blue-500 to-indigo-600",    light: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "shopping_mall",   label: "Malls",        icon: ShoppingBag, emoji: "🛍️", color: "from-pink-500 to-rose-600",      light: "bg-pink-50 text-pink-700 border-pink-200" },
  { id: "restaurant",      label: "Restaurants",  icon: Utensils,    emoji: "🍽️", color: "from-orange-500 to-amber-600",   light: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "tourist_attraction", label: "Attractions", icon: Landmark,  emoji: "🏛️", color: "from-emerald-500 to-teal-600",  light: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "airport",         label: "Airports",     icon: Plane,       emoji: "✈️", color: "from-sky-500 to-cyan-600",       light: "bg-sky-50 text-sky-700 border-sky-200" },
  { id: "car_rental",      label: "Car Rentals",  icon: Car,         emoji: "🚗", color: "from-slate-500 to-gray-600",     light: "bg-slate-50 text-slate-700 border-slate-200" },
  { id: "cafe",            label: "Cafes",        icon: Coffee,      emoji: "☕", color: "from-yellow-600 to-amber-700",   light: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { id: "night_club",      label: "Nightlife",    icon: Music,       emoji: "🎵", color: "from-purple-500 to-violet-600",  light: "bg-purple-50 text-purple-700 border-purple-200" },
];

const TYPE_TO_CATEGORY: Record<string, string> = {
  hotel: "hotel", hostel: "hotel", motel: "hotel", guest_house: "hotel",
  mall: "shopping_mall", supermarket: "shopping_mall", department_store: "shopping_mall", marketplace: "shopping_mall",
  restaurant: "restaurant", fast_food: "restaurant", food_court: "restaurant",
  attraction: "tourist_attraction", museum: "tourist_attraction", theme_park: "tourist_attraction", monument: "tourist_attraction", ruins: "tourist_attraction",
  aerodrome: "airport",
  car_rental: "car_rental",
  cafe: "cafe",
  nightclub: "night_club", bar: "night_club", pub: "night_club",
};

function getCategoryMeta(primaryType?: string) {
  const categoryId = TYPE_TO_CATEGORY[primaryType || ""] || "";
  return PLACE_CATEGORIES.find(c => c.id === categoryId) || PLACE_CATEGORIES[0];
}

function formatShortAddress(full: string): string {
  const parts = full.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length <= 2) return full;
  return parts.slice(0, 3).join(", ");
}

function PlaceCard({ place, onClick }: { place: Place; onClick: () => void }) {
  const meta = getCategoryMeta(place.primaryType);
  const hasContact = !!(place.internationalPhoneNumber || place.websiteUri);
  const hasHours = !!(place.currentOpeningHours?.weekdayDescriptions?.length);
  const shortAddress = formatShortAddress(place.formattedAddress);

  return (
    <Card
      className="cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 group overflow-hidden border-0 shadow-md"
      onClick={onClick}
    >
      <div className={`relative h-36 bg-gradient-to-br ${meta.color} flex items-center justify-center`}>
        <div className="text-center">
          <span className="text-5xl drop-shadow-md">{meta.emoji}</span>
        </div>
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
        <Badge className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm text-white border-white/30 text-xs">
          {place.primaryType?.replace(/_/g, " ") || "Place"}
        </Badge>
        {hasHours && (
          <Badge className="absolute top-3 right-3 bg-green-500/90 text-white border-0 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Hours listed
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-base line-clamp-1 group-hover:text-emerald-700 transition-colors">
          {place.displayName.text}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-1 flex items-center gap-1">
          <MapPin className="h-3 w-3 flex-shrink-0 text-emerald-500" />
          {shortAddress}
        </p>

        {place.editorialSummary?.text && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">
            {place.editorialSummary.text}
          </p>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {hasContact && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Contact info
            </span>
          )}
          {!hasContact && !hasHours && (
            <span className="text-xs text-muted-foreground">Tap for directions</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlaceDetailsDialog({
  place,
  open,
  onClose,
}: {
  place: Place | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!place) return null;
  const meta = getCategoryMeta(place.primaryType);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 rounded-2xl">
        <div className={`relative h-36 bg-gradient-to-br ${meta.color} flex items-center justify-center`}>
          <div className="text-center">
            <span className="text-6xl drop-shadow-lg">{meta.emoji}</span>
            <p className="text-white/90 font-medium mt-1 capitalize text-sm">
              {place.primaryType?.replace(/_/g, " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="max-h-[calc(90vh-144px)]">
          <div className="p-5 space-y-4">
            <DialogHeader className="p-0">
              <DialogTitle className="text-xl leading-tight">
                {place.displayName.text}
              </DialogTitle>
            </DialogHeader>

            {place.editorialSummary?.text && (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {place.editorialSummary.text}
              </p>
            )}

            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Address</p>
                  <p className="text-sm">{place.formattedAddress}</p>
                </div>
              </div>

              {place.internationalPhoneNumber && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Phone className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Phone</p>
                    <a
                      href={`tel:${place.internationalPhoneNumber}`}
                      className="text-sm text-emerald-600 hover:underline font-medium"
                      onClick={e => e.stopPropagation()}
                    >
                      {place.internationalPhoneNumber}
                    </a>
                  </div>
                </div>
              )}

              {place.websiteUri && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Globe className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Website</p>
                    <a
                      href={place.websiteUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-600 hover:underline truncate block"
                      onClick={e => e.stopPropagation()}
                    >
                      {place.websiteUri.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </div>
                </div>
              )}

              {place.currentOpeningHours?.weekdayDescriptions?.length && (
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Clock className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Hours</p>
                    <div className="text-sm space-y-0.5">
                      {place.currentOpeningHours.weekdayDescriptions.map((d, i) => (
                        <p key={i} className="text-muted-foreground">{d}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  const { latitude: lat, longitude: lon } = place.location;
                  window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=17`, "_blank");
                }}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Open in Map
              </Button>
              {place.internationalPhoneNumber && (
                <Button
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => window.open(`tel:${place.internationalPhoneNumber}`, "_self")}
                >
                  <PhoneCall className="h-4 w-4" />
                </Button>
              )}
              {place.websiteUri && (
                <Button
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => window.open(place.websiteUri, "_blank")}
                >
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

export default function DiscoverAfrica() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState("NG");
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const selectedCountry = africaLocations[selectedCountryCode];
  const selectedCity = useMemo(() => {
    if (!selectedCityName) return selectedCountry.cities[0];
    return selectedCountry.cities.find(c => c.name === selectedCityName) || selectedCountry.cities[0];
  }, [selectedCountry, selectedCityName]);

  const activeCategoryMeta = PLACE_CATEGORIES.find(c => c.id === activeCategory);

  const { data: placesData, isLoading, error } = useQuery({
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
      else if (searchQuery) params.set("query", `${searchQuery} in ${selectedCity.name}, ${selectedCountry.name}`);
      const response = await fetch(`/api/places/search?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to fetch places");
      return data;
    },
    enabled: !!(searchQuery || activeCategory),
    staleTime: 5 * 60 * 1000,
  });

  const places: Place[] = placesData?.places || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveCategory(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-amber-500 text-white">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center mb-8">
            <p className="text-emerald-200 text-sm font-medium uppercase tracking-widest mb-2">Explore the Continent</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-3">Discover Africa</h1>
            <p className="text-white/80 text-lg">
              Hotels, restaurants, attractions and more across {selectedCountry.name}
            </p>
          </div>

          {/* Country Selector */}
          <div className="flex justify-center mb-6">
            <Select value={selectedCountryCode} onValueChange={(v) => { setSelectedCountryCode(v); setSelectedCityName(null); }}>
              <SelectTrigger className="w-56 bg-white/15 border-white/30 text-white backdrop-blur-sm hover:bg-white/25 transition-colors">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent className="max-h-[380px]">
                {africanRegions.map((region) => (
                  <SelectGroup key={region}>
                    <SelectLabel className="text-emerald-600 font-semibold text-xs uppercase tracking-wide">{region}</SelectLabel>
                    {getCountriesByRegion(region).map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder={`Search in ${selectedCountry.name}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-28 py-6 text-base text-gray-900 rounded-full shadow-xl border-0"
            />
            <Button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-5"
            >
              Search
            </Button>
          </form>

          {/* City Pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {selectedCountry.cities.map((city) => (
              <button
                key={city.name}
                onClick={() => setSelectedCityName(city.name)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCity.name === city.name
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "bg-white/15 text-white/90 hover:bg-white/25"
                }`}
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Category Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Browse by Category</h2>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {PLACE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(isActive ? null : cat.id); setSearchQuery(""); }}
                  className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl border-2 transition-all ${
                    isActive
                      ? "border-emerald-500 bg-emerald-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50"
                  }`}
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className={`text-xs font-medium text-center leading-tight ${isActive ? "text-emerald-700" : "text-gray-600"}`}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden border-0 shadow-md">
                  <Skeleton className="h-36 w-full" />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {(error || placesData?.warning) && !isLoading && (
          <div className="text-center py-16 max-w-sm mx-auto">
            <div className="text-5xl mb-4">🗺️</div>
            <h3 className="font-semibold text-lg mb-2">Map service temporarily unavailable</h3>
            <p className="text-muted-foreground text-sm">
              The location service is under high load. Please try again in a moment.
            </p>
          </div>
        )}

        {/* No results */}
        {!isLoading && !error && places.length === 0 && (searchQuery || activeCategory) && !placesData?.warning && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold mb-2">No places found</h3>
            <p className="text-muted-foreground text-sm">
              Try a different city, category, or search term.
            </p>
          </div>
        )}

        {/* Initial empty state */}
        {!isLoading && !error && places.length === 0 && !searchQuery && !activeCategory && (
          <div className="text-center py-16 max-w-sm mx-auto">
            <div className="text-6xl mb-4">🌍</div>
            <h3 className="text-xl font-semibold mb-2">Explore {selectedCountry.name}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Pick a category above or type in the search bar to find hotels, restaurants, malls and more.
            </p>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && places.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold">
                  {activeCategoryMeta
                    ? `${activeCategoryMeta.label} in ${selectedCity.name}`
                    : `Results in ${selectedCity.name}`}
                </h2>
                <p className="text-sm text-muted-foreground">{selectedCountry.name}</p>
              </div>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {places.length} {places.length === 1 ? "place" : "places"}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {places.map((place) => (
                <PlaceCard key={place.id} place={place} onClick={() => setSelectedPlace(place)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <PlaceDetailsDialog place={selectedPlace} open={!!selectedPlace} onClose={() => setSelectedPlace(null)} />
    </div>
  );
}
