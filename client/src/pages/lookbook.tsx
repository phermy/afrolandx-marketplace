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
  Loader2, Sparkles, CheckCircle, ShoppingBag, Palette, Trash2, RefreshCw, Star
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
];

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
      toast({ title: "Lookbook Ready!", description: "Your AI-curated outfit is below." });
      setStylePrompt("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate lookbook. Please try again.", variant: "destructive" });
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
    generateMutation.mutate({ eventType, budget: budget ? parseFloat(budget) : undefined, styleNotes: stylePrompt });
  };

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
            Describe any outfit in your own words — our AI stylist will pick the perfect pieces from our collection.
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
              Describe your occasion, style, colours, or any preferences — the more detail, the better the match.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Free-text prompt — primary input */}
            <div className="space-y-2">
              <Label htmlFor="stylePrompt" className="text-base font-semibold">
                Describe your style <span className="text-muted-foreground font-normal text-sm">(e.g. "Red and gold Ankara dress for my friend's wedding in Lagos")</span>
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

            {/* Optional structured fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="e.g. 300"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
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
                <p className="text-muted-foreground">No lookbooks yet — describe your style above and hit Generate!</p>
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
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                            <p className="text-sm font-bold text-nigerian-green">${parseFloat(item.price || "0").toLocaleString()}</p>
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
                          <span className="text-xl font-bold">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateMutation.mutate({ eventType, budget: budget ? parseFloat(budget) : undefined, styleNotes: stylePrompt })}
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
