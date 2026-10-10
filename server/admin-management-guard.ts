import type { RequestHandler } from "express";
import { storage } from "./storage";
import { hasFullManagementAccess, isSupportManagementRoute } from "../shared/admin-access";
import { canSeeManagedAccount } from "./admin-access";
import { canReviewVendorApplication } from "./vendor-application-access";

export const managementGuard: RequestHandler = async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const actor = await storage.getUser((req.user as any)?.id);
    if (!actor || actor.closedAt || !actor.emailVerified || !Array.isArray(actor.roles) || !actor.roles.includes("admin")) {
      return void res.status(403).json({ message: "Verified admin access is required." });
    }
    (req as any).managementActor = actor;
    if (hasFullManagementAccess(actor)) return next();
    if (!isSupportManagementRoute(req.method, req.path)) {
      return void res.status(403).json({ message: "This management area is restricted to Superadmins. Admins have customer and vendor support access only." });
    }
    let targetId: string | undefined;
    const account = req.path.match(/^\/users\/([^/]+)$/);
    const vendorApplication = req.path.match(/^\/vendors\/(\d+)\/(?:verification|status)$/);
    const vendorProduct = req.path.match(/^\/vendors\/(\d+)\/products$/);
    const order = req.path.match(/^\/orders\/(\d+)\/(?:status|tracking)$/);
    if (account) targetId = decodeURIComponent(account[1]);
    if (vendorApplication || vendorProduct) targetId = (await storage.getVendor(Number((vendorApplication || vendorProduct)![1])))?.userId;
    if (order) targetId = (await storage.getOrder(Number(order[1])))?.userId;
    if (account || vendorApplication || vendorProduct || order) {
      const target = targetId ? await storage.getUser(targetId) : undefined;
      if (vendorApplication ? !canReviewVendorApplication(actor, target) : !canSeeManagedAccount(actor, target)) {
        return void res.status(404).json({ message: "Record not found." });
      }
    }
    next();
  } catch {
    res.status(503).json({ message: "Could not check management permissions. Please retry." });
  }
};
