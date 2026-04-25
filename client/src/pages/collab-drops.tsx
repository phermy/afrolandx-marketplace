import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Users, 
  Clock, 
  Crown, 
  Sparkles,
  Bell,
  BellOff,
  CheckCircle,
  Loader2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

interface CollabDrop {
  id: number;
  title: string;
  description: string;
  dropStartTime: string;
  dropEndTime?: string;
  status: string;
  isExclusive: boolean;
  minLoyaltyTier?: string;
  rsvpCap?: number;
  rsvpCount: number;
  designer?: {
    id: number;
    businessName: string;
    logo?: string;
  };
  artisan?: {
    id: number;
    businessName: string;
  };
  products: Array<{
    id: number;
    name: string;
    price: string;
    imageUrl?: string;
  }>;
  teaserImageUrl?: string;
}

export default function CollabDropsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: drops = [], isLoading } = useQuery<CollabDrop[]>({
    queryKey: ["/api/collab-drops"],
  });

  const { data: myRsvps = [] } = useQuery<Array<{ dropId: number }>>({
    queryKey: ["/api/my-rsvps"],
    enabled: !!user,
  });

  const rsvpMutation = useMutation({
    mutationFn: async (dropId: number) => {
      const response = await apiRequest("POST", `/api/collab-drops/${dropId}/rsvp`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collab-drops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-rsvps"] });
      toast({
        title: "RSVP Confirmed!",
        description: "You'll be notified when the drop goes live.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "RSVP Failed",
        description: error.message || "Could not complete RSVP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const hasRsvped = (dropId: number) => myRsvps.some(r => r.dropId === dropId);

  const getStatusBadge = (drop: CollabDrop) => {
    const now = new Date();
    const start = new Date(drop.dropStartTime);
    const end = drop.dropEndTime ? new Date(drop.dropEndTime) : null;

    if (now < start) {
      return <Badge variant="secondary">Upcoming</Badge>;
    } else if (!end || now <= end) {
      return <Badge className="bg-green-500">Live Now</Badge>;
    } else {
      return <Badge variant="outline">Ended</Badge>;
    }
  };

  const getTimeRemaining = (dropTime: string) => {
    const now = new Date();
    const drop = new Date(dropTime);
    const diff = drop.getTime() - now.getTime();

    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const upcomingDrops = drops.filter(d => new Date(d.dropStartTime) > new Date());
  const liveDrops = drops.filter(d => {
    const now = new Date();
    const start = new Date(d.dropStartTime);
    const end = d.dropEndTime ? new Date(d.dropEndTime) : null;
    return now >= start && (!end || now <= end);
  });
  const pastDrops = drops.filter(d => {
    const end = d.dropEndTime ? new Date(d.dropEndTime) : null;
    return end && new Date() > end;
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Designer Collaboration Hub</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Exclusive limited-edition collections featuring collaborations between top African designers and traditional artisans. RSVP to get notified when drops go live.
          </p>
        </div>

        {liveDrops.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Live Now
            </h2>
            <div className="grid gap-4">
              {liveDrops.map(drop => (
                <DropCard key={drop.id} drop={drop} hasRsvped={hasRsvped(drop.id)} onRsvp={() => rsvpMutation.mutate(drop.id)} isPending={rsvpMutation.isPending} user={user} />
              ))}
            </div>
          </section>
        )}

        {upcomingDrops.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Drops
            </h2>
            <div className="grid gap-4">
              {upcomingDrops.map(drop => (
                <DropCard 
                  key={drop.id} 
                  drop={drop} 
                  hasRsvped={hasRsvped(drop.id)} 
                  onRsvp={() => rsvpMutation.mutate(drop.id)} 
                  isPending={rsvpMutation.isPending}
                  user={user}
                  timeRemaining={getTimeRemaining(drop.dropStartTime)}
                />
              ))}
            </div>
          </section>
        )}

        {pastDrops.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Past Drops</h2>
            <div className="grid gap-4 opacity-75">
              {pastDrops.map(drop => (
                <DropCard key={drop.id} drop={drop} hasRsvped={hasRsvped(drop.id)} isPast user={user} />
              ))}
            </div>
          </section>
        )}

        {drops.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Collaboration Drops Yet</h3>
              <p className="text-muted-foreground">
                Stay tuned for exciting collaborations between top African designers and traditional artisans.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DropCard({ 
  drop, 
  hasRsvped, 
  onRsvp, 
  isPending, 
  isPast = false,
  user,
  timeRemaining
}: { 
  drop: CollabDrop; 
  hasRsvped: boolean; 
  onRsvp?: () => void; 
  isPending?: boolean;
  isPast?: boolean;
  user?: any;
  timeRemaining?: string | null;
}) {
  const isLive = new Date(drop.dropStartTime) <= new Date();
  const spotsLeft = drop.rsvpCap ? drop.rsvpCap - (drop.rsvpCount || 0) : null;

  return (
    <Card className={isPast ? "opacity-75" : ""} data-testid={`drop-card-${drop.id}`}>
      <div className="md:flex">
        {drop.teaserImageUrl && (
          <div className="md:w-1/3 aspect-video md:aspect-auto">
            <img 
              src={drop.teaserImageUrl} 
              alt={drop.title}
              className="w-full h-full object-cover rounded-t-lg md:rounded-l-lg md:rounded-t-none"
            />
          </div>
        )}
        <div className="flex-1">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {drop.isExclusive && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                      <Crown className="h-3 w-3 mr-1" />
                      Exclusive
                    </Badge>
                  )}
                  {drop.minLoyaltyTier && (
                    <Badge variant="secondary" className="capitalize">
                      {drop.minLoyaltyTier}+ Only
                    </Badge>
                  )}
                  {!isPast && (isLive ? (
                    <Badge className="bg-green-500">Live Now</Badge>
                  ) : (
                    <Badge variant="secondary">Upcoming</Badge>
                  ))}
                </div>
                <CardTitle className="text-xl">{drop.title}</CardTitle>
                {drop.designer && (
                  <CardDescription className="flex items-center gap-2 mt-1">
                    by {drop.designer.businessName}
                    {drop.artisan && ` × ${drop.artisan.businessName}`}
                  </CardDescription>
                )}
              </div>
              {timeRemaining && (
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Drops in</div>
                  <div className="font-bold text-lg">{timeRemaining}</div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{drop.description}</p>
            
            {drop.products.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {drop.products.slice(0, 4).map(product => (
                  <div key={product.id} className="flex-shrink-0 w-20">
                    {product.imageUrl && (
                      <img 
                        src={product.imageUrl} 
                        alt={product.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <p className="text-xs truncate mt-1">{product.name}</p>
                  </div>
                ))}
                {drop.products.length > 4 && (
                  <div className="flex-shrink-0 w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">+{drop.products.length - 4}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {new Date(drop.dropStartTime).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {drop.rsvpCount || 0} RSVPs
              </span>
              {spotsLeft !== null && spotsLeft > 0 && !isPast && (
                <span className="text-orange-500">
                  {spotsLeft} spots left
                </span>
              )}
            </div>
          </CardContent>
          {!isPast && (
            <CardFooter className="flex gap-2">
              {isLive ? (
                <Button asChild data-testid={`button-shop-drop-${drop.id}`}>
                  <Link href={`/collab-drops/${drop.id}`}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Shop Collection
                  </Link>
                </Button>
              ) : user ? (
                hasRsvped ? (
                  <Button variant="secondary" disabled data-testid={`button-rsvped-${drop.id}`}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    RSVP'd
                  </Button>
                ) : (
                  <Button onClick={onRsvp} disabled={isPending} data-testid={`button-rsvp-${drop.id}`}>
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Bell className="h-4 w-4 mr-2" />
                    )}
                    RSVP for Notification
                  </Button>
                )
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/login">Sign in to RSVP</Link>
                </Button>
              )}
            </CardFooter>
          )}
        </div>
      </div>
    </Card>
  );
}
