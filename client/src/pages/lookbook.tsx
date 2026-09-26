import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Sparkles, CheckCircle, ShoppingBag, Palette, RefreshCw, Star, MapPin
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import Navbar from "@/components/navbar";

const EVENT_TYPES = [
  { value: "wedding", label: "Wedding / Traditional Marriage" },
  { value: "naming_ceremony", label: "Naming Ceremony" },
  { value: "festival", label: "Festival / Cultural Event" },
  { value: "party", label: "Party / Celebration" },
  { value: "traditional", label: "Traditional Event" },
  { value: "casual", label: "Casual Outing" },
  { value: "burial", label: "Burial / Memorial" },
  { value: "chieftaincy", label: "Chieftaincy Title" },
  { value: "graduation", label: "Graduation Ceremony" },
  { value: "engagement", label: "Engagement / Courtship" },
  { value: "corporate", label: "Corporate / Business Event" },
  { value: "religious", label: "Religious / Church Event" },
  { value: "others", label: "Other / Custom event" },
];

const EVENT_SIZES = [
  { value: "1", label: "Solo: Just me (1)" },
  { value: "2", label: "Couple (2)" },
  { value: "4", label: "Small family (3–4)" },
  { value: "6", label: "Family (5–6)" },
  { value: "10", label: "Extended family (7–10)" },
  { value: "15", label: "Wedding party / Bridal train (10–20)" },
  { value: "25", label: "Small group / Aso Ebi (20–30)" },
  { value: "50", label: "Large group (30–60)" },
  { value: "100", label: "Corporate / Community event (60+)" },
  { value: "others", label: "Custom size" },
];

const EVENT_LOCATIONS: Record<string, string> = {
  NG: "Nigeria", GH: "Ghana", ZA: "South Africa", KE: "Kenya",
  ET: "Ethiopia", EG: "Egypt", MA: "Morocco", TZ: "Tanzania",
  UG: "Uganda", SN: "Senegal", CI: "Côte d'Ivoire", CM: "Cameroon",
  RW: "Rwanda", MW: "Malawi", ZM: "Zambia", ZW: "Zimbabwe",
  TG: "Togo", BJ: "Benin", BF: "Burkina Faso", ML: "Mali",
  NE: "Niger", TD: "Chad", SD: "Sudan", SO: "Somalia",
  LY: "Libya", TN: "Tunisia", DZ: "Algeria", AO: "Angola",
  MZ: "Mozambique", BW: "Botswana", NA: "Namibia", LS: "Lesotho",
  SZ: "Eswatini", GB: "United Kingdom", US: "United States",
  EU: "Europe (EU)", CA: "Canada", AU: "Australia", AE: "UAE",
  SA: "Saudi Arabia", CN: "China", JP: "Japan", IN: "India",
  BR: "Brazil", OTHER: "Other / International",
};

const STYLE_EXAMPLES = [
  "Royal blue Agbada with gold embroidery for a Yoruba wedding",
  "Modern Ankara wrap dress for a festival, feminine and vibrant",
  "Minimal white and silver Kaftan for a beach naming ceremony",
  "Full traditional Igbo outfit for chieftaincy installation",
  "Smart Dashiki for a casual outing, earthy tones",
];

interface BundleItem {
  productId: number;
  name: string;
  price: string;
  imageUrl?: string;
  reason: string;
  aiNotes?: string;
}

interface Lookbook {
  id: number;
  bundleItems: BundleItem[];
  totalPrice: string;
  status: string;
  createdAt?: string;
}

export default function LookbookPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addToCart, openCart } = useCart();

  const [eventType, setEventType] = useState("");
  const [eventSize, setEventSize] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [eventLocation, setEventLocation] = useState("NG");
  const [budget, setBudget] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [placeholder] = useState(STYLE_EXAMPLES[Math.floor(Math.random() * STYLE_EXAMPLES.length)]);

  const { data: lookbooks = [], isLoading: loadingLookbooks } = useQuery<Lookbook[]>({
    queryKey: ["/api/lookbooks"],
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/lookbooks/generate", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lookbooks"] });
      toast({ title: "Lookbook ready!", description: "Your outfit, chosen by AI, is ready below." });
    },
    onError: () => {
      toast({ title: "Lookbook unavailable", description: "We could not find a matching outfit right now. Try a different budget or try again shortly.", variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/lookbooks/${id}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lookbooks"] });
      toast({ title: "Saved!", description: "Lookbook saved to your collection." });
    },
    onError: () => {
      toast({ title: "Could not save lookbook", description: "Please refresh your lookbooks and try again.", variant: "destructive" });
    },
  });

  const handleGenerate = () => {
    if (!stylePrompt && !eventType) {
      toast({
        title: "Tell us what you want",
        description: "Describe your style or choose an event type to get started.",
        variant: "destructive",
      });
      return;
    }
    const sizeParam = eventSize === "others" ? customSize : eventSize;
    generateMutation.mutate({
      eventType,
      budget: budget ? Number(budget) : undefined,
      styleNotes: stylePrompt,
      familySize: sizeParam || undefined,
      eventLocation: EVENT_LOCATIONS[eventLocation],
    });
  };

  const locationOptions = Object.entries(EVENT_LOCATIONS).map(([key, name]) => ({
    key,
    label: name,
  }));

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-sm w-full">
          <CardContent className="py-8 text-center">
            <p className="mb-4">Sign in to use the AI Lookbook Studio</p>
            <Button asChild><a href="/login">Sign In</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">AI Lookbook Studio</h1>
          </div>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Describe any outfit in your own words. Our AI stylist will pick the perfect pieces from our collection.
          </p>
        </div>

        {/* Main Input Card */}
        <Card className="mb-8 border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              What are you looking for?
            </CardTitle>
            <CardDescription>
              Describe your occasion, style, colours, or any preferences. The more detail you provide, the better the match.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Free-text prompt */}
            <div className="space-y-2">
              <Label htmlFor="stylePrompt" className="text-base font-semibold">
                Describe your style{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  (e.g. "Red and gold Ankara dress for my friend's wedding in Lagos")
                </span>
              </Label>
              <Textarea
                id="stylePrompt"
                placeholder={placeholder}
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                rows={4}
                className="text-base resize-none"
              />
            </div>

            {/* Structured fields — row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Event Type */}
              <div className="space-y-2">
                <Label>Event Type <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose occasion…" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Group size gives styling context; the result remains one outfit */}
              <div className="space-y-2">
                <Label>Group size <span className="text-muted-foreground text-xs">(optional, one outfit is suggested)</span></Label>
                <Select value={eventSize} onValueChange={setEventSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="How many people are in your group?" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_SIZES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eventSize === "others" && (
                  <Input
                    type="number"
                    placeholder="Enter the exact number of outfits"
                    value={customSize}
                    onChange={(e) => setCustomSize(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              {/* Event location informs the outfit, not its price */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Event Location <span className="text-muted-foreground text-xs ml-1">(styling context)</span>
                </Label>
                <Select value={eventLocation} onValueChange={setEventLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Where is the event?" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {locationOptions.map(({ key, label }) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product prices are stored in NGN */}
              <div className="space-y-2">
                <Label htmlFor="budget">
                  Budget for this outfit (NGN){" "}
                  <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">
                    ₦
                  </span>
                  <Input
                    id="budget"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 50000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Prices stay in Nigerian naira regardless of event location.</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full text-base py-6"
              size="lg"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Curating your outfit…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate My Lookbook
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Results */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Lookbooks</h2>

          {loadingLookbooks ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lookbooks.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-40" />
                <p className="text-muted-foreground">No lookbooks yet. Describe your style above, then select Generate My Lookbook to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {lookbooks.map((lb) => {
                const items: BundleItem[] = (lb.bundleItems as any) || [];
                const total = parseFloat(lb.totalPrice || "0");
                return (
                  <Card key={lb.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500" />
                          Lookbook #{lb.id}
                        </CardTitle>
                        <Badge variant={lb.status === "accepted" ? "default" : "secondary"}>
                          {lb.status === "accepted" ? (
                            <><CheckCircle className="h-3 w-3 mr-1" />Saved</>
                          ) : "AI Generated"}
                        </Badge>
                      </div>
                      {lb.createdAt && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(lb.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </p>
                      )}
                    </CardHeader>

                    <CardContent>
                      {/* Product grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                        {items.map((item, i) => (
                          <div key={i} className="group">
                            <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-2">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-contain bg-white group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=200&h=200&q=60";
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingBag className="h-8 w-8 text-muted-foreground opacity-40" />
                                </div>
                              )}
                            </div>
                            <p className="text-sm font-medium leading-tight line-clamp-1">{item.name}</p>
                            <p className="text-sm font-bold text-nigerian-green">
                              ₦{parseFloat(item.price || "0").toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">{item.reason}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2 text-xs"
                              onClick={() => {
                                addToCart(item.productId);
                                toast({ title: "Added!", description: item.name });
                                openCart();
                              }}
                            >
                              <ShoppingBag className="h-3 w-3 mr-1" />Add to Cart
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Separator className="my-3" />

                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <span className="text-sm text-muted-foreground">Total estimate: </span>
                          <span className="text-xl font-bold">
                            ₦{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                             onClick={handleGenerate}
                            disabled={generateMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />Regenerate
                          </Button>
                          {lb.status !== "accepted" && (
                            <Button
                              size="sm"
                              onClick={() => acceptMutation.mutate(lb.id)}
                              disabled={acceptMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />Save Lookbook
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
