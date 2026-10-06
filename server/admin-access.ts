import type { RequestHandler } from "express";
import { storage } from "./storage";
import { hasFullManagementAccess, hasSupportManagementAccess, isCustomerOrVendorAccount } from "../shared/admin-access";
import { isDesignatedOwnerEmail } from "./admin-role-bootstrap";

export function canSeeManagedAccount(actor: Parameters<typeof hasFullManagementAccess>[0], target: any): boolean {
  return Boolean(target && hasSupportManagementAccess(actor) && (hasFullManagementAccess(actor) ||
    (isCustomerOrVendorAccount(target) && !isDesignatedOwnerEmail(target.email))));
}
export const requireFullManagement: RequestHandler = async (req, res, next) => {
  const actor = await storage.getUser((req.user as any)?.id).catch(() => undefined);
  if (!hasFullManagementAccess(actor)) return void res.status(403).json({ message: "Verified Superadmin access is required for full platform management." });
  next();
};
