import type { RequestHandler } from "express";

const CLIENT_AMOUNT_FIELDS = new Set([
  "amount", "totalAmount", "subtotal", "shippingAmount", "shippingPrice",
  "taxAmount", "discountAmount", "platformFee", "payableAmount", "priceAtTime",
]);
/** expectedTotalAmount is only a stale-price assertion, never the charge source. */
export const rejectClientAmounts: RequestHandler = (req, res, next) => {
  if (req.body && Object.keys(req.body).some(key => CLIENT_AMOUNT_FIELDS.has(key))) {
    return void res.status(400).json({ message: "Amounts are calculated by the server. Refresh checkout and try again." });
  }
  next();
};
