import test from "node:test";
import assert from "node:assert/strict";
import { createShippingProviderService } from "./shipping-providers";

const keys = { shipbubble: "sb_prod_fixture", terminalAfrica: "terminal_fixture" };
const shipbubbleBody = { status: "success", data: [
  { name: "DHL Nigeria", status: "operational", domestic: true, international: true },
  { name: "Inactive courier", status: "not-operational", domestic: true },
] };
const terminalBody = { status: true, data: { carriers: [
  { name: "UPS", active: true, domestic: false, international: true },
  { name: "Inactive carrier", active: false },
] } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function mockRequest(primaryStatus = 200, backupStatus = 200): typeof fetch {
  return async (url, init) => {
    assert.equal(init?.method, "GET", "Never create a shipment or payment");
    return String(url).includes("shipbubble")
      ? json(shipbubbleBody, primaryStatus) : json(terminalBody, backupStatus);
  };
}

test("Shipbubble stays primary when both live connections work", async () => {
  const result = await createShippingProviderService({ credentials: () => keys, request: mockRequest() }).getConnections();
  assert.equal(result.activeProvider, "shipbubble");
  assert.equal(result.usingBackup, false);
  assert.equal(result.automaticBookings, false);
  assert.equal(result.scope, "carrier_connections");
  assert.deepEqual(result.providers.map(p => p.role), ["primary", "backup"]);
  assert.deepEqual(result.providers[0].couriers.map(c => c.name), ["DHL Nigeria"]);
});

test("Terminal Africa is selected only after a primary connection failure", async () => {
  const result = await createShippingProviderService({ credentials: () => keys, request: mockRequest(503) }).getConnections();
  assert.equal(result.activeProvider, "terminal_africa");
  assert.equal(result.usingBackup, true);
  assert.equal(result.manualRequired, false);
  assert.deepEqual(result.providers[1].couriers.map(c => c.name), ["UPS"]);
});

test("An unauthorized backup stays inactive while the primary works", async () => {
  const result = await createShippingProviderService({ credentials: () => keys, request: mockRequest(200, 401) }).getConnections();
  assert.equal(result.activeProvider, "shipbubble");
  assert.equal(result.providers[1].status, "unauthorized");
  assert.equal(JSON.stringify(result).includes(keys.terminalAfrica), false);
});

test("Neither unavailable provider can be selected; require manual confirmation", async () => {
  const result = await createShippingProviderService({ credentials: () => keys, request: mockRequest(401, 403) }).getConnections();
  assert.equal(result.activeProvider, null);
  assert.equal(result.usingBackup, false);
  assert.equal(result.manualRequired, true);
  assert.equal(result.automaticBookings, false);
});

test("Missing keys do not contact either provider", async () => {
  const result = await createShippingProviderService({
    credentials: () => ({}),
    request: async () => { throw new Error("A request must not be made"); },
  }).getConnections();
  assert.deepEqual(result.providers.map(p => p.status), ["missing_key", "missing_key"]);
  assert.equal(result.manualRequired, true);
});

test("Sandbox credentials are never treated as live shipping access", async () => {
  const result = await createShippingProviderService({
    credentials: () => ({ shipbubble: "sb_sandbox_fixture", terminalAfrica: "sk_test_fixture" }),
    request: async () => { assert.fail("No sandbox calls in live provider selection"); },
  }).getConnections();
  assert.deepEqual(result.providers.map(p => p.status), ["test_mode", "test_mode"]);
  assert.equal(result.activeProvider, null);
});

test("An explicitly sandbox Terminal configuration is not an operational backup", async () => {
  const result = await createShippingProviderService({
    credentials: () => ({ ...keys, terminalEnvironment: "sandbox" }),
    request: mockRequest(503),
  }).getConnections();
  assert.equal(result.providers[1].status, "test_mode");
  assert.equal(result.manualRequired, true);
});

test("An empty operational catalog uses the backup rather than inventing a rate", async () => {
  const result = await createShippingProviderService({
    credentials: () => keys,
    request: async (url) => String(url).includes("shipbubble")
      ? json({ status: "success", data: [] }) : json(terminalBody),
  }).getConnections();
  assert.equal(result.providers[0].status, "no_carriers");
  assert.equal(result.activeProvider, "terminal_africa");
});

test("Malformed provider responses are rejected and never returned to clients", async () => {
  const result = await createShippingProviderService({
    credentials: () => keys,
    request: async () => json({ status: "success", data: { unexpected: keys.shipbubble } }),
  }).getConnections();
  assert.deepEqual(result.providers.map(p => p.status), ["invalid_response", "invalid_response"]);
  assert.equal(result.manualRequired, true);
  assert.equal(JSON.stringify(result).includes(keys.shipbubble), false);
});

test("Cache and concurrent deduplication prevent repeated outage probes", async () => {
  let calls = 0;
  let time = 100_000;
  const service = createShippingProviderService({
    credentials: () => keys, now: () => time,
    request: async () => { calls++; return json({}, 503); },
  });
  await Promise.all([service.getConnections(), service.getConnections()]);
  assert.equal(calls, 2);
  time += 59_000;
  await service.getConnections();
  assert.equal(calls, 2);
  time += 2_000;
  await service.getConnections();
  assert.equal(calls, 4);
});

test("Changing a credential invalidates its cached rejection immediately", async () => {
  let config = { ...keys };
  let primaryCalls = 0;
  const service = createShippingProviderService({
    credentials: () => config,
    request: async (url) => {
      if (String(url).includes("shipbubble")) return json(shipbubbleBody, ++primaryCalls === 1 ? 401 : 200);
      return json(terminalBody, 401);
    },
  });
  assert.equal((await service.getConnections()).manualRequired, true);
  config = { ...keys, shipbubble: "sb_prod_replacement_fixture" };
  assert.equal((await service.getConnections()).activeProvider, "shipbubble");
  assert.equal(primaryCalls, 2);
});

test("Network errors cannot leak credentials in the status response", async () => {
  const result = await createShippingProviderService({
    credentials: () => keys,
    request: async () => { throw new Error(`Sensitive provider detail: ${keys.shipbubble}`); },
  }).getConnections();
  assert.equal(result.manualRequired, true);
  assert.equal(JSON.stringify(result).includes(keys.shipbubble), false);
  assert.deepEqual(result.providers.map(p => p.status), ["unavailable", "unavailable"]);
});

test("A stalled primary times out and selects the verified backup", async () => {
  // AbortSignal's timer is unreferenced in Node; keep the test process alive.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await createShippingProviderService({
      credentials: () => keys, timeoutMs: 10,
      request: async (url, init) => {
        if (!String(url).includes("shipbubble")) return json(terminalBody);
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("Timed out")), { once: true });
        });
      },
    }).getConnections();
    assert.equal(result.providers[0].status, "timeout");
    assert.equal(result.activeProvider, "terminal_africa");
  } finally { clearTimeout(keepAlive); }
});
