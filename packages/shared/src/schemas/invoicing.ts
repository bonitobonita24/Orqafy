import { z } from "zod";

export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]);

export const invoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  customerId: z.string(),
  quotationId: z.string().nullable(),
  subscriptionId: z.string().nullable(),
  status: invoiceStatusSchema,
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  subtotal: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  currency: z.string(),
  notes: z.string().nullable(),
  publicToken: z.string().nullable(),
  signatureUrl: z.string().nullable(),
  isPublished: z.boolean(),
  preparedById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const paymentMethodSchema = z.enum([
  "cash",
  "bank_transfer",
  "card",
  "gcash",
  "maya",
  "xendit",
  "check",
  "other",
]);

export const paymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amount: z.number(),
  currency: z.string(),
  method: paymentMethodSchema,
  referenceNumber: z.string().nullable(),
  xenditPaymentId: z.string().nullable(),
  notes: z.string().nullable(),
  paidAt: z.coerce.date(),
  receivedById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const subscriptionStatusSchema = z.enum([
  "active",
  "paused",
  "cancelled",
  "expired",
]);

export const subscriptionFrequencySchema = z.enum([
  "monthly",
  "quarterly",
  "yearly",
]);

export const subscriptionSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  frequency: subscriptionFrequencySchema,
  status: subscriptionStatusSchema,
  startDate: z.coerce.date(),
  nextBillingDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
