import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { X, Clock } from "lucide-react";
import type { Notification } from "@shared/schema";

export default function NotificationPanel() {
  const { user, isAuthenticated } = useAuth();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const dismissMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return await apiRequest(`/api/notifications/${notificationId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return await apiRequest(`/api/notifications/${notificationId}/read`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  if (!isAuthenticated || isLoading) {
    return null;
  }

  if (!Array.isArray(notifications) || notifications.length === 0) {
    return null;
  }

  const handleDismiss = (notificationId: number) => {
    dismissMutation.mutate(notificationId);
  };

  const handleMarkAsRead = (notificationId: number) => {
    if (!notifications.find(n => n.id === notificationId)?.isRead) {
      markAsReadMutation.mutate(notificationId);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm space-y-2">
      {notifications.map((notification) => (
        <Card 
          key={notification.id} 
          className={`border shadow-lg ${
            notification.isRead 
              ? 'bg-gray-50 border-gray-200' 
              : 'bg-white border-nigerian-green'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-3">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm">{notification.title}</h4>
                  {!notification.isRead && (
                    <Badge className="bg-nigerian-green text-white text-xs px-2 py-1">
                      New
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  {notification.createdAt ? new Date(String(notification.createdAt)).toLocaleString() : 'Unknown time'}
                </div>
                {notification.expiresAt && (
                  <div className="text-xs text-yellow-600 mt-1">
                    Expires: {notification.expiresAt ? new Date(String(notification.expiresAt)).toLocaleString() : 'Never'}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(notification.id)}
                  className="h-6 w-6 p-0 hover:bg-red-100"
                  disabled={dismissMutation.isPending}
                >
                  <X className="w-4 h-4 text-red-500" />
                </Button>
                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="text-xs px-2 py-1 h-6 hover:bg-blue-100"
                    disabled={markAsReadMutation.isPending}
                  >
                    Mark Read
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}