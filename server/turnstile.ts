const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// Cloudflare's documented testing pair works on development hostnames only.
const TEST_SITE_KEY = "1x00000000000000000000AA";
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

export function registrationTurnstileConfig() {
  // Explicit opt-out allows automated Preview tests without a Cloudflare widget.
  // An unset development flag still uses the normal Cloudflare test widget.
  if (process.env.NODE_ENV !== "production" && process.env.TURNSTILE_REGISTER_ENABLED === "false") {
    return { enabled: false, incomplete: false, siteKey: null, testMode: false };
  }
  if (process.env.TURNSTILE_REGISTER_ENABLED !== "true") {
    if (process.env.NODE_ENV !== "production") {
      return { enabled: true, incomplete: false, siteKey: TEST_SITE_KEY, testMode: true };
    }
    return { enabled: false, incomplete: false, siteKey: null, testMode: false };
  }
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  return {
    enabled: Boolean(siteKey && secretKey),
    incomplete: !siteKey || !secretKey,
    siteKey: siteKey && secretKey ? siteKey : null,
    testMode: false,
  };
}

export async function verifyRegistrationTurnstile(token: string): Promise<boolean> {
  const secret = registrationTurnstileConfig().testMode ? TEST_SECRET_KEY : process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("Turnstile is not configured");
  const response = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Turnstile verification service unavailable");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || typeof (result as { success?: unknown }).success !== "boolean") {
    throw new Error("Unexpected Turnstile verification response");
  }
  return (result as { success: boolean }).success;
}