import { z } from "zod";

export const accountTypeSchema = z.enum([
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const accountSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: accountTypeSchema,
  parentId: z.string().nullable(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const journalEntryStatusSchema = z.enum(["draft", "posted", "void"]);

export const journalEntrySchema = z.object({
  id: z.string(),
  entryNumber: z.string(),
  date: z.coerce.date(),
  description: z.string(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  status: journalEntryStatusSchema,
  createdById: z.string(),
  postedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const journalLineSchema = z.object({
  id: z.string(),
  journalEntryId: z.string(),
  accountId: z.string(),
  debit: z.number(),
  credit: z.number(),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const taxRateSchema = z.object({
  id: z.string(),
  name: z.string(),
  rate: z.number(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const fiscalYearStatusSchema = z.enum(["open", "closed"]);

export const fiscalYearSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: fiscalYearStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const expenseCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  accountId: z.string().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
