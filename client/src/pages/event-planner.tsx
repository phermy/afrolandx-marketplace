import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Users,
  ShoppingBag,
  Star,
  Heart,
  Loader2,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import Navbar from "@/components/navbar";
import EventServices from "@/components/event-services";

const eventTypes = [
  { value: "wedding", label: "Wedding / Traditional Marriage", icon: Heart },
  { value: "naming_ceremony", label: "Naming Ceremony", icon: Star },
  { value: "festival", label: "Festival / Cultural Event", icon: Calendar },
  { value: "party", label: "Party / Celebration", icon: Calendar },
  { value: "burial", label: "Burial / Memorial", icon: Calendar },
  { value: "chieftaincy", label: "Chieftaincy Title", icon: Star },
  { value: "graduation", label: "Graduation Ceremony", icon: Star },
  { value: "engagement", label: "Engagement / Courtship", icon: Heart },
  { value: "corporate", label: "Corporate / Business Event", icon: Users },
  { value: "religious", label: "Religious / Church Event", icon: Calendar },
  { value: "others", label: "Others / Custom Event", icon: Calendar },
];

const eventSizes = [
  { value: "1", label: "Solo: Just me (1)" },
  { value: "2", label: "Couple (2)" },
  { value: "4", label: "Small family (3–4)" },
  { value: "6", label: "Family (5–6)" },
  { value: "10", label: "Extended family (7–10)" },
  { value: "15", label: "Wedding party / Bridal train (10–20)" },
  { value: "25", label: "Small group / Aso Ebi (20–30)" },
  { value: "50", label: "Large group (30–60)" },
  { value: "100", label: "Corporate / Community event (60+)" },
  { value: "others", label: "Others: custom size" },
];

// Country → currency mapping
const LOCATION_CURRENCIES: Record<string, { code: string; symbol: string; name: string }> = {
  NG: { code: "NGN", symbol: "₦", name: "Nigeria" },
  GH: { code: "GHS", symbol: "₵", name: "Ghana" },
  ZA: { code: "ZAR", symbol: "R", name: "South Africa" },
  KE: { code: "KES", symbol: "KSh", name: "Kenya" },
  ET: { code: "ETB", symbol: "Br", name: "Ethiopia" },
  EG: { code: "EGP", symbol: "E£", name: "Egypt" },
  MA: { code: "MAD", symbol: "MAD", name: "Morocco" },
  TZ: { code: "TZS", symbol: "TSh", name: "Tanzania" },
  UG: { code: "UGX", symbol: "UGX", name: "Uganda" },
  SN: { code: "XOF", symbol: "CFA", name: "Senegal" },
  CI: { code: "XOF", symbol: "CFA", name: "Côte d'Ivoire" },
  CM: { code: "XAF", symbol: "CFA", name: "Cameroon" },
  RW: { code: "RWF", symbol: "RF", name: "Rwanda" },
  MW: { code: "MWK", symbol: "MK", name: "Malawi" },
  ZM: { code: "ZMW", symbol: "ZK", name: "Zambia" },
  ZW: { code: "USD", symbol: "$", name: "Zimbabwe" },
  TG: { code: "XOF", symbol: "CFA", name: "Togo" },
  BJ: { code: "XOF", symbol: "CFA", name: "Benin" },
  BF: { code: "XOF", symbol: "CFA", name: "Burkina Faso" },
  ML: { code: "XOF", symbol: "CFA", name: "Mali" },
  NE: { code: "XOF", symbol: "CFA", name: "Niger" },
  TD: { code: "XAF", symbol: "CFA", name: "Chad" },
  SD: { code: "SDG", symbol: "SDG", name: "Sudan" },
  SO: { code: "SOS", symbol: "Sh", name: "Somalia" },
  LY: { code: "LYD", symbol: "LD", name: "Libya" },
  TN: { code: "TND", symbol: "DT", name: "Tunisia" },
  DZ: { code: "DZD", symbol: "DA", name: "Algeria" },
  AO: { code: "AOA", symbol: "Kz", name: "Angola" },
  MZ: { code: "MZN", symbol: "MT", name: "Mozambique" },
  BW: { code: "BWP", symbol: "P", name: "Botswana" },
  NA: { code: "NAD", symbol: "N$", name: "Namibia" },
  LS: { code: "LSL", symbol: "L", name: "Lesotho" },
  SZ: { code: "SZL", symbol: "E", name: "Eswatini" },
  GB: { code: "GBP", symbol: "£", name: "United Kingdom" },
  US: { code: "USD", symbol: "$", name: "United States" },
  EU: { code: "EUR", symbol: "€", name: "Europe (EU)" },
  CA: { code: "CAD", symbol: "CA$", name: "Canada" },
  AU: { code: "AUD", symbol: "A$", name: "Australia" },
  AE: { code: "AED", symbol: "AED", name: "UAE" },
  SA: { code: "SAR", symbol: "SR", name: "Saudi Arabia" },
  CN: { code: "CNY", symbol: "¥", name: "China" },
  JP: { code: "JPY", symbol: "¥", name: "Japan" },
  IN: { code: "INR", symbol: "₹", name: "India" },
  BR: { code: "BRL", symbol: "R$", name: "Brazil" },
  OTHER: { code: "USD", symbol: "$", name: "Other / International" },
};

interface EventCollection {
  id: number;
  title: string;
  description: string;
  eventType: string;
  totalPrice?: number;
  avgFitScore?: number;
  products: Array<{
    id: number;
    name: string;
    price: string;
    imageUrl?: string;
    fitScore?: number;
  }>;
}

export default function EventPlannerPage() {
  const { user } = useAuth();
  const { addToCart, openCart } = useCart();
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState("");
  const [budget, setBudget] = useState("");
  const [eventSize, setEventSize] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [eventLocation, setEventLocation] = useState("NG");
  const [addedCollections, setAddedCollections] = useState<Set<number>>(new Set());

  // Product and planner-service prices are stored in NGN; location is not a
  // currency converter and must not relabel an NGN price as a foreign price.
  const currency = { code: "NGN", symbol: "₦" };
  const familySizeParam = eventSize === "others" ? customSize : eventSize;

  const { data: collections = [], isLoading } = useQuery<EventCollection[]>({
    queryKey: ["/api/events/recommend", selectedEvent, budget, familySizeParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedEvent) params.append("eventType", selectedEvent);
      if (budget) params.append("budget", budget);
      if (familySizeParam) params.append("familySize", familySizeParam);
      const res = await fetch(`/api/events/recommend?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load collections");
      return res.json();
    },
    enabled: !!selectedEvent,
  });

  const getFitScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600 bg-green-50";
    if (score >= 70) return "text-yellow-800 bg-yellow-50";
    return "text-orange-800 bg-orange-50";
  };

  const locationOptions = Object.entries(LOCATION_CURRENCIES).map(([key, val]) => ({
    key,
    label: val.name,
  }));

  function handleAddAllToCart(collection: EventCollection) {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to add items to your cart.", variant: "destructive" });
      return;
    }
    collection.products.forEach(p => addToCart(p.id, 1));
    setAddedCollections(prev => new Set(prev).add(collection.id));
    toast({
      title: "Collection added!",
      description: `${collection.products.length} item${collection.products.length !== 1 ? "s" : ""} from "${collection.title}" added to your cart.`,
    });
    openCart();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-green-800 via-emerald-700 to-yellow-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <span className="text-white/80 font-medium text-sm uppercase tracking-wider">AfrolandX Event Planner</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-3">Events, planned your way</h1>
          <p className="text-white/80 max-w-2xl text-base leading-relaxed">
            Work with an approved planner for your occasion, or explore traditional outfit collections for everyone attending.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            {[
              { label: "Wedding", value: "wedding" },
              { label: "Naming Ceremony", value: "naming_ceremony" },
              { label: "Festival", value: "festival" },
              { label: "Chieftaincy", value: "chieftaincy" },
              { label: "Engagement", value: "engagement" },
              { label: "Party", value: "party" },
            ].map(tag => (
              <button
                key={tag.value}
                onClick={() => setSelectedEvent(tag.value)}
                className={`px-3 py-1 border rounded-full text-sm transition-all ${
                  selectedEvent === tag.value
                    ? "bg-white text-green-800 font-semibold border-white"
                    : "bg-white/15 border-white/25 text-white/90 hover:bg-white/25"
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <EventServices />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-8 sr-only">
          <h2 className="text-2xl font-bold">Find Your Collection</h2>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Tell Us About Your Event</CardTitle>
            <CardDescription>
              Choose an event type to explore curated outfit collections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Event Type */}
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue placeholder="What's the occasion?" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Event Location → determines currency */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Event location
                </Label>
                <Select value={eventLocation} onValueChange={setEventLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Where is the event?" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {locationOptions.map(({ key, label }) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Budget with dynamic currency */}
              <div className="space-y-2">
                <Label>Budget per person ({currency.code})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">
                    {currency.symbol}
                  </span>
                  <Input
                    type="number"
                    placeholder="e.g., 50000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    data-testid="input-budget"
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Event Size */}
              <div className="space-y-2">
                <Label>Event Size</Label>
                <Select value={eventSize} onValueChange={setEventSize}>
                  <SelectTrigger data-testid="select-event-size">
                    <SelectValue placeholder="How many outfits needed?" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventSizes.map(size => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eventSize === "others" && (
                  <Input
                    type="number"
                    placeholder="Enter exact number of outfits"
                    value={customSize}
                    onChange={(e) => setCustomSize(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {!selectedEvent ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {eventTypes.map(type => (
              <Card
                key={type.value}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedEvent(type.value)}
                data-testid={`event-type-card-${type.value}`}
              >
                <CardContent className="pt-6 text-center">
                  <type.icon className="h-12 w-12 mx-auto text-primary mb-3" />
                  <p className="font-medium">{type.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : collections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Collections Found</h3>
              <p className="text-muted-foreground mb-4">
                We don't have curated collections for this event type yet, but you can browse our products.
              </p>
              <Button asChild>
                <Link href="/products">Browse All Products</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {eventTypes.find(t => t.value === selectedEvent)?.label} Collections
              </h2>
              <Badge variant="outline">{collections.length} collections found</Badge>
            </div>

            {collections.map(collection => (
              <Card key={collection.id} data-testid={`collection-card-${collection.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{collection.title}</CardTitle>
                      <CardDescription className="mt-1">{collection.description}</CardDescription>
                    </div>
                    {collection.avgFitScore && (
                      <Badge className={getFitScoreColor(collection.avgFitScore)}>
                        Fit score: {Math.round(collection.avgFitScore)}%
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {collection.products.map(product => (
                      <div key={product.id} className="group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2 relative">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-contain bg-white group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          {product.fitScore && user && (
                            <Badge
                              className={`absolute top-2 right-2 ${getFitScoreColor(product.fitScore)}`}
                            >
                              {product.fitScore}% Fit
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {currency.symbol}{parseFloat(product.price).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      {collection.totalPrice && (
                        <div>
                          <span className="text-sm text-muted-foreground">Collection Total: </span>
                          <span className="text-lg font-semibold">
                            {currency.symbol}{collection.totalPrice.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" asChild>
                        <Link href={`/products?collection=${collection.id}`}>
                          View Details
                        </Link>
                      </Button>
                      <Button
                        data-testid={`button-add-collection-${collection.id}`}
                        onClick={() => handleAddAllToCart(collection)}
                        className={addedCollections.has(collection.id) ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {addedCollections.has(collection.id) ? (
                          <><CheckCircle2 className="h-4 w-4 mr-2" />Added to Cart</>
                        ) : (
                          <><ShoppingBag className="h-4 w-4 mr-2" />Add All to Cart</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {!user && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <Users className="h-10 w-10 text-primary" />
                    <div className="flex-1">
                      <h3 className="font-semibold">Get Personalized Fit Scores</h3>
                      <p className="text-sm text-muted-foreground">
                        Sign in and add your measurements to see how well each outfit will fit you.
                      </p>
                    </div>
                    <Button asChild>
                      <a href="/login">Sign In</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
