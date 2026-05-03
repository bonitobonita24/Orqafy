import { z } from "zod";

export const ticketPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const ticketStatusSchema = z.enum([
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
]);

export const ticketSchema = z.object({
  id: z.string(),
  ticketNumber: z.string(),
  subject: z.string(),
  description: z.string(),
  customerId: z.string().nullable(),
  assignedToId: z.string().nullable(),
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  resolvedAt: z.coerce.date().nullable(),
  closedAt: z.coerce.date().nullable(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const ticketCommentSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  userId: z.string(),
  content: z.string(),
  isInternal: z.boolean(),
  createdAt: z.coerce.date(),
});

export const ticketAttachmentSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  uploadedById: z.string(),
  uploadedAt: z.coerce.date(),
});
