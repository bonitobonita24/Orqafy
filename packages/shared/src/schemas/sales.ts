import { z } from "zod";

export const proposalStatusSchema = z.enum([
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
]);

export const proposalSchema = z.object({
  id: z.string(),
  proposalNumber: z.string(),
  customerId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: proposalStatusSchema,
  validUntil: z.coerce.date().nullable(),
  totalAmount: z.number(),
  currency: z.string(),
  preparedById: z.string(),
  sentAt: z.coerce.date().nullable(),
  respondedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const proposalAttachmentSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  name: z.string(),
  fileUrl: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
});

export const proposalLinkSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  label: z.string(),
  url: z.string(),
  createdAt: z.coerce.date(),
});

export const proposalRevisionSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  revisionNumber: z.number().int(),
  changesDescription: z.string(),
  snapshotData: z.record(z.string(), z.unknown()),
  createdById: z.string(),
  createdAt: z.coerce.date(),
});

export const quotationStatusSchema = z.enum([
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
]);

export const quotationSchema = z.object({
  id: z.string(),
  quotationNumber: z.string(),
  customerId: z.string(),
  proposalId: z.string().nullable(),
  title: z.string(),
  status: quotationStatusSchema,
  validUntil: z.coerce.date().nullable(),
  subtotal: z.number(),
  taxAmount: z.number(),
  totalAmount: z.number(),
  currency: z.string(),
  notes: z.string().nullable(),
  preparedById: z.string(),
  sentAt: z.coerce.date().nullable(),
  respondedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const quotationSectionSchema = z.object({
  id: z.string(),
  quotationId: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const quotationMarkupColumnSchema = z.object({
  id: z.string(),
  quotationId: z.string(),
  name: z.string(),
  percentage: z.number(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const quotationLineItemSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  productId: z.string().nullable(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  markedUpPrice: z.number(),
  totalPrice: z.number(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const quotationLineItemMarkupSchema = z.object({
  id: z.string(),
  lineItemId: z.string(),
  markupColumnId: z.string(),
  percentage: z.number(),
  computedPrice: z.number(),
  createdAt: z.coerce.date(),
});

export const quotationRevisionSchema = z.object({
  id: z.string(),
  quotationId: z.string(),
  revisionNumber: z.number().int(),
  changesDescription: z.string(),
  snapshotData: z.record(z.string(), z.unknown()),
  createdById: z.string(),
  createdAt: z.coerce.date(),
});
