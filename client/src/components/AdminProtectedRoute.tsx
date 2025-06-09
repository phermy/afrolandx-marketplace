import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/roleUtils';
import { useToast } from '@/hooks/use-toast';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin(user)) {
      toast({
        title: 'Access Denied',
        description: 'You do not have admin privileges to access this area.',
        variant: 'destructive',
      });
      
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
  }, [isAuthenticated, isLoading, user, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner-nigerian"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Only redirect once to prevent loops
    if (typeof window !== 'undefined' && !window.location.href.includes('/api/login')) {
      window.location.href = '/api/login?redirect=/admin';
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-nigerian mb-4"></div>
          <p className="text-gray-600">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin(user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You do not have admin privileges to access this area. You will be redirected to the home page.
          </p>
          <div className="spinner-nigerian"></div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}