import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

export const payrollRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.status !== undefined && input.status !== "" ? { status: input.status } : {}),
      };
      const [items, total] = await Promise.all([
        db.payroll.findMany({
          where,
          include: { _count: { select: { payslips: true } } },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { periodStart: "desc" },
        }),
        db.payroll.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input }) => {
      const item = await db.payroll.findUnique({
        where: { id: input.id },
        include: {
          payslips: {
            include: {
              employee: {
                include: {
                  user: { select: { firstName: true, lastName: true, displayName: true } },
                },
              },
            },
          },
        },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(
      z.object({
        periodStart: z.date(),
        periodEnd: z.date(),
        currency: z.string().length(3).default("PHP"),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const payrollNumber = `PAY-${Date.now()}`;
      return db.payroll.create({
        data: {
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          currency: input.currency,
          notes: input.notes ?? null,
          payrollNumber,
          status: "draft",
        },
      });
    }),

  process: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input }) => {
      const existing = await db.payroll.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft payrolls can be processed." });
      }
      return db.payroll.update({
        where: { id: input.id },
        data: { status: "processing", processedAt: new Date() },
      });
    }),

  approve: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input }) => {
      const existing = await db.payroll.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "processing") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only processing payrolls can be approved." });
      }
      return db.payroll.update({
        where: { id: input.id },
        data: { status: "approved" },
      });
    }),

  markPaid: writeProcedure
    .input(z.object({ id: z.string().cuid(), paidAt: z.date().optional() }))
    .mutation(async ({ input }) => {
      const existing = await db.payroll.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved payrolls can be marked as paid." });
      }
      return db.payroll.update({
        where: { id: input.id },
        data: { status: "paid", paidAt: input.paidAt ?? new Date() },
      });
    }),
});
