import crypto from "node:crypto";
import { passwordProblem } from "../shared/account-security";

export class PasswordCheckUnavailable extends Error {}
const ranges = new Map<string, { text: string; expires: number }>();
/** Only a five-character SHA-1 prefix leaves this server. Never log inputs. */
export async function assessPassword(
  password: string, email?: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const local = passwordProblem(password, email);
  if (local) return local;
  const digest = crypto.createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5), suffix = digest.slice(5);
  let text = ranges.get(prefix)?.expires! > Date.now() && fetcher === fetch ? ranges.get(prefix)!.text : undefined;
  if (!text) {
    try {
      const response = await fetcher(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { "Add-Padding": "true", "User-Agent": "Afrolandx-password-safety" },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("Password check failed");
      text = await response.text();
      const lines = text.trim().split(/\r?\n/);
      if (text.length > 200000 || !lines.length || !lines.every(line => /^[A-F0-9]{35}:\d+$/.test(line))) throw new Error("Invalid password range");
      if (fetcher === fetch) {
        if (ranges.size >= 512) ranges.delete(ranges.keys().next().value!);
        ranges.set(prefix, { text, expires: Date.now() + 60 * 60 * 1000 });
      }
    } catch { throw new PasswordCheckUnavailable("Password safety checks are temporarily unavailable. Try again shortly."); }
  }
  const breached = text.split(/\r?\n/).some(line => {
    const [hash, count] = line.trim().split(":");
    return hash === suffix && Number(count) > 0;
  });
  return breached ? "This password has appeared in a data breach. Choose a different password." : null;
}
