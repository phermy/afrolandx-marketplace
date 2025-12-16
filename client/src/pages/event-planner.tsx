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
  Sparkles,
  Star,
  Heart,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

const eventTypes = [
  { value: "wedding", label: "Wedding / Traditional Marriage", icon: Heart },
  { value: "naming_ceremony", label: "Naming Ceremony", icon: Star },
  { value: "festival", label: "Festival / Cultural Event", icon: Sparkles },
  { value: "party", label: "Party / Celebration", icon: Calendar },
  { value: "burial", label: "Burial / Memorial", icon: Calendar },
  { value: "chieftaincy", label: "Chieftaincy Title", icon: Star },
];

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
  const [selectedEvent, setSelectedEvent] = useState("");
  const [budget, setBudget] = useState("");
  const [familySize, setFamilySize] = useState("");

  const { data: collections = [], isLoading } = useQuery<EventCollection[]>({
    queryKey: ["/api/events/recommend", selectedEvent, budget, familySize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedEvent) params.append("eventType", selectedEvent);
      if (budget) params.append("budget", budget);
      if (familySize) params.append("familySize", familySize);
      
      const res = await fetch(`/api/events/recommend?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        // Fall back to public collections endpoint
        const fallbackRes = await fetch(`/api/events/collections?eventType=${selectedEvent}`);
        return fallbackRes.json();
      }
      return res.json();
    },
    enabled: !!selectedEvent,
  });

  const getFitScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600 bg-green-50";
    if (score >= 70) return "text-yellow-600 bg-yellow-50";
    return "text-orange-600 bg-orange-50";
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Event Outfit Planner</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Planning a special Nigerian event? We'll help you find the perfect traditional outfits for every member of your family.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Tell Us About Your Event</CardTitle>
            <CardDescription>
              Select your event type and we'll show you curated outfit collections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <div className="space-y-2">
                <Label>Budget (₦) per person</Label>
                <Input
                  type="number"
                  placeholder="e.g., 150000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  data-testid="input-budget"
                />
              </div>

              <div className="space-y-2">
                <Label>Family Size</Label>
                <Select value={familySize} onValueChange={setFamilySize}>
                  <SelectTrigger data-testid="select-family-size">
                    <SelectValue placeholder="How many outfits?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Just me</SelectItem>
                    <SelectItem value="2">Couple (2)</SelectItem>
                    <SelectItem value="4">Small family (3-4)</SelectItem>
                    <SelectItem value="6">Large family (5-6)</SelectItem>
                    <SelectItem value="10">Extended family (7+)</SelectItem>
                  </SelectContent>
                </Select>
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
                        {Math.round(collection.avgFitScore)}% Fit Match
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
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
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
                          ₦{parseFloat(product.price).toLocaleString()}
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
                            ₦{collection.totalPrice.toLocaleString()}
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
                      <Button data-testid={`button-add-collection-${collection.id}`}>
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        Add All to Cart
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
                      <a href="/api/login">Sign In</a>
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
