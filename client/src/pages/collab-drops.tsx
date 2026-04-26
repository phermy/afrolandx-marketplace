import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar, Users, Clock, Crown, Sparkles, Bell, BellOff,
  CheckCircle, Loader2, Search, X, ArrowRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/navbar";

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
  designer?: { id: number; businessName: string; logo?: string };
  artisan?: { id: number; businessName: string };
  products: Array<{ id: number; name: string; price: string; imageUrl?: string; images?: string[] }>;
  teaserImageUrl?: string;
}

function getProductImage(p: { imageUrl?: string; images?: string[] }) {
  if (p.images && p.images.length > 0) return p.images[0];
  return p.imageUrl || null;
}

function isDropLive(drop: CollabDrop) {
  const now = new Date();
  const start = new Date(drop.dropStartTime);
  const end = drop.dropEndTime ? new Date(drop.dropEndTime) : null;
  return now >= start && (!end || now <= end);
}

function isDropUpcoming(drop: CollabDrop) {
  return new Date(drop.dropStartTime) > new Date();
}

export default function CollabDropsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchText, setSearchText] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<{ dropIds: number[]; explanation: string } | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const { data: drops = [], isLoading } = useQuery<CollabDrop[]>({
    queryKey: ["/api/collab-drops"],
  });

  const { data: myRsvps = [] } = useQuery<Array<{ dropId: number }>>({
    queryKey: ["/api/my-rsvps"],
    enabled: !!user,
  });

  const rsvpMutation = useMutation({
    mutationFn: async (dropId: number) => {
      const res = await apiRequest("POST", `/api/collab-drops/${dropId}/rsvp`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collab-drops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-rsvps"] });
      toast({ title: "RSVP Confirmed!", description: "You'll be notified when the drop goes live." });
    },
    onError: () => {
      toast({ title: "RSVP Failed", description: "Could not complete RSVP. Please try again.", variant: "destructive" });
    },
  });

  const aiSuggestMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/collab-drops/ai-suggest", { query });
      return res.json();
    },
    onSuccess: (data) => {
      setAiResult(data);
    },
    onError: () => {
      toast({ title: "AI Error", description: "Could not process your request. Try a different description.", variant: "destructive" });
    },
  });

  const hasRsvped = (id: number) => myRsvps.some(r => r.dropId === id);

  // Client-side text search
  const textFiltered = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    if (!q) return drops;
    return drops.filter(d =>
      d.title?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q) ||
      d.designer?.businessName?.toLowerCase().includes(q) ||
      d.artisan?.businessName?.toLowerCase().includes(q)
    );
  }, [drops, searchText]);

  // Apply AI filter on top of text filter
  const displayedDrops = useMemo(() => {
    if (!aiResult || aiResult.dropIds.length === 0) return textFiltered;
    const ids = new Set(aiResult.dropIds);
    const matched = textFiltered.filter(d => ids.has(d.id));
    const rest = textFiltered.filter(d => !ids.has(d.id));
    return [...matched, ...rest];
  }, [textFiltered, aiResult]);

  const liveDrops = displayedDrops.filter(isDropLive);
  const upcomingDrops = displayedDrops.filter(isDropUpcoming);
  const pastDrops = displayedDrops.filter(d => !isDropLive(d) && !isDropUpcoming(d));

  const clearAi = () => { setAiResult(null); setAiQuery(""); setShowAiPanel(false); };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Designer Collaboration Hub</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Exclusive limited-edition collections featuring collaborations between top African designers and traditional artisans.
          </p>
        </div>

        {/* Search + AI bar */}
        <div className="mb-6 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, designer, or style…"
                className="pl-9"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchText("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant={showAiPanel ? "default" : "outline"}
              onClick={() => setShowAiPanel(v => !v)}
              className="gap-2 shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              AI Suggest
            </Button>
          </div>

          {/* AI Panel */}
          {showAiPanel && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Tell AI what you're looking for
                </CardTitle>
                <CardDescription>
                  Describe your style, occasion, or preferences and our AI will find the best matching drops.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder='e.g. "I want something for an Eid celebration, prefer modern Kaftan style with indigo tones" or "exclusive gold embroidery drop for my wedding"'
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  rows={3}
                />
                {aiResult && (
                  <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md flex items-start gap-2">
                    <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <span>{aiResult.explanation}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => aiSuggestMutation.mutate(aiQuery)}
                    disabled={!aiQuery.trim() || aiSuggestMutation.isPending}
                    size="sm"
                  >
                    {aiSuggestMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <ArrowRight className="h-3 w-3 mr-1" />
                    )}
                    Find Drops
                  </Button>
                  {aiResult && (
                    <Button variant="ghost" size="sm" onClick={clearAi}>
                      <X className="h-3 w-3 mr-1" />Clear AI filter
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active AI badge */}
          {aiResult && !showAiPanel && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />AI filter active
              </Badge>
              <button onClick={clearAi} className="text-muted-foreground hover:text-foreground text-xs underline">
                Clear
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
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
                  {liveDrops.map(d => (
                    <DropCard key={d.id} drop={d} hasRsvped={hasRsvped(d.id)} onRsvp={() => rsvpMutation.mutate(d.id)} isPending={rsvpMutation.isPending} user={user} highlighted={!!aiResult && aiResult.dropIds.includes(d.id)} />
                  ))}
                </div>
              </section>
            )}

            {upcomingDrops.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />Upcoming Drops
                </h2>
                <div className="grid gap-4">
                  {upcomingDrops.map(d => (
                    <DropCard key={d.id} drop={d} hasRsvped={hasRsvped(d.id)} onRsvp={() => rsvpMutation.mutate(d.id)} isPending={rsvpMutation.isPending} user={user} highlighted={!!aiResult && aiResult.dropIds.includes(d.id)} />
                  ))}
                </div>
              </section>
            )}

            {pastDrops.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Past Drops</h2>
                <div className="grid gap-4">
                  {pastDrops.map(d => (
                    <DropCard key={d.id} drop={d} hasRsvped={hasRsvped(d.id)} isPast user={user} />
                  ))}
                </div>
              </section>
            )}

            {displayedDrops.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-40" />
                  <h3 className="font-semibold mb-2">
                    {searchText || aiResult ? "No matching drops found" : "No Collaboration Drops Yet"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {searchText || aiResult ? "Try a different search or clear your filters." : "Stay tuned for exciting collaborations between top African designers and traditional artisans."}
                  </p>
                  {(searchText || aiResult) && (
                    <Button variant="outline" className="mt-4" onClick={() => { setSearchText(""); clearAi(); }}>
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DropCard({
  drop, hasRsvped, onRsvp, isPending = false, isPast = false, user, highlighted = false,
}: {
  drop: CollabDrop; hasRsvped: boolean; onRsvp?: () => void;
  isPending?: boolean; isPast?: boolean; user?: any; highlighted?: boolean;
}) {
  const isLive = isDropLive(drop);
  const isUpcoming = isDropUpcoming(drop);
  const spotsLeft = drop.rsvpCap ? drop.rsvpCap - (drop.rsvpCount || 0) : null;

  // Count down display
  const timeRemaining = (() => {
    if (!isUpcoming) return null;
    const diff = new Date(drop.dropStartTime).getTime() - Date.now();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  })();

  return (
    <Card className={`overflow-hidden transition-all ${isPast ? "opacity-70" : ""} ${highlighted ? "ring-2 ring-primary" : ""}`}>
      {highlighted && (
        <div className="bg-primary/10 px-4 py-1 text-xs text-primary font-medium flex items-center gap-1">
          <Sparkles className="h-3 w-3" />AI recommended match
        </div>
      )}
      <div className="md:flex">
        {drop.teaserImageUrl && (
          <div className="md:w-80 aspect-video md:aspect-auto shrink-0">
            <img
              src={drop.teaserImageUrl}
              alt={drop.title}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
        )}
        <div className="flex-1 flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {drop.isExclusive && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600 text-xs">
                      <Crown className="h-3 w-3 mr-1" />Exclusive
                    </Badge>
                  )}
                  {drop.minLoyaltyTier && (
                    <Badge variant="secondary" className="capitalize text-xs">{drop.minLoyaltyTier}+ Only</Badge>
                  )}
                  {!isPast && isLive && <Badge className="bg-green-500 text-xs">Live Now</Badge>}
                  {!isPast && isUpcoming && <Badge variant="secondary" className="text-xs">Upcoming</Badge>}
                  {isPast && <Badge variant="outline" className="text-xs">Ended</Badge>}
                </div>
                <CardTitle className="text-xl">{drop.title}</CardTitle>
                {drop.designer && (
                  <CardDescription className="mt-1">
                    by {drop.designer.businessName}
                    {drop.artisan && ` × ${drop.artisan.businessName}`}
                  </CardDescription>
                )}
              </div>
              {timeRemaining && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Drops in</div>
                  <div className="font-bold text-lg">{timeRemaining}</div>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1">
            <p className="text-muted-foreground text-sm mb-4">{drop.description}</p>

            {/* Product thumbnails */}
            {drop.products.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
                {drop.products.slice(0, 5).map(p => {
                  const img = getProductImage(p);
                  return (
                    <div key={p.id} className="flex-shrink-0 w-16">
                      {img ? (
                        <img src={img} alt={p.name} className="w-16 h-16 object-cover rounded-lg" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-lg" />
                      )}
                      <p className="text-xs truncate mt-1 text-muted-foreground">{p.name}</p>
                    </div>
                  );
                })}
                {drop.products.length > 5 && (
                  <div className="flex-shrink-0 w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">+{drop.products.length - 5}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(drop.dropStartTime).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {drop.rsvpCount || 0} RSVPs
              </span>
              {spotsLeft !== null && spotsLeft > 0 && !isPast && (
                <span className="text-orange-500 font-medium">{spotsLeft} spots left</span>
              )}
            </div>
          </CardContent>

          {!isPast && (
            <CardFooter className="flex gap-2 pt-0">
              {isLive ? (
                <Button asChild>
                  <Link href={`/collab-drops/${drop.id}`}>
                    <Sparkles className="h-4 w-4 mr-2" />Shop Collection
                  </Link>
                </Button>
              ) : user ? (
                hasRsvped ? (
                  <Button variant="secondary" disabled>
                    <CheckCircle className="h-4 w-4 mr-2" />RSVP'd
                  </Button>
                ) : (
                  <Button onClick={onRsvp} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                    RSVP for Notification
                  </Button>
                )
              ) : (
                <Button variant="outline" asChild>
                  <Link href="/login">Sign in to RSVP</Link>
                </Button>
              )}
              {isLive && (
                <Button variant="outline" asChild>
                  <Link href={`/collab-drops/${drop.id}`}>View Details</Link>
                </Button>
              )}
            </CardFooter>
          )}
        </div>
      </div>
    </Card>
  );
}
