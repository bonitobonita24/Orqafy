import { z } from "zod";

export const tenantContextSchema = z.object({
  tenantId: z.string(),
  tenantSlug: z.string(),
  schemaName: z.string(),
});

export const paginationParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

export const sortDirectionSchema = z.enum(["asc", "desc"]);

export const sortParamsSchema = z.object({
  field: z.string(),
  direction: sortDirectionSchema,
});

export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const fileUploadMetaSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  storagePath: z.string(),
});

export const auditActionSchema = z.enum(["CREATE", "UPDATE", "DELETE"]);

export const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const currencySchema = z.string();
