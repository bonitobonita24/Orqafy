import { z } from "zod";

export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  isActive: z.boolean(),
  schemaName: z.string(),
  domain: z.string().nullable(),
  logoUrl: z.string().nullable(),
  planId: z.string().nullable(),
  settings: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  maxUsers: z.number().int(),
  maxStorageMb: z.number().int(),
  features: z.array(z.string()),
  priceMonthly: z.number(),
  priceYearly: z.number(),
  currency: z.string(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const tenantSubscriptionStatusSchema = z.enum([
  "active",
  "past_due",
  "cancelled",
  "trialing",
]);

export const billingCycleSchema = z.enum(["monthly", "yearly"]);

export const tenantSubscriptionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  planId: z.string(),
  status: tenantSubscriptionStatusSchema,
  billingCycle: billingCycleSchema,
  currentPeriodStart: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
  cancelledAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const tenantInvoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
]);

export const tenantInvoiceSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  subscriptionId: z.string(),
  invoiceNumber: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: tenantInvoiceStatusSchema,
  dueDate: z.coerce.date(),
  paidAt: z.coerce.date().nullable(),
  xenditInvoiceId: z.string().nullable(),
  xenditInvoiceUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const tenantPaymentStatusSchema = z.enum([
  "pending",
  "completed",
  "failed",
  "refunded",
]);

export const tenantPaymentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  invoiceId: z.string(),
  amount: z.number(),
  currency: z.string(),
  method: z.string(),
  xenditPaymentId: z.string().nullable(),
  status: tenantPaymentStatusSchema,
  paidAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const tenantAuditLogSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const tenantSmtpConfigSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  host: z.string(),
  port: z.number().int(),
  username: z.string(),
  fromAddress: z.string(),
  fromName: z.string(),
  useTls: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const tenantXenditConfigSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
