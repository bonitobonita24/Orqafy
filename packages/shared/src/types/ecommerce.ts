export type EcommerceOrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type EcommerceOrderType = "online" | "in_store";

export type EcommerceOrder = {
  id: string;
  orderNumber: string;
  customerId: string | null;
  orderType: EcommerceOrderType;
  status: EcommerceOrderStatus;
  subtotal: number;
  discountAmount: number;
  customerTierDiscount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  shippingAddress: string | null;
  billingAddress: string | null;
  notes: string | null;
  xenditInvoiceId: string | null;
  xenditPaymentMethod: string | null;
  xenditPaidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EcommerceOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalPrice: number;
  serialNumberIds: string[];
  createdAt: Date;
};
