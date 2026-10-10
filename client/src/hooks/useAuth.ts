import { useQuery } from "@tanstack/react-query";
import type { User } from "@/types";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchInterval: 60 * 1000, // poll every 60s to detect being kicked out
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });

      if (response.status === 401) {
        const body = await response.json().catch(() => ({}));
        if (body.message === "SESSION_SUPERSEDED") {
          window.dispatchEvent(new CustomEvent("session-superseded"));
        }
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      try {
        return JSON.parse(text) as User;
      } catch {
        throw new Error("Received an invalid authentication response");
      }
    }
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error
  };
}
