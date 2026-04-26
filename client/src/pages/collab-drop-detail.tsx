import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Crown, Sparkles, Users, Clock, ShoppingBag, ArrowLeft, Loader2, Bell
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navbar from "@/components/navbar";

interface DropProduct {
  id: number;
  name: string;
  price: string;
  imageUrl?: string;
  images?: string[];
  description?: string;
}

interface CollabDropDetail {
  id: number;
  title: string;
  name: string;
  description: string;
  dropStartTime: string;
  dropEndTime?: string;
  status: string;
  isExclusive: boolean;
  minLoyaltyTier?: string;
  rsvpCap?: number;
  rsvpCount: number;
  teaserImageUrl?: string;
  designer?: { id: number; businessName: string; logo?: string };
  artisan?: { id: number; businessName: string };
  products: DropProduct[];
}

function getProductImage(p: DropProduct) {
  if (p.images && p.images.length > 0) return p.images[0];
  if (p.imageUrl) return p.imageUrl;
  return null;
}

export default function CollabDropDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart, openCart } = useCart();
  const { toast } = useToast();

  const { data: drop, isLoading, isError } = useQuery<CollabDropDetail>({
    queryKey: ["/api/collab-drops", id],
    queryFn: async () => {
      const res = await fetch(`/api/collab-drops/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Drop not found");
      return res.json();
    },
  });

  const { data: myRsvps = [] } = useQuery<Array<{ dropId: number }>>({
    queryKey: ["/api/my-rsvps"],
    enabled: !!user,
  });

  const rsvpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/collab-drops/${id}/rsvp`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-rsvps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collab-drops", id] });
      toast({ title: "RSVP Confirmed!", description: "You'll be notified when the drop goes live." });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !drop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">This collection could not be found.</p>
        <Button asChild variant="outline">
          <Link href="/collab-drops"><ArrowLeft className="h-4 w-4 mr-2" />Back to Collabs</Link>
        </Button>
      </div>
    );
  }

  const now = new Date();
  const start = new Date(drop.dropStartTime);
  const end = drop.dropEndTime ? new Date(drop.dropEndTime) : null;
  const isLive = now >= start && (!end || now <= end);
  const isUpcoming = now < start;
  const spotsLeft = drop.rsvpCap ? drop.rsvpCap - (drop.rsvpCount || 0) : null;
  const hasRsvped = myRsvps.some(r => r.dropId === drop.id);
  const displayTitle = drop.title || drop.name;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/collab-drops"><ArrowLeft className="h-4 w-4 mr-2" />Back to Collabs</Link>
          </Button>
        </div>

        {/* Hero Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          {drop.teaserImageUrl && (
            <div className="aspect-square rounded-2xl overflow-hidden">
              <img src={drop.teaserImageUrl} alt={displayTitle} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex flex-col justify-center space-y-4">
            <div className="flex flex-wrap gap-2">
              {drop.isExclusive && (
                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                  <Crown className="h-3 w-3 mr-1" />Exclusive
                </Badge>
              )}
              {drop.minLoyaltyTier && (
                <Badge variant="secondary" className="capitalize">{drop.minLoyaltyTier}+ Only</Badge>
              )}
              {isLive && <Badge className="bg-green-500">Live Now</Badge>}
              {isUpcoming && <Badge variant="secondary">Upcoming</Badge>}
              {!isLive && !isUpcoming && <Badge variant="outline">Ended</Badge>}
            </div>

            <h1 className="text-3xl font-bold">{displayTitle}</h1>

            {drop.designer && (
              <p className="text-muted-foreground">
                by <span className="font-medium text-foreground">{drop.designer.businessName}</span>
                {drop.artisan && <> × <span className="font-medium text-foreground">{drop.artisan.businessName}</span></>}
              </p>
            )}

            <p className="text-muted-foreground leading-relaxed">{drop.description}</p>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {new Date(drop.dropStartTime).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {drop.rsvpCount || 0} RSVPs
              </span>
              {spotsLeft !== null && spotsLeft > 0 && isLive && (
                <span className="text-orange-500 font-medium">{spotsLeft} spots left</span>
              )}
            </div>

            {isUpcoming && (
              user ? (
                hasRsvped ? (
                  <Button variant="secondary" disabled className="w-full md:w-auto">
                    ✓ You're on the list
                  </Button>
                ) : (
                  <Button onClick={() => rsvpMutation.mutate()} disabled={rsvpMutation.isPending} className="w-full md:w-auto">
                    {rsvpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                    RSVP for Notification
                  </Button>
                )
              ) : (
                <Button asChild variant="outline" className="w-full md:w-auto">
                  <Link href="/login">Sign in to RSVP</Link>
                </Button>
              )
            )}
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Products Grid */}
        <div>
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            {isLive ? "Shop the Collection" : "Collection Preview"}
          </h2>

          {drop.products.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {isUpcoming ? "Products will be revealed when the drop goes live." : "No products in this collection."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {drop.products.map((product) => {
                const img = getProductImage(product);
                return (
                  <Card key={product.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="aspect-square overflow-hidden bg-muted">
                      {img ? (
                        <img
                          src={img}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=400&h=400&q=60"; }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-nigerian-green/20 to-nigerian-gold/20 flex items-center justify-center">
                          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold truncate mb-1">{product.name}</h3>
                      <p className="text-lg font-bold text-nigerian-green mb-3">
                        ${parseFloat(product.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      {isLive ? (
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => {
                            addToCart(product.id);
                            toast({ title: "Added to cart!", description: product.name });
                            openCart();
                          }}
                        >
                          <ShoppingBag className="h-4 w-4 mr-2" />
                          Add to Cart
                        </Button>
                      ) : (
                        <Button variant="outline" className="w-full" size="sm" disabled>
                          Available When Live
                        </Button>
                      )}
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
