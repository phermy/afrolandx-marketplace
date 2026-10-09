import type { RequestHandler } from "express";
import crypto from "node:crypto";

export const securityHeaders: RequestHandler = (req, res, next) => {
  const production = req.app?.get("env") === "production" || process.env.NODE_ENV === "production";
  const nonce = crypto.randomBytes(18).toString("base64");
  res.locals ||= {};
  res.locals.cspNonce = nonce;
  res.removeHeader?.("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=(), payment=(self), usb=()");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  if (production) {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self' https://*.paystack.com https://*.paystack.co",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://*.googleapis.com https://*.gstatic.com https://*.paystack.co https://*.paystack.com https://cdn.jsdelivr.net`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://challenges.cloudflare.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.paystack.co https://*.paystack.com https://*.r2.dev https://*.afrolandx.com https://replicate.delivery https://*.replicate.delivery https://cdn.jsdelivr.net${production ? "" : " ws: wss:"}`,
    "frame-src 'self' https://challenges.cloudflare.com https://*.paystack.co https://*.paystack.com",
    "worker-src 'self' blob:",
    production ? "frame-ancestors 'self'" : "frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev",
    ...(production && req.secure ? ["upgrade-insecure-requests"] : []),
  ].join("; "));
  next();
};

export function withCspNonce(html: string, nonce?: string): string {
  if (!nonce) return html;
  if (!/^[A-Za-z0-9+/=]+$/.test(nonce)) throw new Error("Invalid CSP nonce");
  return html.replace(/<script\b(?![^>]*\bnonce\s*=)/gi, `<script nonce="${nonce}"`);
}
