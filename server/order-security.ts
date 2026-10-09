import crypto from "crypto";

export const SHIPPING_QUOTES = [
  { carrier: 'UPS', service: 'UPS Standard', price: null, duration: 'Rate on request', quoteRequired: true },
  { carrier: 'FedEx', service: 'FedEx Express', price: null, duration: 'Rate on request', quoteRequired: true },
  { carrier: 'DHL', service: 'DHL Express', price: null, duration: 'Rate on request', quoteRequired: true },
  {
    carrier: 'CargoNaija',
    service: 'CargoNaija — Air & Sea Export',
    price: null,
    duration: 'Rate on request',
    quoteRequired: true,
    routes: 'Nigeria → UK, USA, Canada',
    notes: 'Handles Ankara, textiles, and dried-food exports; air and sea cargo available.',
  },
  {
    carrier: 'Terminal Africa',
    service: 'Terminal Africa — International',
    price: null,
    duration: 'Rate on request',
    quoteRequired: true,
    routes: 'Nigeria → USA and other destinations',
    notes: 'International shipping platform used by Nigerian ecommerce brands.',
  },
  {
    carrier: 'Haulam',
    service: 'Haulam — Value Export',
    price: null,
    duration: 'Rate on request',
    quoteRequired: true,
    routes: 'Nigeria → USA, UK',
    notes: 'Value Export tier is designed for cost-effective shipping of local products.',
  },
  {
    carrier: 'African Import Export Solutions',
    service: 'African Import Export Solutions — Worldwide',
    price: null,
    duration: 'Rate on request',
    quoteRequired: true,
    routes: 'Nigeria → worldwide',
    notes: 'Warehouses in Lagos, Abuja, and Ibadan; formerly Shiptonaija.',
  },
  {
    carrier: 'Hezelinks',
    service: 'Hezelinks — UK Air Freight',
    price: null,
    duration: 'Rate on request',
    quoteRequired: true,
    routes: 'Nigeria → UK',
    notes: 'Handles artwork and food items; food shipments require proper import licensing.',
  },
] as const;

/** Static, explainable ranking only; carrier quotes remain authoritative. */
export function recommendShippingCarriers(input: {
  country?: string;
  totalWeight?: number;
  subtotal?: number;
}) {
  const countryInput = (input.country || '').trim().toLowerCase();
  const countryAliases: Record<string, string> = {
    'united states': 'usa',
    'united states of america': 'usa',
    us: 'usa',
    'united kingdom': 'uk',
    'great britain': 'uk',
    gb: 'uk',
    ng: 'nigeria',
  };
  const country = countryAliases[countryInput] || countryInput;
  const weight = Math.max(0, Number(input.totalWeight) || 0);
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const domestic = country === 'nigeria' || country === 'ng';
  const ranked = SHIPPING_QUOTES.map((carrier, index) => {
    let score = 50 - index;
    const reasons: string[] = [];
    const routes = 'routes' in carrier ? carrier.routes?.toLowerCase() : '';
    if (!domestic && routes?.includes(country)) {
      score += 25; reasons.push('listed route coverage');
    }
    if (weight > 15 && ['cargonaija', 'african import export solutions'].includes(carrier.carrier.toLowerCase())) {
      score += 12; reasons.push('better fit for heavier consignments');
    }
    if (subtotal > 250000 && carrier.service.toLowerCase().includes('express')) {
      score += 4; reasons.push('express option for higher-value orders');
    }
    if (!reasons.length) reasons.push('available for manual quote review');
    return { carrier: carrier.carrier, score, reasons };
  }).sort((a, b) => b.score - a.score);
  return { basis: 'static_catalog_rules', liveRates: false, ranked };
}

export type CheckoutCartItem = {
  quantity: number;
  selectedSize?: string | null;
  product?: {
    name: string;
    price: string | number;
    stock: number;
    sizes?: unknown;
    status?: string | null;
  } | null;
};

export type OwnedCartItem = {
  id: number;
  userId: string;
};

export function createCartFingerprint(cartItems: Array<CheckoutCartItem & { productId?: number; selectedSize?: string | null }>): string {
  const normalized = cartItems
    .map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      selectedSize: item.selectedSize ?? null,
      price: item.product ? Number(item.product.price).toFixed(2) : null,
    }))
    .sort((a, b) => (a.productId || 0) - (b.productId || 0) || String(a.selectedSize).localeCompare(String(b.selectedSize)));
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export class CheckoutValidationError extends Error {}

export function findOwnedCartItem<T extends OwnedCartItem>(
  cartItems: T[],
  userId: string,
  cartItemId: number,
): T | undefined {
  return cartItems.find(item => item.id === cartItemId && item.userId === userId);
}

export function getShippingQuote(shippingMethod: unknown) {
  if (typeof shippingMethod !== 'string') return undefined;
  return SHIPPING_QUOTES.find(quote => quote.carrier.toLowerCase() === shippingMethod.toLowerCase());
}

export function calculateCheckoutSubtotal(cartItems: CheckoutCartItem[]): number {
  let subtotalKobo = 0;

  for (const item of cartItems) {
    const product = item.product;
    if (!product || product.status !== 'approved') {
      throw new CheckoutValidationError('A cart item is no longer available');
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > product.stock) {
      throw new CheckoutValidationError(`${product.name} does not have enough stock`);
    }

    const sizes = Array.isArray(product.sizes)
      ? product.sizes.filter((size): size is string => typeof size === 'string')
      : [];
    if (sizes.length > 0 && (!item.selectedSize || !sizes.includes(item.selectedSize))) {
      throw new CheckoutValidationError(`Select a valid size for ${product.name}`);
    }

    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new CheckoutValidationError('A cart item has an invalid price');
    }
    const lineKobo = Math.round(price * 100) * item.quantity;
    if (!Number.isSafeInteger(lineKobo) || !Number.isSafeInteger(subtotalKobo + lineKobo)) {
      throw new CheckoutValidationError('Cart amount is outside the supported range');
    }
    subtotalKobo += lineKobo;
  }

  return subtotalKobo / 100;
}

const SHIPPING_ESTIMATE_MULTIPLIERS: Record<string, number> = {
  ups: 1.15,
  fedex: 1.12,
  dhl: 1.1,
  cargonaija: 0.92,
  'terminal africa': 0.95,
  haulam: 0.9,
  'african import export solutions': 0.88,
  hezelinks: 0.9,
};

export function calculateEstimatedShippingAmount(subtotal: number, shippingMethod: unknown): number {
  const shippingQuote = getShippingQuote(shippingMethod);
  if (!shippingQuote) throw new CheckoutValidationError('Invalid shipping method');
  if (!Number.isFinite(subtotal) || subtotal <= 0) throw new CheckoutValidationError('Cart subtotal is invalid');
  const multiplier = SHIPPING_ESTIMATE_MULTIPLIERS[shippingQuote.carrier.toLowerCase()] ?? 1;
  const estimate = (7500 + subtotal * 0.06) * multiplier;
  return Math.min(50000, Math.max(7500, Math.ceil(estimate / 500) * 500));
}

export function calculateCheckoutTotal(cartItems: CheckoutCartItem[], shippingMethod: unknown) {
  const shippingQuote = getShippingQuote(shippingMethod);
  if (!shippingQuote) throw new CheckoutValidationError('Invalid shipping method');
  if (shippingQuote.quoteRequired || shippingQuote.price === null) {
    throw new CheckoutValidationError(`${shippingQuote.carrier} shipping requires a confirmed shipping quote before payment`);
  }

  const subtotal = calculateCheckoutSubtotal(cartItems);
  return {
    subtotal,
    shippingAmount: shippingQuote.price,
    totalAmount: subtotal + shippingQuote.price,
    shippingMethod: shippingQuote.carrier.toLowerCase(),
    shippingQuote,
  };
}

export function paymentVerificationError(order: any, verification: any, reference: string): string | null {
  const data = verification?.data;
  if (!verification?.status || data?.status !== 'success') return 'Payment was not successful';
  if (data.reference !== reference || order.paymentReference !== reference) return 'Payment reference mismatch';
  if (data.currency !== 'NGN') return 'Payment currency mismatch';

  const expectedKobo = Math.round(Number(order.totalAmount) * 100);
  if (!Number.isSafeInteger(data.amount) || data.amount !== expectedKobo) return 'Payment amount mismatch';

  const metadataOrderId = Number(data.metadata?.orderId);
  if (!Number.isSafeInteger(metadataOrderId) || metadataOrderId !== order.id) {
    return 'Payment metadata mismatch';
  }
  if (data.metadata?.userId !== undefined && data.metadata.userId !== (order.shippingAddress?._paymentOwnerId || order.userId)) {
    return 'Payment metadata mismatch';
  }
  const email = order.shippingAddress?.contactEmail;
  if (email && String(data.customer?.email || '').toLowerCase() !== String(email).toLowerCase()) {
    return 'Payment customer mismatch';
  }
  return null;
}

export function shippingPaymentVerificationError(order: any, verification: any, reference: string): string | null {
  const data = verification?.data;
  if (!verification?.status || data?.status !== 'success') return 'Shipping payment was not successful';
  if (data.reference !== reference || order.shippingPaymentReference !== reference) return 'Shipping payment reference mismatch';
  if (data.currency !== 'NGN') return 'Shipping payment currency mismatch';

  const expectedKobo = Math.round(Number(order.shippingAmount) * 100);
  if (!Number.isSafeInteger(data.amount) || data.amount !== expectedKobo) return 'Shipping payment amount mismatch';
  if (Number(data.metadata?.orderId) !== order.id || data.metadata?.userId !== order.userId || data.metadata?.paymentType !== 'shipping') {
    return 'Shipping payment metadata mismatch';
  }
  return null;
}

export function isValidPaystackWebhookSignature(
  rawBody: unknown,
  signature: unknown,
  secret: unknown,
): boolean {
  if (typeof secret !== 'string' || !secret || !Buffer.isBuffer(rawBody) || typeof signature !== 'string') return false;

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
