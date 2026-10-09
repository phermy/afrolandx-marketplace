import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { consumeRequestLimit } from "./request-rate-limit";

export function growingLoginDelay(
  scope: string, consume = consumeRequestLimit,
  sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
): RequestHandler {
  return async (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
    const key = (value: string) => `login-delay:${crypto.createHash("sha256").update(`${scope}:${value}`).digest("hex")}`;
    try {
      const limits = await Promise.all([consume(key(ip), 900), consume(key(`email:${email}`), 900)]);
      const count = Math.max(...limits.map(limit => limit.count));
      if (count > 12) {
        const retryAfter = Math.max(...limits.map(limit => limit.retry_after));
        res.setHeader("Retry-After", String(retryAfter));
        return void res.status(429).json({ message: "Too many sign-in attempts. Please wait before trying again.", retryAfter });
      }
      await sleep(count < 2 ? 0 : Math.min(8000, 500 * 2 ** (count - 2)));
      next();
    } catch {
      res.setHeader("Retry-After", "60");
      res.status(503).json({ message: "Sign-in is temporarily unavailable. Please try again shortly." });
    }
  };
}
