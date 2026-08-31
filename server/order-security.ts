import crypto from "crypto";

export const SHIPPING_QUOTES = [
  { carrier: 'UPS', service: 'UPS Standard', price: 15000, duration: '5-7 business days' },
  { carrier: 'FedEx', service: 'FedEx Express', price: 25000, duration: '3-5 business days' },
  { carrier: 'DHL', service: 'DHL Express', price: 40000, duration: '1-2 business days' },
] as const;

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
  let subtotal = 0;

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
    subtotal += price * item.quantity;
  }

  return subtotal;
}

export function calculateCheckoutTotal(cartItems: CheckoutCartItem[], shippingMethod: unknown) {
  const shippingQuote = getShippingQuote(shippingMethod);
  if (!shippingQuote) throw new CheckoutValidationError('Invalid shipping method');

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
  if (data.metadata?.userId !== undefined && data.metadata.userId !== order.userId) {
    return 'Payment metadata mismatch';
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
