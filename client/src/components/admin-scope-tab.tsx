import type { ComponentProps } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { hasFullManagementAccess } from "@shared/admin-access";

export function AdminScopeTab(props: ComponentProps<typeof TabsContent>) {
  const { user } = useAuth();
  if (["analytics", "featured", "event-planners", "discover", "overview"].includes(props.value) && !hasFullManagementAccess(user)) return null;
  return <TabsContent {...props} />;
}
