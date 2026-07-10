import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";
import { rateLimiters } from "@/server/lib/rate-limit";
import { sanitizePlainText } from "@/server/lib/sanitize";
import { createNotification } from "@/server/notifications/create";

const jobOrderStatuses = [
  "received",
  "diagnosing",
  "quoted",
  "approved",
  "in_progress",
  "testing",
  "completed",
  "released",
  "cancelled",
] as const;

type JobOrderStatus = (typeof jobOrderStatuses)[number];

// Allowed transitions per status. Cancellation is permitted from any
// pre-release state. Released and cancelled are terminal.
const allowedTransitions: Record<JobOrderStatus, ReadonlySet<JobOrderStatus>> = {
  received: new Set(["diagnosing", "cancelled"]),
  diagnosing: new Set(["quoted", "in_progress", "cancelled"]),
  quoted: new Set(["approved", "cancelled"]),
  approved: new Set(["in_progress", "cancelled"]),
  in_progress: new Set(["testing", "cancelled"]),
  testing: new Set(["completed", "in_progress"]),
  completed: new Set(["released"]),
  released: new Set(),
  cancelled: new Set(),
};

const lineItemEditableStatuses = new Set([
  "received",
  "diagnosing",
  "in_progress",
  "testing",
]);

const signatureCapturableStatuses = new Set(["testing", "completed"]);

const SIGNATURE_DATA_URL_PREFIX = "data:image/png;base64,";
const MAX_SIGNATURE_DATA_URL_LENGTH = 200_000;

const jobOrderInput = z.object({
  customerId: z.string().cuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000),
  deviceType: z.string().max(100).optional(),
  deviceBrand: z.string().max(100).optional(),
  deviceModel: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  reportedIssue: z.string().min(1).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  estimatedCost: z.number().min(0).optional(),
  warranty: z.string().max(200).optional(),
}).strict();

async function loadJobOrderForTenant(id: string, ctx: { tenantId: string }) {
  const jo = await db.jobOrder.findUnique({ where: { id } });
  if (!jo || jo.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Job order not found" });
  }
  return jo;
}

export const jobOrderRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        status: z.string().optional(),
        priority: z.string().optional(),
        technicianId: z.string().cuid().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.status !== undefined && input.status !== "" ? { status: input.status } : {}),
        ...(input.priority !== undefined && input.priority !== "" ? { priority: input.priority } : {}),
        ...(input.technicianId !== undefined ? { technicianId: input.technicianId } : {}),
        ...(input.search !== undefined && input.search !== ""
          ? {
              OR: [
                { title: { contains: input.search, mode: "insensitive" as const } },
                { jobOrderNumber: { contains: input.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        db.jobOrder.findMany({
          where,
          include: {
            customer: { select: { firstName: true, lastName: true, companyName: true } },
            technician: { select: { firstName: true, lastName: true, displayName: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        db.jobOrder.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input, ctx }) => {
      const ip = ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      rateLimiters.api.check(ip);
      const jo = await loadJobOrderForTenant(input.id, ctx);
      const item = await db.jobOrder.findUnique({
        where: { id: jo.id },
        include: {
          customer: true,
          createdBy: { select: { firstName: true, lastName: true } },
          technician: { select: { firstName: true, lastName: true, displayName: true } },
          parts: { orderBy: { createdAt: "asc" } },
          serviceLines: { orderBy: { sortOrder: "asc" } },
        },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  publicView: protectedProcedure
    .input(z.object({ id: z.string().cuid(), token: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const ip = ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      rateLimiters.public_invoice.check(ip);
      await loadJobOrderForTenant(input.id, ctx);
      const item = await db.jobOrder.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          jobOrderNumber: true,
          title: true,
          status: true,
          priority: true,
          reportedIssue: true,
          diagnosis: true,
          estimatedCost: true,
          actualCost: true,
          warranty: true,
          completedAt: true,
          createdAt: true,
          customer: { select: { firstName: true, lastName: true, companyName: true } },
          technician: { select: { firstName: true, lastName: true, displayName: true } },
        },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(jobOrderInput)
    .mutation(async ({ input, ctx }) => {
      // Tenant-isolation: the customer MUST belong to the caller's tenant —
      // otherwise a job order could be linked to another tenant's customer record.
      const customer = await db.customer.findFirst({
        where: { id: input.customerId, tenantId: ctx.tenantId },
      });
      if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Customer not found." });
      const jobOrderNumber = `JO-${Date.now()}`;
      return db.jobOrder.create({
        data: {
          tenantId: ctx.tenantId,
          jobOrderNumber,
          customerId: input.customerId,
          createdById: ctx.userId,
          title: sanitizePlainText(input.title),
          description: sanitizePlainText(input.description),
          reportedIssue: sanitizePlainText(input.reportedIssue),
          priority: input.priority,
          status: "received",
          ...(input.deviceType !== undefined ? { deviceType: input.deviceType ?? null } : {}),
          ...(input.deviceBrand !== undefined ? { deviceBrand: input.deviceBrand ?? null } : {}),
          ...(input.deviceModel !== undefined ? { deviceModel: input.deviceModel ?? null } : {}),
          ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber ?? null } : {}),
          ...(input.estimatedCost !== undefined ? { estimatedCost: input.estimatedCost ?? null } : {}),
          ...(input.warranty !== undefined ? { warranty: input.warranty ?? null } : {}),
        },
      });
    }),

  updateStatus: writeProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        status: z.enum(jobOrderStatuses),
        diagnosis: z.string().max(2000).optional(),
        actualCost: z.number().min(0).optional(),
        laborCost: z.number().min(0).optional(),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await loadJobOrderForTenant(input.id, ctx);

      if (input.status !== existing.status) {
        const allowed = allowedTransitions[existing.status as JobOrderStatus];
        if (!allowed.has(input.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid status transition: ${existing.status} → ${input.status}.`,
          });
        }
        // Warranty release gate: testing → completed requires both signatures.
        if (existing.status === "testing" && input.status === "completed") {
          if (
            existing.customerSignatureUrl === null ||
            existing.technicianSignatureUrl === null
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Both customer and technician signatures are required to mark this job order completed.",
            });
          }
        }
      }

      const extra: Record<string, unknown> = {};
      if (input.status === "completed" && existing.status !== "completed") {
        extra.completedAt = new Date();
      }
      if (input.status === "released" && existing.status !== "released") {
        extra.releasedAt = new Date();
      }
      return db.jobOrder.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.diagnosis !== undefined ? { diagnosis: sanitizePlainText(input.diagnosis) } : {}),
          ...(input.actualCost !== undefined ? { actualCost: input.actualCost ?? null } : {}),
          ...(input.laborCost !== undefined ? { laborCost: input.laborCost ?? null } : {}),
          ...extra,
        },
      });
    }),

  assignTechnician: writeProcedure
    .input(z.object({ id: z.string().cuid(), technicianId: z.string().cuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const jobOrder = await loadJobOrderForTenant(input.id, ctx);
      const technician = await db.user.findUnique({ where: { id: input.technicianId } });
      // Tenant-isolation: the technician MUST belong to the caller's tenant —
      // both for the assignment itself and so the D7 notification below can
      // never be published to a cross-tenant user.
      if (!technician || technician.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Technician not found." });
      }
      const updated = await db.jobOrder.update({
        where: { id: input.id },
        data: { technicianId: input.technicianId },
      });

      // D7 — notify the assigned technician (skip self-assignment).
      if (input.technicianId !== ctx.userId) {
        await createNotification({
          tenantId: ctx.tenantId,
          recipientUserId: input.technicianId,
          category: "task_assigned",
          title: "Job order assigned",
          body: `You were assigned job order ${jobOrder.jobOrderNumber}.`,
          payload: { jobOrderId: jobOrder.id },
        });
      }

      return updated;
    }),

  addPart: writeProcedure
    .input(
      z.object({
        jobOrderId: z.string().cuid(),
        productId: z.string().cuid().optional(),
        description: z.string().min(1).max(500),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
        isFromInventory: z.boolean().default(false),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      const jobOrder = await loadJobOrderForTenant(input.jobOrderId, ctx);
      if (!lineItemEditableStatuses.has(jobOrder.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot add parts when job order status is "${jobOrder.status}".`,
        });
      }
      if (input.productId !== undefined) {
        // Tenant-isolation: the product MUST belong to the caller's tenant —
        // otherwise a job order part could reference another tenant's product.
        const product = await db.product.findFirst({
          where: { id: input.productId, tenantId: ctx.tenantId },
        });
        if (!product) throw new TRPCError({ code: "BAD_REQUEST", message: "Product not found." });
      }
      const totalPrice = input.quantity * input.unitPrice;
      return db.jobOrderPart.create({
        data: {
          tenantId: ctx.tenantId,
          jobOrderId: input.jobOrderId,
          description: sanitizePlainText(input.description),
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          totalPrice,
          isFromInventory: input.isFromInventory,
          ...(input.productId !== undefined ? { productId: input.productId } : {}),
        },
      });
    }),

  removePart: writeProcedure
    .input(z.object({ id: z.string().cuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const part = await db.jobOrderPart.findUnique({
        where: { id: input.id },
        include: { jobOrder: { select: { status: true, tenantId: true } } },
      });
      if (!part || part.jobOrder.tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
      if (!lineItemEditableStatuses.has(part.jobOrder.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot remove parts when job order status is "${part.jobOrder.status}".`,
        });
      }
      await db.jobOrderPart.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  addServiceLine: writeProcedure
    .input(
      z.object({
        jobOrderId: z.string().cuid(),
        description: z.string().min(1).max(500),
        hours: z.number().min(0).optional(),
        rate: z.number().min(0).optional(),
        amount: z.number().min(0),
        sortOrder: z.number().int().min(0).default(0),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      const jobOrder = await loadJobOrderForTenant(input.jobOrderId, ctx);
      if (!lineItemEditableStatuses.has(jobOrder.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot add service lines when job order status is "${jobOrder.status}".`,
        });
      }
      return db.jobOrderServiceLine.create({
        data: {
          tenantId: ctx.tenantId,
          jobOrderId: input.jobOrderId,
          description: sanitizePlainText(input.description),
          amount: input.amount,
          sortOrder: input.sortOrder,
          ...(input.hours !== undefined ? { hours: input.hours } : {}),
          ...(input.rate !== undefined ? { rate: input.rate } : {}),
        },
      });
    }),

  removeServiceLine: writeProcedure
    .input(z.object({ id: z.string().cuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const line = await db.jobOrderServiceLine.findUnique({
        where: { id: input.id },
        include: { jobOrder: { select: { status: true, tenantId: true } } },
      });
      if (!line || line.jobOrder.tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND" });
      if (!lineItemEditableStatuses.has(line.jobOrder.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot remove service lines when job order status is "${line.jobOrder.status}".`,
        });
      }
      await db.jobOrderServiceLine.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  recordSignature: writeProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        role: z.enum(["customer", "technician"]),
        dataUrl: z.string().min(1).max(MAX_SIGNATURE_DATA_URL_LENGTH),
      }).strict()
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.dataUrl.startsWith(SIGNATURE_DATA_URL_PREFIX)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Signature must be a PNG data URL.",
        });
      }
      const existing = await loadJobOrderForTenant(input.id, ctx);
      if (!signatureCapturableStatuses.has(existing.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot capture signature when job order status is "${existing.status}".`,
        });
      }
      const field =
        input.role === "customer" ? "customerSignatureUrl" : "technicianSignatureUrl";
      const otherSignature =
        input.role === "customer" ? existing.technicianSignatureUrl : existing.customerSignatureUrl;
      const bothPresent = otherSignature !== null && otherSignature !== undefined;
      return db.jobOrder.update({
        where: { id: input.id },
        data: {
          [field]: input.dataUrl,
          ...(bothPresent && existing.signedAt === null ? { signedAt: new Date() } : {}),
        },
      });
    }),
});
