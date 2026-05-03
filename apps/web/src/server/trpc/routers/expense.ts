import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

const expenseInput = z.object({
  expenseCategoryId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  description: z.string().min(1).max(1000),
  amount: z.number().positive(),
  currency: z.string().length(3).default("PHP"),
  date: z.date(),
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export const expenseRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        status: z.string().optional(),
        projectId: z.string().cuid().optional(),
        categoryId: z.string().cuid().optional(),
      })
    )
    .query(async ({ input }) => {
      const where = {
        ...(input.status !== undefined && input.status !== "" ? { status: input.status } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.categoryId !== undefined ? { expenseCategoryId: input.categoryId } : {}),
      };
      const [items, total] = await Promise.all([
        db.expense.findMany({
          where,
          include: {
            expenseCategory: { select: { name: true, code: true } },
            createdBy: { select: { firstName: true, lastName: true, displayName: true } },
            approvedBy: { select: { firstName: true, lastName: true, displayName: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { date: "desc" },
        }),
        db.expense.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ input }) => {
      const item = await db.expense.findUnique({
        where: { id: input.id },
        include: {
          expenseCategory: true,
          createdBy: { select: { firstName: true, lastName: true, displayName: true, email: true } },
          approvedBy: { select: { firstName: true, lastName: true, displayName: true } },
        },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(expenseInput)
    .mutation(async ({ input, ctx }) => {
      const expenseNumber = `EXP-${Date.now()}`;
      return db.expense.create({
        data: {
          expenseCategoryId: input.expenseCategoryId,
          projectId: input.projectId ?? null,
          description: input.description,
          amount: input.amount,
          currency: input.currency,
          date: input.date,
          receiptUrl: input.receiptUrl ?? null,
          notes: input.notes ?? null,
          expenseNumber,
          createdById: ctx.userId,
          status: "pending",
        },
      });
    }),

  approve: writeProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.expense.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending expenses can be approved." });
      }
      return db.expense.update({
        where: { id: input.id },
        data: { status: "approved", approvedById: ctx.userId, approvedAt: new Date() },
      });
    }),

  reject: writeProcedure
    .input(z.object({ id: z.string().cuid(), notes: z.string().max(500).optional() }))
    .mutation(async ({ input }) => {
      const existing = await db.expense.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending expenses can be rejected." });
      }
      return db.expense.update({
        where: { id: input.id },
        data: { status: "rejected", notes: input.notes ?? existing.notes },
      });
    }),

  categories: protectedProcedure.query(async () => {
    return db.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }),
});
