import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Gift, 
  Star, 
  Users, 
  Copy, 
  Check,
  Crown,
  TrendingUp,
  Award,
  Loader2,
  Sparkles
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const tierColors: Record<string, string> = {
  bronze: "bg-amber-600",
  silver: "bg-slate-400",
  gold: "bg-yellow-500",
  platinum: "bg-gradient-to-r from-violet-400 to-purple-600",
};

const tierBenefits: Record<string, string[]> = {
  bronze: ["Earn 1 point per ₦100 spent", "Birthday bonus points", "Exclusive deals"],
  silver: ["2x points on selected items", "Early access to sales", "Free shipping over ₦50,000"],
  gold: ["3x points on all orders", "Priority customer support", "Exclusive VIP sales"],
  platinum: ["5x points always", "Free express shipping", "Designer collaboration access", "Personal stylist"],
};

export default function LoyaltyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [referralInput, setReferralInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState("");

  const { data: loyaltyData, isLoading } = useQuery<{
    account: {
      userId: string;
      points: number;
      lifetimePoints: number;
      tier: string;
      referralCode: string;
      referredBy: string | null;
      tierUpdatedAt: string | null;
    };
    history: Array<{
      id: number;
      actionType: string;
      pointsDelta: number;
      description: string;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/loyalty"],
    enabled: !!user,
  });

  const { data: quizzes = [] } = useQuery<Array<{
    id: number;
    title: string;
    description: string;
    rewardPoints: number;
    completed: boolean;
  }>>({
    queryKey: ["/api/quizzes"],
    enabled: !!user,
  });

  const applyReferralMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/loyalty/apply-referral", { referralCode: code });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty"] });
      toast({
        title: "Referral Applied!",
        description: data.message,
      });
      setReferralInput("");
    },
    onError: () => {
      toast({
        title: "Invalid Code",
        description: "This referral code is invalid or has already been used.",
        variant: "destructive",
      });
    },
  });

  const redeemMutation = useMutation({
    mutationFn: async (points: number) => {
      const response = await apiRequest("POST", "/api/loyalty/redeem", { points });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty"] });
      toast({
        title: "Points Redeemed!",
        description: `You received ₦${data.discountAmount.toLocaleString()} discount. Apply it at checkout!`,
      });
      setRedeemAmount("");
    },
    onError: () => {
      toast({
        title: "Redemption Failed",
        description: "You don't have enough points.",
        variant: "destructive",
      });
    },
  });

  const copyReferralCode = () => {
    if (loyaltyData?.account?.referralCode) {
      navigator.clipboard.writeText(loyaltyData.account.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard.",
      });
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Sign in to access the Loyalty Program</h1>
        <p className="text-muted-foreground">Earn points, unlock rewards, and get exclusive benefits.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const account = loyaltyData?.account;
  const history = loyaltyData?.history || [];
  const currentTier = account?.tier || "bronze";
  const points = account?.points || 0;
  const lifetimePoints = account?.lifetimePoints || 0;

  // Calculate progress to next tier
  const tierThresholds = { bronze: 0, silver: 1000, gold: 5000, platinum: 10000 };
  const tiers = ["bronze", "silver", "gold", "platinum"];
  const currentTierIndex = tiers.indexOf(currentTier);
  const nextTier = currentTierIndex < 3 ? tiers[currentTierIndex + 1] : null;
  const nextThreshold = nextTier ? tierThresholds[nextTier as keyof typeof tierThresholds] : lifetimePoints;
  const currentThreshold = tierThresholds[currentTier as keyof typeof tierThresholds];
  const progress = nextTier 
    ? ((lifetimePoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Loyalty & Rewards</h1>
          </div>
          <p className="text-muted-foreground">
            Earn points with every purchase, refer friends, and unlock exclusive benefits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Points</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                {points.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              = ₦{((points / 100) * 500).toLocaleString()} discount
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Lifetime Points</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-500" />
                {lifetimePoints.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Total points earned
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Tier</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <Badge className={`${tierColors[currentTier]} text-white capitalize text-lg py-1 px-3`}>
                  <Award className="h-4 w-4 mr-1" />
                  {currentTier}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextTier && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{lifetimePoints.toLocaleString()} pts</span>
                    <span>{nextThreshold.toLocaleString()} pts for {nextTier}</span>
                  </div>
                  <Progress value={Math.min(progress, 100)} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="benefits" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="benefits" data-testid="tab-benefits">Benefits</TabsTrigger>
            <TabsTrigger value="redeem" data-testid="tab-redeem">Redeem</TabsTrigger>
            <TabsTrigger value="referral" data-testid="tab-referral">Referrals</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="benefits">
            <Card>
              <CardHeader>
                <CardTitle>Your {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Benefits</CardTitle>
                <CardDescription>Exclusive perks for {currentTier} members</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {tierBenefits[currentTier]?.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {quizzes.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Cultural Quizzes
                  </CardTitle>
                  <CardDescription>Learn about African heritage and earn bonus points!</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {quizzes.map((quiz) => (
                      <div 
                        key={quiz.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`quiz-item-${quiz.id}`}
                      >
                        <div>
                          <p className="font-medium">{quiz.title}</p>
                          <p className="text-sm text-muted-foreground">{quiz.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">+{quiz.rewardPoints} pts</Badge>
                          {quiz.completed ? (
                            <Badge variant="secondary">
                              <Check className="h-3 w-3 mr-1" />
                              Done
                            </Badge>
                          ) : (
                            <Button size="sm" asChild>
                              <a href={`/quizzes/${quiz.id}`}>Take Quiz</a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="redeem">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Redeem Points
                </CardTitle>
                <CardDescription>
                  Convert your points to store credit (100 points = ₦500 discount)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="redeemAmount">Points to Redeem</Label>
                  <Input
                    id="redeemAmount"
                    type="number"
                    placeholder="Enter points (min 100)"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    data-testid="input-redeem-points"
                  />
                  {redeemAmount && parseInt(redeemAmount) >= 100 && (
                    <p className="text-sm text-muted-foreground">
                      = ₦{((parseInt(redeemAmount) / 100) * 500).toLocaleString()} discount
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => redeemMutation.mutate(parseInt(redeemAmount))}
                  disabled={!redeemAmount || parseInt(redeemAmount) < 100 || redeemMutation.isPending}
                  data-testid="button-redeem"
                >
                  {redeemMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Gift className="h-4 w-4 mr-2" />
                  )}
                  Redeem Points
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="referral">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Your Referral Code
                  </CardTitle>
                  <CardDescription>
                    Share this code with friends. They get 100 points, you get 200!
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      value={account?.referralCode || ""}
                      readOnly
                      className="font-mono text-lg"
                      data-testid="input-referral-code"
                    />
                    <Button onClick={copyReferralCode} variant="outline" data-testid="button-copy-referral">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {!account?.referredBy && (
                <Card>
                  <CardHeader>
                    <CardTitle>Have a Referral Code?</CardTitle>
                    <CardDescription>
                      Enter a friend's code to get 100 bonus points
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      placeholder="Enter referral code"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      className="font-mono"
                      data-testid="input-apply-referral"
                    />
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => applyReferralMutation.mutate(referralInput)}
                      disabled={!referralInput || applyReferralMutation.isPending}
                      data-testid="button-apply-referral"
                    >
                      {applyReferralMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Gift className="h-4 w-4 mr-2" />
                      )}
                      Apply Code
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Points History</CardTitle>
                <CardDescription>Your recent point transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No points activity yet. Start shopping to earn points!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {history.map((event) => (
                      <div 
                        key={event.id} 
                        className="flex items-center justify-between py-2 border-b last:border-0"
                        data-testid={`history-item-${event.id}`}
                      >
                        <div>
                          <p className="font-medium">{event.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(event.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={event.pointsDelta > 0 ? "default" : "destructive"}>
                          {event.pointsDelta > 0 ? "+" : ""}{event.pointsDelta}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
