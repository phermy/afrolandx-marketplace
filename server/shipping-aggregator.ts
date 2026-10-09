import crypto from "crypto";

export class AggregatorError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
export const requiresDdp = (country: string) =>
  ["uk", "gb", "united kingdom", "great britain", "us", "usa", "united states", "united states of america", "ca", "canada"].includes(country.trim().toLowerCase());

export async function shipbubble(path: string, body?: unknown) {
  const key = process.env.SHIPBUBBLE_API_KEY;
  if (!key) throw new AggregatorError("Shipping is not connected. Please try again later.");
  try {
    const response = await fetch(`https://api.shipbubble.com/v1${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    const result = await response.json();
    if (!response.ok || result.status !== "success") {
      throw new AggregatorError(response.status === 401 || response.status === 403
        ? "The shipping provider denied access. Please contact support."
        : "The shipping provider could not confirm this service. Please check the address and try again.");
    }
    return result.data;
  } catch (error) {
    if (error instanceof AggregatorError) throw error;
    throw new AggregatorError("The shipping provider is temporarily unavailable. Please try again.");
  }
}

export type DeliveryContact = {
  firstName: string; lastName?: string; address1: string; address2?: string;
  city: string; state: string; postalCode: string; country: string;
  contactEmail: string; phone: string;
};
export type ProviderPackage = {
  vendorId: number; requestToken: string; courierId: string; serviceCode: string;
  carrier: string; amount: number; duties: number; deliveryDate: string; dutiesPaid: boolean;
  pickupDate?: string;
};

export function parcelDimensions(value: unknown): { length: number; width: number; height: number } {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm)?$/i);
  if (!match) throw new AggregatorError("A seller must provide parcel dimensions as length × width × height in cm before this item can be shipped.", 409);
  const [length, width, height] = match.slice(1).map(Number);
  if ([length, width, height].some(n => !Number.isFinite(n) || n <= 0 || n > 300)) throw new AggregatorError("A seller must correct the parcel dimensions before checkout.", 409);
  return { length, width, height };
}

export function selectDeliveryOptions(groups: ProviderPackage[][]) {
  if (!groups.length || groups.some(group => !group.length)) throw new AggregatorError("No complete delivery service is available for this cart.", 409);
  const strategies = [
    { name: "Economy", pick: (group: ProviderPackage[]) => [...group].sort((a,b) => a.amount + a.duties - b.amount - b.duties)[0] },
    { name: "Fastest", pick: (group: ProviderPackage[]) => [...group].sort((a,b) => Date.parse(a.deliveryDate) - Date.parse(b.deliveryDate))[0] },
    { name: "Recommended", pick: (group: ProviderPackage[]) => [...group].sort((a,b) => a.amount + a.duties - b.amount - b.duties)[Math.min(1, group.length - 1)] },
  ];
  const seen = new Set<string>();
  return strategies.flatMap(strategy => {
    const packages = groups.map(strategy.pick);
    const signature = packages.map(p => `${p.vendorId}:${p.requestToken}:${p.courierId}:${p.serviceCode}`).join("|");
    if (seen.has(signature)) return [];
    seen.add(signature);
    return [{
      name: strategy.name, packages,
      shippingAmount: Math.round(packages.reduce((sum,p) => sum + p.amount + p.duties, 0) * 100) / 100,
      dutiesAmount: Math.round(packages.reduce((sum,p) => sum + p.duties, 0) * 100) / 100,
      deliveryDate: packages.map(p => p.deliveryDate).sort((a,b) => Date.parse(b) - Date.parse(a))[0],
    }];
  });
}

export async function validateDeliveryContact(contact: DeliveryContact) {
  const result = await shipbubble("/shipping/address/validate", {
    name: `${contact.firstName} ${contact.lastName || ""}`.trim(), email: contact.contactEmail,
    phone: contact.phone,
    address: [contact.address1, contact.address2, contact.city, contact.state, contact.postalCode, contact.country].filter(Boolean).join(", "),
  });
  if (!Number.isSafeInteger(result?.address_code)) throw new AggregatorError("The provider could not validate this delivery address.", 409);
  return result.address_code as number;
}

export async function ratesForPackage(input: {
  vendorId: number; sender: DeliveryContact; receiver: DeliveryContact; categoryId: number;
  items: Array<{ name: string; description: string; unit_weight: number; unit_amount: number; quantity: number }>;
  dimensions: { length: number; width: number; height: number }; pickupDate: string;
}) {
  const senderCode = await validateDeliveryContact(input.sender);
  const receiverCode = await validateDeliveryContact(input.receiver);
  const data = await shipbubble("/shipping/fetch_rates", {
    sender_address_code: senderCode, reciever_address_code: receiverCode,
    pickup_date: input.pickupDate, category_id: input.categoryId,
    package_items: input.items, package_dimension: input.dimensions, service_type: "pickup",
  });
  if (typeof data?.request_token !== "string") throw new AggregatorError("The provider did not return a valid shipping quote.");
  const ddp = requiresDdp(input.receiver.country);
  let duties = 0;
  if (ddp) {
    const duty = await shipbubble(`/shipping/landed-cost?request_token=${encodeURIComponent(data.request_token)}&store_checkout_currency=NGN`);
    if (duty?.currency !== "NGN" || !Number.isFinite(Number(duty.amount)) || Number(duty.amount) < 0) {
      throw new AggregatorError("Prepaid import duties are unavailable for this destination. Payment is blocked until DDP is confirmed.", 409);
    }
    duties = Number(duty.amount);
  }
  return (Array.isArray(data.couriers) ? data.couriers : []).flatMap((rate: any): ProviderPackage[] => {
    // Never offer COD, foreign-currency rates, or fabricated delivery dates.
    const amount = Number(rate.total);
    const delivery = Date.parse(rate.delivery_eta_time);
    if (rate.currency !== "NGN" || !Number.isFinite(amount) || amount <= 0 ||
      !Number.isFinite(delivery) || delivery <= Date.now() ||
      !rate.service_code || rate.courier_id === undefined) return [];
    return [{
      vendorId: input.vendorId, requestToken: data.request_token, courierId: String(rate.courier_id),
      serviceCode: rate.service_code, carrier: rate.courier_name, amount, duties,
      deliveryDate: new Date(delivery).toISOString(), dutiesPaid: ddp,
      pickupDate:input.pickupDate,
    }];
  });
}

export async function createProviderLabel(p: ProviderPackage) {
  return shipbubble("/shipping/labels", {
    request_token: p.requestToken, courier_id: p.courierId, service_code: p.serviceCode,
    is_cod_label: false, duties_paid: p.dutiesPaid,
  });
}

export function validShipbubbleSignature(raw: Buffer, signature: unknown) {
  const key = process.env.SHIPBUBBLE_API_KEY;
  if (!key || typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha512", key).update(raw).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
