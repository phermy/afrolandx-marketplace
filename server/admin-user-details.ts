import type { storage as appStorage } from "./storage";
import { sanitizeUser } from "./auth";

export async function getAdminUserDetails(
  storage: Pick<typeof appStorage, "getUser" | "getSavedDeliveryAddresses" | "getOrdersForUser" | "getVendorByUserId">,
  userId: string,
) {
  const account = await storage.getUser(userId);
  if (!account) return null;
  const [addresses, orders, vendor] = await Promise.all([
    storage.getSavedDeliveryAddresses(userId),
    storage.getOrdersForUser(userId),
    storage.getVendorByUserId(userId),
  ]);
  return {
    account: sanitizeUser(account),
    addresses: addresses.map(address => ({
      id: address.id, label: address.label, firstName: address.firstName, lastName: address.lastName,
      address1: address.address1, address2: address.address2, city: address.city, state: address.state,
      postalCode: address.postalCode, country: address.country, isDefault: address.isDefault,
    })),
    orderCount: orders.length,
    orders: orders.slice(0, 20).map(order => ({
      id: order.id, totalAmount: order.totalAmount, paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus, createdAt: order.createdAt,
    })),
    vendor: vendor ? {
      businessName: vendor.businessName, contactName: vendor.contactName, phone: vendor.phone,
      cacNumber: vendor.cacNumber, status: vendor.status, verificationStatus: vendor.verificationStatus,
    } : null,
  };
}
