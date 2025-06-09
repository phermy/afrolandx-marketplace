import { useQuery } from "@tanstack/react-query";
import type { User } from "@/types";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async () => {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });
      
      if (response.status === 401) {
        return null; // Return null for unauthorized instead of throwing
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    }
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error
  };
}
