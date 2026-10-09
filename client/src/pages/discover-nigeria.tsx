import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  MapPin,
  Star,
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
  Loader2,
  Navigation,
  X,
  ChevronRight,
} from "lucide-react";

interface Place {
  id: string;
  displayName: { text: string; languageCode?: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
  priceLevel?: string;
  primaryType?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  editorialSummary?: { text: string };
  reviews?: Array<{
    text: { text: string };
    rating: number;
    authorAttribution: { displayName: string };
    relativePublishTimeDescription: string;
  }>;
}

const PLACE_CATEGORIES = [
  { id: "hotel", label: "Hotels", icon: Hotel, query: "hotels" },
  { id: "shopping_mall", label: "Malls", icon: ShoppingBag, query: "shopping malls" },
  { id: "restaurant", label: "Restaurants", icon: Utensils, query: "restaurants" },
  { id: "tourist_attraction", label: "Attractions", icon: Landmark, query: "tourist attractions" },
  { id: "airport", label: "Airports", icon: Plane, query: "airports" },
  { id: "car_rental", label: "Car Rentals", icon: Car, query: "car rentals" },
  { id: "cafe", label: "Cafes", icon: Coffee, query: "cafes" },
  { id: "night_club", label: "Nightlife", icon: Music, query: "nightclubs lounges" },
];

const NIGERIAN_CITIES = [
  { name: "Lagos", lat: 6.5244, lng: 3.3792 },
  { name: "Abuja", lat: 9.0765, lng: 7.3986 },
  { name: "Port Harcourt", lat: 4.8156, lng: 7.0498 },
  { name: "Kano", lat: 12.0022, lng: 8.5919 },
  { name: "Ibadan", lat: 7.3775, lng: 3.9470 },
  { name: "Enugu", lat: 6.4584, lng: 7.5464 },
  { name: "Calabar", lat: 4.9757, lng: 8.3417 },
  { name: "Benin City", lat: 6.3350, lng: 5.6270 },
];

function PlaceCard({ place, onClick }: { place: Place; onClick: () => void }) {
  const photoUrl = place.photos?.[0] 
    ? `/api/places/photo/${place.photos[0].name}?maxWidth=400&maxHeight=300`
    : null;

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
      onClick={onClick}
      data-testid={`place-card-${place.id}`}
    >
      <div className="relative h-48 bg-gradient-to-br from-emerald-100 to-amber-100 rounded-t-lg overflow-hidden">
        {photoUrl ? (
          <img 
            src={photoUrl} 
            alt={place.displayName.text}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Building2 className="h-16 w-16 text-emerald-600/30" />
          </div>
        )}
        {place.currentOpeningHours && (
          <Badge 
            className={`absolute top-2 right-2 ${
              place.currentOpeningHours.openNow 
                ? 'bg-green-500' 
                : 'bg-gray-500'
            }`}
          >
            {place.currentOpeningHours.openNow ? 'Open Now' : 'Closed'}
          </Badge>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg line-clamp-1" data-testid="place-name">
          {place.displayName.text}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1 flex items-start gap-1">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {place.formattedAddress}
        </p>
        <div className="flex items-center justify-between mt-3">
          {place.rating && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-medium">{place.rating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">
                ({place.userRatingCount || 0})
              </span>
            </div>
          )}
          {place.priceLevel && (
            <Badge variant="outline" className="text-emerald-600">
              {place.priceLevel.replace('PRICE_LEVEL_', '')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlaceDetailsDialog({ 
  place, 
  open, 
  onClose 
}: { 
  place: Place | null; 
  open: boolean; 
  onClose: () => void;
}) {
  const { data: details, isLoading } = useQuery<Place>({
    queryKey: ['/api/places', place?.id],
    enabled: !!place?.id && open,
  });

  const fullPlace: Place | null = details || place;
  if (!fullPlace) return null;

  const photoUrl = fullPlace.photos?.[0] 
    ? `/api/places/photo/${fullPlace.photos[0].name}?maxWidth=800&maxHeight=400`
    : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <div className="relative h-48 bg-gradient-to-br from-emerald-100 to-amber-100">
          {photoUrl && (
            <img 
              src={photoUrl} 
              alt={fullPlace.displayName.text}
              className="w-full h-full object-cover"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-white/80 hover:bg-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="p-6 space-y-4">
            <DialogHeader className="p-0">
              <DialogTitle className="text-2xl" data-testid="place-details-title">
                {fullPlace.displayName.text}
              </DialogTitle>
            </DialogHeader>

            {fullPlace.rating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(fullPlace.rating!) 
                          ? 'fill-amber-400 text-amber-400' 
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium">{fullPlace.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">
                  ({fullPlace.userRatingCount || 0} reviews)
                </span>
              </div>
            )}

            {fullPlace.editorialSummary?.text && (
              <p className="text-muted-foreground">
                {fullPlace.editorialSummary.text}
              </p>
            )}

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-emerald-600 mt-0.5" />
                <span>{fullPlace.formattedAddress}</span>
              </div>

              {fullPlace.internationalPhoneNumber && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-emerald-600" />
                  <a 
                    href={`tel:${fullPlace.internationalPhoneNumber}`}
                    className="text-emerald-600 hover:underline"
                    data-testid="place-phone"
                  >
                    {fullPlace.internationalPhoneNumber}
                  </a>
                </div>
              )}

              {fullPlace.websiteUri && (
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-emerald-600" />
                  <a 
                    href={fullPlace.websiteUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline truncate"
                    data-testid="place-website"
                  >
                    {fullPlace.websiteUri}
                  </a>
                </div>
              )}

              {fullPlace.currentOpeningHours?.weekdayDescriptions && (
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <Badge className={fullPlace.currentOpeningHours.openNow ? 'bg-green-500' : 'bg-gray-500'}>
                      {fullPlace.currentOpeningHours.openNow ? 'Open Now' : 'Closed'}
                    </Badge>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {fullPlace.currentOpeningHours.weekdayDescriptions.map((day, i) => (
                        <li key={i}>{day}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {fullPlace.reviews && fullPlace.reviews.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-3">Recent Reviews</h4>
                <div className="space-y-4">
                  {fullPlace.reviews.slice(0, 3).map((review, i) => (
                    <div key={i} className="border-l-2 border-emerald-200 pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star 
                              key={j}
                              className={`h-3 w-3 ${
                                j < review.rating 
                                  ? 'fill-amber-400 text-amber-400' 
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium">
                          {review.authorAttribution.displayName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {review.relativePublishTimeDescription}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {review.text.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullPlace.displayName.text)}&query_place_id=${fullPlace.id}`,
                    '_blank'
                  );
                }}
                data-testid="view-on-map-button"
              >
                <Navigation className="h-4 w-4 mr-2" />
                View on Google Maps
              </Button>
              {fullPlace.internationalPhoneNumber && (
                <Button 
                  variant="outline"
                  onClick={() => window.open(`tel:${fullPlace.internationalPhoneNumber}`, '_self')}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
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
  const [selectedCity, setSelectedCity] = useState(NIGERIAN_CITIES[0]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation not available:", error);
        }
      );
    }
  }, []);

  const searchParams = new URLSearchParams();
  if (searchQuery) {
    searchParams.set('query', searchQuery);
  } else if (activeCategory) {
    const category = PLACE_CATEGORIES.find(c => c.id === activeCategory);
    if (category) {
      searchParams.set('query', `${category.query} in ${selectedCity.name}`);
    }
  }
  
  const location = userLocation || selectedCity;
  searchParams.set('lat', location.lat.toString());
  searchParams.set('lng', location.lng.toString());

  const { data: placesData, isLoading, error } = useQuery({
    queryKey: ['/api/places/search', searchQuery, activeCategory, selectedCity.name, userLocation?.lat],
    queryFn: async () => {
      if (!searchQuery && !activeCategory) return { places: [] };
      const response = await fetch(`/api/places/search?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch places');
      return response.json();
    },
    enabled: !!(searchQuery || activeCategory),
  });

  const places: Place[] = placesData?.places || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveCategory(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-amber-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="discover-title">
              Discover Africa
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Find hotels, malls, restaurants, and amazing places across Africa
            </p>
            
            <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search for hotels, restaurants, malls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-lg text-gray-900 rounded-full shadow-xl"
                data-testid="search-input"
              />
              <Button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-emerald-600 hover:bg-emerald-700"
                data-testid="search-button"
              >
                Search
              </Button>
            </form>

            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {NIGERIAN_CITIES.map((city) => (
                <Button
                  key={city.name}
                  variant={selectedCity.name === city.name ? "secondary" : "ghost"}
                  size="sm"
                  className={`rounded-full ${
                    selectedCity.name === city.name 
                      ? 'bg-white text-emerald-700' 
                      : 'text-white/90 hover:text-white hover:bg-white/20'
                  }`}
                  onClick={() => setSelectedCity(city)}
                  data-testid={`city-${city.name.toLowerCase()}`}
                >
                  {city.name}
                </Button>
              ))}
              {userLocation && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-white/90 hover:text-white hover:bg-white/20"
                  onClick={() => setSelectedCity({ name: "My Location", ...userLocation })}
                  data-testid="my-location-button"
                >
                  <Navigation className="h-4 w-4 mr-1" />
                  Near Me
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {PLACE_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={activeCategory === category.id ? "default" : "outline"}
                  className={`flex flex-col h-24 gap-2 ${
                    activeCategory === category.id 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                      : 'hover:border-emerald-600 hover:text-emerald-600'
                  }`}
                  onClick={() => {
                    setActiveCategory(activeCategory === category.id ? null : category.id);
                    setSearchQuery("");
                  }}
                  data-testid={`category-${category.id}`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm">{category.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {(searchQuery || activeCategory) && (
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {searchQuery 
                  ? `Results for "${searchQuery}"` 
                  : `${PLACE_CATEGORIES.find(c => c.id === activeCategory)?.label} in ${selectedCity.name}`}
              </h2>
              {places.length > 0 && (
                <span className="text-muted-foreground">
                  {places.length} places found
                </span>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-48 rounded-t-lg" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card className="p-8 text-center">
            <p className="text-red-500 mb-4">Failed to load places. Please try again.</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Card>
        )}

        {!isLoading && !error && places.length === 0 && (searchQuery || activeCategory) && (
          <Card className="p-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No places found</h3>
            <p className="text-muted-foreground mb-4">
              Try a different search term or select another city
            </p>
          </Card>
        )}

        {!isLoading && places.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                onClick={() => setSelectedPlace(place)}
              />
            ))}
          </div>
        )}

        {!searchQuery && !activeCategory && (
          <Card className="p-12 text-center bg-gradient-to-br from-emerald-50 to-amber-50">
            <Search className="h-12 w-12 mx-auto text-emerald-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Start Exploring Africa</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Search for any place or select a category above to discover amazing 
              hotels, restaurants, malls, and attractions across Africa.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => setActiveCategory('hotel')}
                className="rounded-full"
              >
                <Hotel className="h-4 w-4 mr-2" />
                Find Hotels
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setActiveCategory('restaurant')}
                className="rounded-full"
              >
                <Utensils className="h-4 w-4 mr-2" />
                Find Restaurants
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setActiveCategory('shopping_mall')}
                className="rounded-full"
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Find Malls
              </Button>
            </div>
          </Card>
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
