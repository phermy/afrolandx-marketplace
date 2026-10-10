import { createHash } from "node:crypto";
import { shippingProviderPriority } from "../shared/shipping-providers";
import type { ShippingCourierConnection, ShippingProviderConnection, ShippingProviderConnections, ShippingProviderId, ShippingProviderStatus } from "../shared/shipping-providers";

type Credentials = {
  shipbubble?: string;
  terminalAfrica?: string;
  terminalEnvironment?: string;
};
type Options = {
  request?: typeof fetch;
  credentials?: () => Credentials;
  now?: () => number;
  timeoutMs?: number;
};

const names = { shipbubble: "Shipbubble", terminal_africa: "Terminal Africa" } as const;
const messages: Record<ShippingProviderStatus, string> = {
  connected: "Live API access verified. Specific routes and prices still require a confirmed quote.",
  missing_key: "No API key is configured. This provider cannot be selected.",
  test_mode: "Test access cannot be used as a live shipping connection.",
  unauthorized: "API access was rejected. Verify the secret key and account permissions.",
  unavailable: "The provider is unavailable. No shipment was booked or charged.",
  timeout: "The provider did not respond in time. No shipment was booked or charged.",
  invalid_response: "The provider returned an unrecognised response. Manual confirmation is required.",
  no_carriers: "No operational couriers were returned. Manual confirmation is required.",
};

function normalizeCouriers(id: ShippingProviderId, rows: unknown[]): ShippingCourierConnection[] {
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const c = row as Record<string, unknown>;
    const operational = id === "shipbubble" ? c.status === "operational" : c.active === true;
    if (!operational || typeof c.name !== "string" || !c.name.trim()) return [];
    return [{ name: c.name.trim().slice(0, 160), domestic: c.domestic === true, international: c.international === true }];
  });
}

// Only read operations are allowed here. A booking timeout is NOT permission to
// book with the other provider: a lost response can hide a successful charge.
export function createShippingProviderService(options: Options = {}) {
  const request = options.request ?? fetch;
  const credentials = options.credentials ?? (() => ({
    shipbubble: process.env.SHIPBUBBLE_API_KEY,
    terminalAfrica: process.env.TERMINAL_AFRICA_API_KEY,
    terminalEnvironment: process.env.TERMINAL_AFRICA_ENVIRONMENT,
  }));
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 8000;
  const cache = new Map<ShippingProviderId, {
    fingerprint: string;
    until: number;
    pending: Promise<ShippingProviderConnection>;
  }>();

  async function probe(id: ShippingProviderId, key: string, testMode: boolean): Promise<ShippingProviderConnection> {
    const result = (status: ShippingProviderStatus, couriers: ShippingCourierConnection[] = []): ShippingProviderConnection => ({
      id, name: names[id], role: id === "shipbubble" ? "primary" : "backup",
      status, message: messages[status], checkedAt: new Date(now()).toISOString(), couriers,
    });
    if (!key) return result("missing_key");
    if (testMode) return result("test_mode");
    const url = id === "shipbubble"
      ? "https://api.shipbubble.com/v1/shipping/couriers"
      : "https://api.terminal.africa/v1/users/carriers?active=true&perPage=100&page=1";
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await request(url, {
        method: "GET", headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal,
      });
      if (response.status === 401 || response.status === 403) return result("unauthorized");
      if (!response.ok) return result("unavailable");
      const body = await response.json().catch(() => null);
      const success = id === "shipbubble" ? body?.status === "success" : body?.status === true;
      const rows = id === "shipbubble" ? body?.data : body?.data?.carriers;
      if (!success || !Array.isArray(rows)) return result("invalid_response");
      const couriers = normalizeCouriers(id, rows);
      return result(couriers.length ? "connected" : "no_carriers", couriers);
    } catch {
      // Never propagate provider errors, response bodies, headers or keys.
      return result(signal.aborted ? "timeout" : "unavailable");
    }
  }

  function connection(id: ShippingProviderId, config: Credentials) {
    const key = (id === "shipbubble" ? config.shipbubble : config.terminalAfrica)?.trim() ?? "";
    const testMode = id === "shipbubble"
      ? key.startsWith("sb_sandbox")
      : config.terminalEnvironment === "sandbox" || /^(?:sk|pk)_test(?:_|-)/i.test(key);
    // Invalidate cached access immediately when a credential or mode changes.
    // The fingerprint stays in memory and is never returned or logged.
    const fingerprint = createHash("sha256").update(`${key}:${testMode}`).digest("hex");
    const old = cache.get(id);
    if (old && old.fingerprint === fingerprint && old.until > now()) return old.pending;
    const entry = { fingerprint, until: Infinity, pending: probe(id, key, testMode) };
    cache.set(id, entry);
    entry.pending.then(result => {
      if (cache.get(id) === entry) {
        // Cache failures too, to avoid repeated requests during an outage.
        entry.until = now() + (result.status === "connected" ? 300_000 : 60_000);
      }
    });
    return entry.pending;
  }

  return {
    async getConnections(): Promise<ShippingProviderConnections> {
      const config = credentials();
      const providers = await Promise.all(shippingProviderPriority.map(id => connection(id, config)));
      const activeProvider = providers.find(provider => provider.status === "connected")?.id ?? null;
      return {
        primary: "shipbubble", backup: "terminal_africa", activeProvider,
        usingBackup: activeProvider === "terminal_africa", manualRequired: activeProvider === null,
        automaticBookings: false, scope: "carrier_connections", providers,
      };
    },
  };
}

export const shippingProviderService = createShippingProviderService();
