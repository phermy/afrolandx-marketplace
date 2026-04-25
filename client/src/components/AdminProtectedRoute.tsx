import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/roleUtils';
import { useToast } from '@/hooks/use-toast';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation('/login');
      return;
    }
    if (!isAdmin(user)) {
      toast({
        title: 'Access Denied',
        description: 'You do not have admin privileges to access this area.',
        variant: 'destructive',
      });
      setTimeout(() => setLocation('/'), 2000);
    }
  }, [isAuthenticated, isLoading, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner-nigerian"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin(user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-nigerian mb-4"></div>
          <p className="text-gray-600">
            {!isAuthenticated ? 'Redirecting to sign in...' : 'Access denied. Redirecting...'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}