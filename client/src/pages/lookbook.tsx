import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, CheckCircle, ShoppingBag, Calendar, Palette } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { LookbookRecommendation, OccasionProfile } from "@shared/schema";

const eventTypes = [
  { value: "wedding", label: "Wedding / Traditional Marriage" },
  { value: "naming_ceremony", label: "Naming Ceremony" },
  { value: "festival", label: "Festival / Cultural Event" },
  { value: "party", label: "Party / Celebration" },
  { value: "traditional", label: "Traditional Event" },
  { value: "casual", label: "Casual Outing" },
  { value: "burial", label: "Burial / Memorial" },
  { value: "chieftaincy", label: "Chieftaincy Title" },
];

export default function LookbookPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [eventType, setEventType] = useState("");
  const [eventName, setEventName] = useState("");
  const [budget, setBudget] = useState("");
  const [styleNotes, setStyleNotes] = useState("");

  const { data: lookbooks = [], isLoading: loadingLookbooks } = useQuery<LookbookRecommendation[]>({
    queryKey: ["/api/lookbooks"],
    enabled: !!user,
  });

  const { data: occasions = [] } = useQuery<OccasionProfile[]>({
    queryKey: ["/api/occasions"],
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/lookbooks/generate", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lookbooks"] });
      toast({
        title: "Lookbook Generated!",
        description: "Your personalized outfit recommendations are ready.",
      });
      setEventType("");
      setEventName("");
      setBudget("");
      setStyleNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate lookbook. Please try again.",
        variant: "destructive",
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/lookbooks/${id}/accept`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lookbooks"] });
      toast({
        title: "Lookbook Accepted",
        description: "Items have been saved to your wishlist.",
      });
    },
  });

  const handleGenerate = () => {
    if (!eventType) {
      toast({
        title: "Select an event type",
        description: "Please choose what occasion you're shopping for.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      eventType,
      eventName: eventName || undefined,
      budget: budget ? parseFloat(budget) : undefined,
      styleNotes: styleNotes || undefined,
    });
  };

  useEffect(() => {
    if (!user) {
      window.location.href = "/login";
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Bespoke Lookbook Studio</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Let our AI stylist create the perfect outfit for your occasion. Tell us about your event and we'll curate personalized recommendations from our collection of authentic African fashion.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Create Your Lookbook
            </CardTitle>
            <CardDescription>
              Describe your upcoming event and style preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type *</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue placeholder="Select event type" />
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
                <Label htmlFor="eventName">Event Name (Optional)</Label>
                <Input
                  id="eventName"
                  placeholder="e.g., Amaka's Wedding"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  data-testid="input-event-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget ($) (Optional)</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="Enter your budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  data-testid="input-budget"
                />
              </div>

              <div className="space-y-2">
                <Label>Upcoming Occasions</Label>
                <div className="text-sm text-muted-foreground">
                  {occasions.length} saved occasions
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="styleNotes">Style Notes (Optional)</Label>
              <Textarea
                id="styleNotes"
                placeholder="Describe your style preferences... e.g., 'I prefer royal blue colors, traditional Agbada style, with minimal embroidery'"
                value={styleNotes}
                onChange={(e) => setStyleNotes(e.target.value)}
                rows={3}
                data-testid="textarea-style-notes"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleGenerate} 
              disabled={generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-lookbook"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Your Lookbook...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate AI Outfit Recommendations
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Your Lookbooks
          </h2>

          {loadingLookbooks ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lookbooks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No lookbooks yet. Generate your first one above!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {lookbooks.map((lookbook) => {
                const items = (lookbook.bundleItems as any[]) || [];
                return (
                  <Card key={lookbook.id} data-testid={`lookbook-card-${lookbook.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Outfit #{lookbook.id}
                        </CardTitle>
                        <Badge variant={lookbook.status === "accepted" ? "default" : "secondary"}>
                          {lookbook.status === "accepted" ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Saved
                            </>
                          ) : (
                            "Generated"
                          )}
                        </Badge>
                      </div>
                      <CardDescription>
                        Created on {new Date(lookbook.createdAt!).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {items.map((item: any, index: number) => (
                          <div key={index} className="text-center">
                            {item.imageUrl && (
                              <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-muted">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">${parseFloat(item.price || 0).toLocaleString()}</p>
                            <p className="text-xs text-primary mt-1">{item.reason}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t flex justify-between items-center">
                        <div>
                          <span className="font-semibold">Total: </span>
                          <span className="text-lg">${parseFloat(lookbook.totalPrice || "0").toLocaleString()}</span>
                        </div>
                        {lookbook.status !== "accepted" && (
                          <Button
                            size="sm"
                            onClick={() => acceptMutation.mutate(lookbook.id)}
                            disabled={acceptMutation.isPending}
                            data-testid={`button-accept-lookbook-${lookbook.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Save Lookbook
                          </Button>
                        )}
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
