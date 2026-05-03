import { z } from "zod";

export const customerTierSchema = z.enum(["regular", "vip", "authorized_dealer"]);

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  zipCode: z.string().nullable(),
  tier: customerTierSchema,
  tinNumber: z.string().nullable(),
  creditLimit: z.number(),
  currentBalance: z.number(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const customerContactSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  position: z.string().nullable(),
  isPrimary: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const customerCreditAccountSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  creditLimit: z.number(),
  currentBalance: z.number(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const creditTransactionTypeSchema = z.enum([
  "charge",
  "payment",
  "adjustment",
]);

export const customerCreditTransactionSchema = z.object({
  id: z.string(),
  creditAccountId: z.string(),
  type: creditTransactionTypeSchema,
  amount: z.number(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const customerDocumentSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  name: z.string(),
  fileUrl: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedById: z.string(),
  createdAt: z.coerce.date(),
});
