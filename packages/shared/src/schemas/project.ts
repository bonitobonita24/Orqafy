import { z } from "zod";

export const projectStatusSchema = z.enum([
  "draft",
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);

export const projectSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  budget: z.number(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: projectStatusSchema,
  managerId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const milestoneSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  dueDate: z.coerce.date(),
  isCompleted: z.boolean(),
  isAutoCompleted: z.boolean(),
  completedAt: z.coerce.date().nullable(),
  completedOverrideById: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);
export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "done",
  "cancelled",
]);

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  projectId: z.string().nullable(),
  milestoneId: z.string().nullable(),
  parentTaskId: z.string().nullable(),
  assignedById: z.string().nullable(),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueDate: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const taskAssignmentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  userId: z.string(),
  assignedAt: z.coerce.date(),
  assignedById: z.string(),
  removedAt: z.coerce.date().nullable(),
});

export const taskAttachmentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  uploadedById: z.string(),
  uploadedAt: z.coerce.date(),
});

export const taskStatusReportSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  userId: z.string(),
  content: z.string(),
  attachmentUrls: z.array(z.string()).nullable(),
  createdAt: z.coerce.date(),
});

export const timeLogSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  userId: z.string(),
  hours: z.number(),
  description: z.string(),
  loggedAt: z.coerce.date(),
});

export const projectExpenseCostTypeSchema = z.enum([
  "direct",
  "inventory_consumed",
]);
export const projectExpenseStatusSchema = z.enum([
  "draft",
  "approved",
  "rejected",
]);

export const projectExpenseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  cashAdvanceId: z.string().nullable(),
  inventoryDisbursementItemId: z.string().nullable(),
  expenseCategoryId: z.string(),
  amount: z.number(),
  description: z.string(),
  receiptUrl: z.string().nullable(),
  fundSourceId: z.string().nullable(),
  costType: projectExpenseCostTypeSchema,
  loggedById: z.string(),
  status: projectExpenseStatusSchema,
  createdAt: z.coerce.date(),
});

export const projectNoteSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  parentId: z.string().nullable(),
  title: z.string(),
  content: z.record(z.string(), z.unknown()),
  createdById: z.string(),
  updatedById: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const projectNoteAttachmentSchema = z.object({
  id: z.string(),
  projectNoteId: z.string(),
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  uploadedById: z.string(),
  uploadedAt: z.coerce.date(),
});

export const toDoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  assignedToId: z.string().nullable(),
  dueDate: z.coerce.date().nullable(),
  isCompleted: z.boolean(),
  completedAt: z.coerce.date().nullable(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const toDoAttachmentSchema = z.object({
  id: z.string(),
  toDoId: z.string(),
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  uploadedById: z.string(),
  uploadedAt: z.coerce.date(),
});
