import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";
import { rateLimiters } from "@/server/lib/rate-limit";
import { sanitizePlainText } from "@/server/lib/sanitize";

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
});

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
    .query(async ({ input }) => {
      const where = {
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
      const item = await db.jobOrder.findUnique({
        where: { id: input.id },
        include: {
          customer: true,
          createdBy: { select: { firstName: true, lastName: true } },
          technician: { select: { firstName: true, lastName: true, displayName: true } },
          parts: true,
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
      const customer = await db.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Customer not found." });
      const jobOrderNumber = `JO-${Date.now()}`;
      return db.jobOrder.create({
        data: {
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
      })
    )
    .mutation(async ({ input }) => {
      const existing = await db.jobOrder.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const extra: Record<string, unknown> = {};
      if (input.status === "completed") extra.completedAt = new Date();
      if (input.status === "released") extra.releasedAt = new Date();
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
    .input(z.object({ id: z.string().cuid(), technicianId: z.string().cuid() }))
    .mutation(async ({ input }) => {
      const existing = await db.jobOrder.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const technician = await db.user.findUnique({ where: { id: input.technicianId } });
      if (!technician) throw new TRPCError({ code: "BAD_REQUEST", message: "Technician not found." });
      return db.jobOrder.update({
        where: { id: input.id },
        data: { technicianId: input.technicianId },
      });
    }),
});
