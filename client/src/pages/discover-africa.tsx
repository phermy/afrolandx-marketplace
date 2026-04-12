import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
  Search, MapPin, Phone, Globe, Clock, Hotel, ShoppingBag,
  Utensils, Landmark, Car, Plane, Coffee, Music, Navigation,
  X, ExternalLink, CheckCircle2, PhoneCall, List, Map,
} from "lucide-react";
import { africaLocations, getCountriesByRegion, africanRegions } from "@shared/africaLocations";

// Fix Leaflet default marker icons for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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
}

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
  hotel: "🏨", hostel: "🛏️", motel: "🏩", guest_house: "🏠",
  mall: "🛍️", supermarket: "🛒", department_store: "🏬", marketplace: "🏪",
  restaurant: "🍽️", fast_food: "🍔", food_court: "🍱",
  attraction: "🏛️", museum: "🏛️", theme_park: "🎡", monument: "🗿", ruins: "🏚️",
  aerodrome: "✈️", car_rental: "🚗", cafe: "☕",
  nightclub: "🎵", bar: "🍺", pub: "🍺",
};

function getPlaceEmoji(type?: string) {
  return SUBTYPE_EMOJI[type || ""] || "📍";
}

function createEmojiMarker(emoji: string, active = false) {
  return L.divIcon({
    html: `<div style="
      font-size:22px;line-height:1;
      background:${active ? "#065f46" : "white"};
      border:2px solid ${active ? "#065f46" : "#d1d5db"};
      border-radius:50%;
      width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      cursor:pointer;
    ">${emoji}</div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center[0], center[1], zoom]);
  return null;
}

function formatShortAddress(full: string): string {
  const parts = full.split(",").map(s => s.trim()).filter(Boolean);
  return parts.length <= 2 ? full : parts.slice(0, 3).join(", ");
}

// Unique gradient per card based on place name hash
const CARD_GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-rose-500 to-pink-600",
  "from-lime-500 to-green-600",
  "from-cyan-500 to-teal-600",
  "from-fuchsia-500 to-purple-600",
  "from-orange-400 to-red-500",
  "from-indigo-500 to-violet-600",
  "from-teal-400 to-emerald-600",
  "from-yellow-500 to-amber-600",
];

function getCardGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length];
}

function PlaceDetailsDialog({ place, open, onClose }: { place: Place | null; open: boolean; onClose: () => void }) {
  if (!place) return null;
  const emoji = getPlaceEmoji(place.primaryType);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 rounded-2xl">
        <div className="relative h-32 bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
          <div className="text-center">
            <span className="text-5xl">{emoji}</span>
            <p className="text-white/80 text-sm mt-1 capitalize">{place.primaryType?.replace(/_/g, " ")}</p>
          </div>
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 bg-white/20 hover:bg-white/40 text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="max-h-[calc(90vh-128px)]">
          <div className="p-5 space-y-4">
            <DialogHeader className="p-0">
              <DialogTitle className="text-xl">{place.displayName.text}</DialogTitle>
            </DialogHeader>
            {place.editorialSummary?.text && (
              <p className="text-muted-foreground text-sm">{place.editorialSummary.text}</p>
            )}
            <div className="space-y-2">
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
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Phone</p>
                    <a href={`tel:${place.internationalPhoneNumber}`} className="text-sm text-emerald-600 hover:underline font-medium">{place.internationalPhoneNumber}</a>
                  </div>
                </div>
              )}
              {place.websiteUri && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
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
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Clock className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Hours</p>
                    {place.currentOpeningHours.weekdayDescriptions.map((d, i) => (
                      <p key={i} className="text-sm text-muted-foreground">{d}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                const { latitude: lat, longitude: lon } = place.location;
                window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=17`, "_blank");
              }}>
                <Navigation className="h-4 w-4 mr-2" /> Open in Map
              </Button>
              {place.internationalPhoneNumber && (
                <Button variant="outline" className="border-emerald-200 text-emerald-700" onClick={() => window.open(`tel:${place.internationalPhoneNumber}`, "_self")}>
                  <PhoneCall className="h-4 w-4" />
                </Button>
              )}
              {place.websiteUri && (
                <Button variant="outline" className="border-emerald-200 text-emerald-700" onClick={() => window.open(place.websiteUri, "_blank")}>
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
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  const selectedCountry = africaLocations[selectedCountryCode];
  const selectedCity = useMemo(() => {
    if (!selectedCityName) return selectedCountry.cities[0];
    return selectedCountry.cities.find(c => c.name === selectedCityName) || selectedCountry.cities[0];
  }, [selectedCountry, selectedCityName]);

  const mapCenter: [number, number] = [selectedCity.lat, selectedCity.lng];

  const { data: placesData, isLoading } = useQuery({
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
    staleTime: 5 * 60 * 1000,
  });

  const places: Place[] = placesData?.places || [];
  const hasSearch = !!(searchQuery || activeCategory);

  function openPlace(place: Place) {
    setActiveMarkerId(place.id);
    setSelectedPlace(place);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-amber-500 text-white">
        <div className="container mx-auto px-4 py-10 max-w-4xl">
          <div className="text-center mb-6">
            <p className="text-emerald-200 text-xs font-semibold uppercase tracking-widest mb-1">Explore the Continent</p>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Discover Africa</h1>
            <p className="text-white/80">Hotels, restaurants, attractions and more across {selectedCountry.name}</p>
          </div>

          <div className="flex justify-center mb-5">
            <Select value={selectedCountryCode} onValueChange={(v) => { setSelectedCountryCode(v); setSelectedCityName(null); }}>
              <SelectTrigger className="w-52 bg-white/15 border-white/30 text-white backdrop-blur-sm hover:bg-white/25">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                {africanRegions.map((region) => (
                  <SelectGroup key={region}>
                    <SelectLabel className="text-emerald-600 font-semibold text-xs uppercase">{region}</SelectLabel>
                    {getCountriesByRegion(region).map((country) => (
                      <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setActiveCategory(null); }} className="relative max-w-2xl mx-auto mb-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder={`Search in ${selectedCountry.name}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-28 py-6 text-base text-gray-900 rounded-full shadow-xl border-0"
            />
            <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-5">
              Search
            </Button>
          </form>

          <div className="flex flex-wrap justify-center gap-2">
            {selectedCountry.cities.map((city) => (
              <button
                key={city.name}
                onClick={() => setSelectedCityName(city.name)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCity.name === city.name ? "bg-white text-emerald-700 shadow-sm" : "bg-white/15 text-white/90 hover:bg-white/25"
                }`}
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category Bar */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide">
            {PLACE_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(isActive ? null : cat.id); setSearchQuery(""); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all flex-shrink-0 ${
                    isActive ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50/50"
                  }`}
                >
                  <span>{cat.emoji}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 py-5 max-w-7xl">

        {/* View toggle when there are results */}
        {hasSearch && (
          <div className="flex items-center justify-between mb-4">
            <div>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Searching…</p>
              ) : places.length > 0 ? (
                <p className="text-sm font-medium text-gray-700">
                  <span className="font-bold text-emerald-700">{places.length}</span> places found in {selectedCity.name}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No results found</p>
              )}
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "map" ? "bg-white shadow text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Map className="h-4 w-4" /> Map
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "list" ? "bg-white shadow text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}
              >
                <List className="h-4 w-4" /> List
              </button>
            </div>
          </div>
        )}

        {/* Map + Results split */}
        {hasSearch && viewMode === "map" && (
          <div className="flex flex-col lg:flex-row gap-4" style={{ height: "calc(100vh - 360px)", minHeight: "500px" }}>

            {/* Map */}
            <div className="flex-1 rounded-xl overflow-hidden shadow-md border border-gray-200 min-h-[300px]">
              <MapContainer
                center={mapCenter}
                zoom={12}
                style={{ height: "100%", width: "100%" }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapViewController center={mapCenter} zoom={12} />
                {places.map((place) => (
                  <Marker
                    key={place.id}
                    position={[place.location.latitude, place.location.longitude]}
                    icon={createEmojiMarker(getPlaceEmoji(place.primaryType), activeMarkerId === place.id)}
                    eventHandlers={{ click: () => openPlace(place) }}
                  />
                ))}
              </MapContainer>
            </div>

            {/* Sidebar list */}
            <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: "100%" }}>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="border-0 shadow-sm">
                    <CardContent className="p-3 flex gap-3">
                      <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                places.map((place) => {
                  const emoji = getPlaceEmoji(place.primaryType);
                  const isActive = activeMarkerId === place.id;
                  return (
                    <Card
                      key={place.id}
                      className={`cursor-pointer transition-all border-2 ${isActive ? "border-emerald-500 shadow-md" : "border-transparent shadow-sm hover:border-emerald-200"}`}
                      onClick={() => openPlace(place)}
                    >
                      <CardContent className="p-3 flex gap-3">
                        <div className="h-12 w-12 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 text-2xl">
                          {emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm line-clamp-1">{place.displayName.text}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />{formatShortAddress(place.formattedAddress)}
                          </p>
                          <div className="flex gap-2 mt-1">
                            {place.internationalPhoneNumber && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                            {place.currentOpeningHours?.weekdayDescriptions?.length && <Clock className="h-3 w-3 text-emerald-500" />}
                            {place.websiteUri && <Globe className="h-3 w-3 text-emerald-500" />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* List view */}
        {hasSearch && viewMode === "list" && (
          <>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden border-0 shadow-md">
                    <Skeleton className="h-36 w-full" />
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {places.map((place) => {
                  const emoji = getPlaceEmoji(place.primaryType);
                  const gradient = getCardGradient(place.id);
                  return (
                    <Card key={place.id} className="cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden border-0 shadow-md group" onClick={() => openPlace(place)}>
                      <div className={`h-36 bg-gradient-to-br ${gradient} flex flex-col items-center justify-center relative gap-1`}>
                        <span className="text-5xl drop-shadow-sm">{emoji}</span>
                        <span className="text-white/80 text-xs font-medium capitalize">{place.primaryType?.replace(/_/g, " ") || "Place"}</span>
                        {place.currentOpeningHours?.weekdayDescriptions?.length && (
                          <Badge className="absolute top-2 right-2 bg-green-500/90 text-white border-0 text-xs">
                            Hours available
                          </Badge>
                        )}
                        {place.websiteUri && (
                          <Badge className="absolute top-2 left-2 bg-white/20 text-white border-white/30 text-xs backdrop-blur-sm">
                            <Globe className="h-2.5 w-2.5 mr-1" />Online
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-emerald-700">{place.displayName.text}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-emerald-500 flex-shrink-0" />{formatShortAddress(place.formattedAddress)}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          {place.internationalPhoneNumber && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1"><Phone className="h-3 w-3" />Call</span>
                          )}
                          {place.websiteUri && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1"><Globe className="h-3 w-3" />Web</span>
                          )}
                        </div>
                        {place.editorialSummary?.text && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">{place.editorialSummary.text}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Empty / initial state */}
        {!hasSearch && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-full max-w-4xl rounded-xl overflow-hidden shadow-md border border-gray-200 mb-8" style={{ height: "360px" }}>
              <MapContainer center={mapCenter} zoom={6} style={{ height: "100%", width: "100%" }} zoomControl={false} scrollWheelZoom={false}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapViewController center={mapCenter} zoom={6} />
              </MapContainer>
            </div>
            <h3 className="text-xl font-semibold mb-2">Explore {selectedCountry.name}</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Pick a category from the bar above, or search for a specific place to see it on the map.
            </p>
          </div>
        )}

        {!hasSearch || places.length === 0 && !isLoading && hasSearch ? null : null}
      </div>

      <PlaceDetailsDialog place={selectedPlace} open={!!selectedPlace} onClose={() => { setSelectedPlace(null); setActiveMarkerId(null); }} />
    </div>
  );
}
