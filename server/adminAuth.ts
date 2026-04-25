import type { RequestHandler } from "express";
import { storage } from "./storage";

export const isAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const roles: string[] = Array.isArray(user.roles) ? user.roles as string[] : [];
    if (!roles.includes('admin')) {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};
