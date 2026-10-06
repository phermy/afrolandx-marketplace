export type AccountCommerceItem = {
  orderId: number;
  productId: number;
  productName: string | null;
  quantity: number;
  unitPrice: string;
  paymentStatus: string | null;
  orderStatus: string | null;
  createdAt: Date | string | null;
};
