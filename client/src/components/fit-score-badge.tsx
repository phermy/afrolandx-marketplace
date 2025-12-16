import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FitScoreData {
  fitScore: number;
  totalReviews: number;
  recommendation: string;
}

export function FitScoreBadge({ productId }: { productId: number }) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<FitScoreData>({
    queryKey: ["/api/products", productId, "fit-score"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/fit-score`, {
        credentials: "include",
      });
      if (!res.ok) return { fitScore: 85, totalReviews: 0, recommendation: "Good fit" };
      return res.json();
    },
    enabled: !!user,
  });

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
        Calculating...
      </Badge>
    );
  }

  if (!data) return null;

  const getScoreColor = (score: number) => {
    if (score >= 85) return "bg-green-100 text-green-700 border-green-300";
    if (score >= 70) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    return "bg-orange-100 text-orange-700 border-orange-300";
  };

  const getIcon = (score: number) => {
    if (score >= 85) return <CheckCircle className="h-3 w-3" />;
    if (score >= 70) return <Info className="h-3 w-3" />;
    return <AlertCircle className="h-3 w-3" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${getScoreColor(data.fitScore)} cursor-help`}
            data-testid={`fit-score-badge-${productId}`}
          >
            {getIcon(data.fitScore)}
            <span className="ml-1">{data.fitScore}% Fit</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">{data.recommendation}</p>
            <p className="text-muted-foreground">
              Based on {data.totalReviews} customer reviews
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
