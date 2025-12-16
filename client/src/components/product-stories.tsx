import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, BookOpen, Volume2, Loader2 } from "lucide-react";
import { useState } from "react";

interface ProductStory {
  id: number;
  productId: number;
  storyType: "video" | "audio" | "text";
  title: string;
  content?: string;
  mediaUrl?: string;
  culturalContext?: string;
  regionOrigin?: string;
  craftTechnique?: string;
}

export function ProductStories({ productId }: { productId: number }) {
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);

  const { data: stories = [], isLoading } = useQuery<ProductStory[]>({
    queryKey: ["/api/products", productId, "stories"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/stories`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stories.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        Cultural Story
      </h3>
      
      {stories.map((story) => (
        <Card key={story.id} data-testid={`story-card-${story.id}`}>
          <CardContent className="pt-4">
            {story.storyType === "video" && story.mediaUrl && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black mb-4">
                {playingVideo === story.id ? (
                  <video 
                    src={story.mediaUrl} 
                    controls 
                    autoPlay
                    className="w-full h-full"
                    onEnded={() => setPlayingVideo(null)}
                  />
                ) : (
                  <button
                    onClick={() => setPlayingVideo(story.id)}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/40 transition-colors"
                    data-testid={`play-video-${story.id}`}
                  >
                    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                      <Play className="h-8 w-8 text-primary-foreground ml-1" />
                    </div>
                  </button>
                )}
              </div>
            )}

            {story.storyType === "audio" && story.mediaUrl && (
              <div className="mb-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Volume2 className="h-8 w-8 text-primary flex-shrink-0" />
                  <audio 
                    src={story.mediaUrl} 
                    controls 
                    className="w-full"
                    data-testid={`audio-player-${story.id}`}
                  />
                </div>
              </div>
            )}

            <h4 className="font-medium text-lg mb-2">{story.title}</h4>
            
            {story.content && (
              <p className="text-muted-foreground mb-4 leading-relaxed">
                {story.content}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {story.regionOrigin && (
                <Badge variant="outline">
                  Origin: {story.regionOrigin}
                </Badge>
              )}
              {story.craftTechnique && (
                <Badge variant="outline">
                  Technique: {story.craftTechnique}
                </Badge>
              )}
              {story.culturalContext && (
                <Badge variant="secondary">
                  {story.culturalContext}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
