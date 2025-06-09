import type { RequestHandler } from "express";
import { storage } from "./storage";

export const isAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check if user has admin role
    const roles = user.roles ? JSON.parse(user.roles as string) : [];
    if (!roles.includes('admin')) {
      return res.status(403).json({ 
        message: "Access denied. Admin privileges required.",
        userRoles: roles
      });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};