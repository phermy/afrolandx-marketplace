type PaymentCompletionStorage = {
  markOrderPaid(id: number, reference: string): Promise<boolean>;
  updateOrderStatus(id: number, status: string): Promise<void>;
  updateOrderStockReservationStatus(id: number, status: 'reserved' | 'failed'): Promise<void>;
  clearCart(userId: string): Promise<void>;
  getOrderItemsWithProducts(orderId: number): Promise<Array<{ productId: number; quantity: number }>>;
  decrementProductStockIfAvailable(id: number, quantity: number): Promise<boolean>;
  addLoyaltyPoints(userId: string, points: number, actionType: string, description: string, referenceId?: number, referenceType?: string): Promise<void>;
  getProduct(id: number): Promise<{ vendorId: number } | undefined>;
  getVendor(id: number): Promise<{ userId: string; status?: string | null } | undefined>;
  getAdminUsers(): Promise<Array<{ id: string }>>;
  createNotification(notification: {
    userId: string;
    title: string;
    message: string;
    type: string;
    orderId: number;
  }): Promise<unknown>;
};

export function createVerifiedOrderCompleter(
  storage: PaymentCompletionStorage,
  createFinanceLedger: (orderId: number) => Promise<void> = async () => {},
) {
  return async function completeVerifiedOrder(order: any, reference: string): Promise<boolean> {
    const transitioned = await storage.markOrderPaid(order.id, reference);
    if (!transitioned) return false;
    await createFinanceLedger(order.id);

    const awaitingShipping = !!order.shippingEstimatedAmount && !order.shippingFinalAmount;
    await storage.clearCart(order.userId);
    const items = await storage.getOrderItemsWithProducts(order.id);

    let allStockReserved = true;
    for (const item of items) {
      const reduced = await storage.decrementProductStockIfAvailable(item.productId, item.quantity);
      if (!reduced) {
        allStockReserved = false;
        console.error(`Stock could not be reserved for paid order ${order.id}, product ${item.productId}`);
      }
    }
    await storage.updateOrderStockReservationStatus(order.id, allStockReserved ? 'reserved' : 'failed');

    const points = Math.floor(Number(order.totalAmount) / 1000);
    if (points > 0) {
      await storage.addLoyaltyPoints(
        order.userId, points, 'purchase', `Points for Order #${order.id}`, order.id, 'order',
      ).catch(error => console.error('Failed to award loyalty points:', error));
    }

    const notifiedVendors = new Set<number>();
    let allVendorsApproved = true;
    for (const item of items) {
      const product = await storage.getProduct(item.productId);
      if (!product) {
        allVendorsApproved = false;
        continue;
      }
      if (notifiedVendors.has(product.vendorId)) continue;
      const vendor = await storage.getVendor(product.vendorId);
      if (!vendor || vendor.status !== 'approved') {
        allVendorsApproved = false;
        continue;
      }
      await storage.createNotification({
        userId: vendor.userId,
        title: 'New Order Received',
        message: awaitingShipping
          ? `Payment was confirmed for order #${order.id}. You can begin preparing the items while Afrolandx confirms shipping before dispatch.`
          : `Payment was confirmed for order #${order.id}, worth ₦${Number(order.totalAmount).toLocaleString()}.`,
        type: 'order',
        orderId: order.id,
      }).catch(error => console.error('Failed to notify vendor:', error));
      notifiedVendors.add(product.vendorId);
    }
    const shippingResolved = !awaitingShipping && ['included', 'paid'].includes(order.shippingPaymentStatus);
    if (allStockReserved && allVendorsApproved && shippingResolved) {
      await storage.updateOrderStatus(order.id, 'processing');
    }

    const admins = await storage.getAdminUsers();
    for (const admin of admins) {
      await storage.createNotification({
        userId: admin.id,
        title: 'New Order Placed',
        message: awaitingShipping
          ? `Order #${order.id} is paid and can enter preparation while the final shipping price is confirmed.`
          : `Order #${order.id}, worth ₦${Number(order.totalAmount).toLocaleString()}, has been paid.`,
        type: 'order',
        orderId: order.id,
      }).catch(error => console.error('Failed to notify admin:', error));
    }
    return true;
  };
}