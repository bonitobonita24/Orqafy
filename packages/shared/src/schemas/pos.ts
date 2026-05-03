import { z } from "zod";

export const posSessionStatusSchema = z.enum(["open", "closed"]);

export const posSessionSchema = z.object({
  id: z.string(),
  openedById: z.string(),
  closedById: z.string().nullable(),
  fundSourceId: z.string(),
  openingCash: z.number(),
  closingCash: z.number().nullable(),
  status: posSessionStatusSchema,
  openedAt: z.coerce.date(),
  closedAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const posSaleStatusSchema = z.enum(["completed", "voided", "refunded"]);

export const posSaleSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  customerId: z.string().nullable(),
  invoiceId: z.string().nullable(),
  totalAmount: z.number(),
  discountAmount: z.number(),
  taxAmount: z.number(),
  netAmount: z.number(),
  paymentMethod: z.string(),
  status: posSaleStatusSchema,
  soldById: z.string(),
  createdAt: z.coerce.date(),
});

export const posSaleItemSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  discountAmount: z.number(),
  totalPrice: z.number(),
  serialNumberIds: z.array(z.string()),
  createdAt: z.coerce.date(),
});
