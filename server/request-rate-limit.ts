import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { pool } from "./db";

type LimitResult = { count: number; retry_after: number };
type Consume = (key: string, windowSeconds: number) => Promise<LimitResult>;

// Shared PostgreSQL counters survive restarts and work across autoscaled workers.
// Expiring, non-login rows reuse the existing session store; no schema change.
export const consumeRequestLimit: Consume = async (key, windowSeconds) => {
  const result = await pool.query<LimitResult>(`
    INSERT INTO sessions (sid, sess, expire)
    VALUES ($1, json_build_object('count', 1), NOW() + $2 * INTERVAL '1 second')
    ON CONFLICT (sid) DO UPDATE SET
      sess = json_build_object('count', CASE WHEN sessions.expire <= NOW() THEN 1 ELSE (sessions.sess->>'count')::int + 1 END),
      expire = CASE WHEN sessions.expire <= NOW() THEN NOW() + $2 * INTERVAL '1 second' ELSE sessions.expire END
    RETURNING (sess->>'count')::int AS count,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM expire - NOW())))::int AS retry_after
  `, [key, windowSeconds]);
  return result.rows[0];
};

export function requestRateLimit(scope: string, max: number, windowSeconds: number, consume: Consume = consumeRequestLimit): RequestHandler {
  return async (req, res, next) => {
    // Express resolves the nearest trusted proxy; never trust a caller's first
    // X-Forwarded-For value, which would allow bypassing the counter.
    const fingerprint = crypto.createHash("sha256").update(`${scope}:${req.ip || req.socket.remoteAddress || "unknown"}`).digest("hex");
    try {
      const limit = await consume(`rate:${fingerprint}`, windowSeconds);
      if (limit.count > max) {
        res.setHeader("Retry-After", String(limit.retry_after));
        return void res.status(429).json({ message: "Too many requests. Please wait before trying again.", retryAfter: limit.retry_after });
      }
      next();
    } catch {
      // An unavailable limiter must not enable unlimited paid AI or brute force.
      res.setHeader("Retry-After", "60");
      res.status(503).json({ message: "This service is temporarily unavailable. Please try again shortly." });
    }
  };
}
