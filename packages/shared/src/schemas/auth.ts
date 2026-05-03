import { z } from "zod";

export const roleNameSchema = z.enum([
  "platform_owner",
  "tenant_super_admin",
  "admin",
  "accountant",
  "hr_manager",
  "project_manager",
  "sales_staff",
  "purchasing_staff",
  "inventory_staff",
  "staff",
  "cashier",
  "support_agent",
  "customer",
]);

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  passwordHash: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable(),
  roleId: z.string(),
  departmentId: z.string().nullable(),
  isActive: z.boolean(),
  securityVersion: z.number().int(),
  lastLoginAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const roleSchema = z.object({
  id: z.string(),
  name: roleNameSchema,
  displayName: z.string(),
  permissions: z.array(z.string()),
  isSystem: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const departmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  managerId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const auditLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.coerce.date(),
});
