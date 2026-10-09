import type { RequestHandler } from "express";

export const LOGIN_CODE_RESPONSE = {
  message: "If an eligible account exists for this email, a sign-in code will be sent. Check your inbox and spam folder.",
};
export function createLoginCodeRequestHandler(dependencies: {
  getUserByEmail: (email: string) => Promise<any>;
  issueOtp: (req: any, user: any) => Promise<void>;
  onDeliveryError?: () => void;
  eligible?: (user: any) => boolean;
  response?: { message: string };
}): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return void res.status(400).json({ message: "A valid email is required" });
    }
    try {
      const user = await dependencies.getUserByEmail(email);
      if (user && !user.closedAt && (!dependencies.eligible || dependencies.eligible(user))) {
        // Provider latency and per-account request limits must not reveal existence.
        void Promise.resolve().then(() => dependencies.issueOtp(req, user))
          .catch(() => dependencies.onDeliveryError?.());
      }
    } catch {
      // A database/provider outage must not reveal whether a supplied account exists.
      dependencies.onDeliveryError?.();
    }
    res.json(dependencies.response || LOGIN_CODE_RESPONSE);
  };
}
