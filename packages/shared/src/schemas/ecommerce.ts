import { z } from "zod";

export const ecommerceOrderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const ecommerceOrderTypeSchema = z.enum(["online", "in_store"]);

export const ecommerceOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerId: z.string().nullable(),
  orderType: ecommerceOrderTypeSchema,
  status: ecommerceOrderStatusSchema,
  subtotal: z.number(),
  discountAmount: z.number(),
  customerTierDiscount: z.number(),
  taxAmount: z.number(),
  shippingAmount: z.number(),
  totalAmount: z.number(),
  currency: z.string(),
  shippingAddress: z.string().nullable(),
  billingAddress: z.string().nullable(),
  notes: z.string().nullable(),
  xenditInvoiceId: z.string().nullable(),
  xenditPaymentMethod: z.string().nullable(),
  xenditPaidAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ecommerceOrderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  discountAmount: z.number(),
  totalPrice: z.number(),
  serialNumberIds: z.array(z.string()),
  createdAt: z.coerce.date(),
});
