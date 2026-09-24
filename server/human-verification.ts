import type { Express, RequestHandler } from "express";

declare module "express-session" {
  interface SessionData {
    humanVerificationDueAt?: number;
  }
}

const CHALLENGE_INTERVAL_MS = 20 * 60 * 1000;

type VerificationOptions = {
  siteKey?: string;
  secretKey?: string;
  intervalMs?: number;
  verifyToken?: (token: string, secret: string, ip?: string) => Promise<boolean>;
};

async function verifyTurnstileToken(token: string, secret: string, ip?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Turnstile returned ${response.status}`);
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

export function registerHumanVerification(app: Express, options: VerificationOptions = {}) {
  const siteKey = options.siteKey ?? process.env.TURNSTILE_SITE_KEY;
  const secretKey = options.secretKey ?? process.env.TURNSTILE_SECRET_KEY;
  const enabled = Boolean(siteKey && secretKey);
  const intervalMs = options.intervalMs ?? CHALLENGE_INTERVAL_MS;
  const verify = options.verifyToken ?? verifyTurnstileToken;

  if (Boolean(siteKey) !== Boolean(secretKey)) {
    console.warn("Human verification is disabled: both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are required");
  }

  function dueAt(req: Parameters<RequestHandler>[0]) {
    if (!req.session.humanVerificationDueAt) {
      req.session.humanVerificationDueAt = Date.now() + intervalMs;
    }
    return req.session.humanVerificationDueAt;
  }

  app.get("/api/human-verification/status", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!enabled) return res.json({ enabled: false });
    const nextChallengeAt = dueAt(req);
    return res.json({
      enabled: true,
      siteKey,
      required: Date.now() >= nextChallengeAt,
      nextChallengeAt,
    });
  });

  app.post("/api/human-verification/verify", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!enabled) return res.status(503).json({ message: "Human verification is not configured" });
    const token = req.body?.token;
    if (typeof token !== "string" || !token || token.length > 2048) {
      return res.status(400).json({ message: "Complete the verification check first" });
    }
    try {
      const passed = await verify(token, secretKey!, req.ip);
      if (!passed) return res.status(400).json({ message: "Verification failed. Please try again." });
      req.session.humanVerificationDueAt = Date.now() + intervalMs;
      return res.json({ verified: true, nextChallengeAt: req.session.humanVerificationDueAt });
    } catch (error) {
      console.error("Human verification service unavailable:", error);
      return res.status(503).json({ message: "Verification is temporarily unavailable. Please try again." });
    }
  });

  app.use("/api", (req, res, next) => {
    if (!enabled || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ||
        req.path === "/logout" || req.path.startsWith("/webhooks/") ||
        req.path.startsWith("/human-verification/")) return next();

    if (Date.now() >= dueAt(req)) {
      res.set("Cache-Control", "no-store");
      return res.status(428).json({ message: "Please verify you're human to continue.", code: "HUMAN_VERIFICATION_REQUIRED" });
    }
    next();
  });
}