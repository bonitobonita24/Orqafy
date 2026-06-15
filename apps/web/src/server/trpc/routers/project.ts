import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";
import { sanitizePlainText } from "@/server/lib/sanitize";

const REAL_CASH_TYPES = new Set(["cash_on_hand", "bank", "e_wallet"]);
function isRealCashType(type: string): boolean {
  return REAL_CASH_TYPES.has(type);
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  planning: ["active", "cancelled"],
  active: ["on_hold", "completed", "cancelled"],
  on_hold: ["active", "cancelled"],
  completed: [],
  cancelled: [],
};

async function loadProjectForTenant(id: string, ctx: { tenantId: string }) {
  const p = await db.project.findUnique({ where: { id } });
  if (!p || p.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return p;
}

const projectInput = z.object({
  name: z.string().min(1).max(200),
  customerId: z.string().cuid().optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).default("planning"),
  startDate: z.date().optional(),
  targetEndDate: z.date().optional(),
  budget: z.number().positive().optional(),
});

const expenseRouter = createTRPCRouter({
  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await loadProjectForTenant(input.projectId, ctx);
      const where = { projectId: input.projectId };
      const [items, total] = await Promise.all([
        db.projectExpense.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { date: "desc" },
        }),
        db.projectExpense.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  recordProjectExpense: writeProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        amount: z.number().positive(),
        type: z.enum([
          "direct",
          "inventory_consumed",
          "labor",
          "materials",
          "subcontractor",
          "other",
        ]),
        description: z.string().min(1).max(500),
        fundSourceId: z.string().min(1),
        expenseDate: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await loadProjectForTenant(input.projectId, ctx);

      const fundSource = await db.fundSource.findUnique({ where: { id: input.fundSourceId } });
      if (!fundSource) throw new TRPCError({ code: "NOT_FOUND", message: "Fund source not found." });

      const currentBalance = parseFloat(fundSource.currentBalance.toString());
      if (isRealCashType(fundSource.type) && currentBalance < input.amount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient balance" });
      }
      const newBalance = currentBalance - input.amount;
      const expenseDate = input.expenseDate !== undefined ? new Date(input.expenseDate) : new Date();
      const cleanDescription = sanitizePlainText(input.description);

      return db.$transaction(async (tx) => {
        const expense = await tx.projectExpense.create({
          data: {
            projectId: input.projectId,
            tenantId: ctx.tenantId,
            type: input.type,
            description: cleanDescription,
            amount: input.amount,
            date: expenseDate,
          },
        });

        const transaction = await tx.fundTransaction.create({
          data: {
            tenantId: ctx.tenantId,
            fundSourceId: input.fundSourceId,
            type: "expense",
            amount: input.amount,
            runningBalance: newBalance,
            description: `Project expense: ${cleanDescription}`,
            referenceType: "project_expense",
            referenceId: expense.id,
            transactionDate: expenseDate,
            createdById: ctx.userId,
          },
        });

        const updatedExpense = await tx.projectExpense.update({
          where: { id: expense.id },
          data: {
            referenceType: "fund_transaction",
            referenceId: transaction.id,
          },
        });

        if (isRealCashType(fundSource.type)) {
          await tx.fundSource.update({
            where: { id: input.fundSourceId },
            data: { currentBalance: newBalance },
          });
        }

        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "ProjectExpense",
          entityId: updatedExpense.id,
          before: null,
          after: {
            projectId: input.projectId,
            type: input.type,
            amount: input.amount,
            description: cleanDescription,
          },
        });

        return { expense: updatedExpense, transaction };
      });
    }),
});

const milestoneRouter = createTRPCRouter({
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await loadProjectForTenant(input.projectId, ctx);
      return db.milestone.findMany({
        where: { projectId: input.projectId },
        orderBy: { sortOrder: "asc" },
      });
    }),

  create: writeProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        name: z.string().min(1).max(200),
        dueDate: z.date().optional(),
        description: z.string().max(1000).optional(),
        sortOrder: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await loadProjectForTenant(input.projectId, ctx);

      return db.$transaction(async (tx) => {
        const created = await tx.milestone.create({
          data: {
            projectId: input.projectId,
            tenantId: ctx.tenantId,
            name: sanitizePlainText(input.name),
            dueDate: input.dueDate ?? null,
            description: input.description !== undefined ? sanitizePlainText(input.description) : null,
            sortOrder: input.sortOrder ?? 0,
            progress: 0,
            completedAt: null,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Milestone",
          entityId: created.id,
          before: null,
          after: { projectId: created.projectId, name: created.name },
        });
        return created;
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        milestoneId: z.string().min(1),
        name: z.string().min(1).max(200).optional(),
        dueDate: z.date().optional(),
        description: z.string().max(1000).optional(),
        progress: z.number().int().min(0).max(100).optional(),
        sortOrder: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { milestoneId, ...rest } = input;
      const existing = await db.milestone.findUnique({ where: { id: milestoneId } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await loadProjectForTenant(existing.projectId, ctx);

      return db.$transaction(async (tx) => {
        const updated = await tx.milestone.update({
          where: { id: milestoneId },
          data: {
            ...(rest.name !== undefined ? { name: sanitizePlainText(rest.name) } : {}),
            ...(rest.dueDate !== undefined ? { dueDate: rest.dueDate } : {}),
            ...(rest.description !== undefined ? { description: sanitizePlainText(rest.description) } : {}),
            ...(rest.progress !== undefined ? { progress: rest.progress } : {}),
            ...(rest.sortOrder !== undefined ? { sortOrder: rest.sortOrder } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Milestone",
          entityId: updated.id,
          before: { name: existing.name, progress: existing.progress },
          after: { name: updated.name, progress: updated.progress },
        });
        return updated;
      });
    }),

  complete: writeProcedure
    .input(z.object({ milestoneId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.milestone.findUnique({ where: { id: input.milestoneId } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await loadProjectForTenant(existing.projectId, ctx);
      if (existing.completedAt !== null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Milestone already completed." });
      }

      return db.$transaction(async (tx) => {
        const completed = await tx.milestone.update({
          where: { id: input.milestoneId },
          data: { progress: 100, completedAt: new Date() },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Milestone",
          entityId: completed.id,
          before: { progress: existing.progress, completedAt: null },
          after: { progress: 100, completedAt: completed.completedAt },
        });
        return completed;
      });
    }),

  delete: writeProcedure
    .input(z.object({ milestoneId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.milestone.findUnique({ where: { id: input.milestoneId } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await loadProjectForTenant(existing.projectId, ctx);

      return db.$transaction(async (tx) => {
        await tx.milestone.delete({ where: { id: input.milestoneId } });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "DELETE",
          entity: "Milestone",
          entityId: input.milestoneId,
          before: { name: existing.name, projectId: existing.projectId },
          after: null,
        });
        return { success: true };
      });
    }),
});

export const projectRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
        customerId: z.string().cuid().optional(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenantId,
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.status !== undefined && input.status !== "" ? { status: input.status } : {}),
      };
      const [items, total] = await Promise.all([
        db.project.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        db.project.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await loadProjectForTenant(input.id, ctx);
      const item = await db.project.findUnique({
        where: { id: input.id },
        include: { expenses: true },
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      return item;
    }),

  create: writeProcedure
    .input(projectInput)
    .mutation(async ({ input, ctx }) => {
      if (input.customerId !== undefined) {
        const customer = await db.customer.findUnique({ where: { id: input.customerId } });
        if (!customer || customer.tenantId !== ctx.tenantId)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Customer not found." });
      }
      const projectNumber = `PRJ-${Date.now()}`;
      return db.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            tenantId: ctx.tenantId,
            name: sanitizePlainText(input.name),
            customerId: input.customerId ?? null,
            description: input.description !== undefined ? sanitizePlainText(input.description) : null,
            status: input.status,
            startDate: input.startDate ?? null,
            targetEndDate: input.targetEndDate ?? null,
            budget: input.budget ?? null,
            projectNumber,
            managerId: ctx.userId,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Project",
          entityId: created.id,
          before: null,
          after: { id: created.id, name: created.name, status: created.status, projectNumber: created.projectNumber },
        });
        return created;
      });
    }),

  update: writeProcedure
    .input(projectInput.partial().extend({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const existing = await loadProjectForTenant(id, ctx);

      if (rest.status !== undefined && rest.status !== existing.status) {
        const allowed = VALID_TRANSITIONS[existing.status] ?? [];
        if (!allowed.includes(rest.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot transition from ${existing.status} to ${rest.status}.`,
          });
        }
      }

      return db.$transaction(async (tx) => {
        const updated = await tx.project.update({
          where: { id },
          data: {
            ...(rest.name !== undefined ? { name: sanitizePlainText(rest.name) } : {}),
            ...(rest.customerId !== undefined ? { customerId: rest.customerId ?? null } : {}),
            ...(rest.description !== undefined
              ? { description: rest.description !== "" ? sanitizePlainText(rest.description) : null }
              : {}),
            ...(rest.status !== undefined ? { status: rest.status } : {}),
            ...(rest.startDate !== undefined ? { startDate: rest.startDate ?? null } : {}),
            ...(rest.targetEndDate !== undefined ? { targetEndDate: rest.targetEndDate ?? null } : {}),
            ...(rest.budget !== undefined ? { budget: rest.budget ?? null } : {}),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Project",
          entityId: updated.id,
          before: { name: existing.name, status: existing.status },
          after: { name: updated.name, status: updated.status },
        });
        return updated;
      });
    }),

  archive: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await loadProjectForTenant(input.id, ctx);

      const expenseCount = await db.projectExpense.count({ where: { projectId: input.id } });
      if (expenseCount > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot archive a project with recorded expenses.",
        });
      }

      return db.$transaction(async (tx) => {
        const archived = await tx.project.update({
          where: { id: input.id },
          data: { status: "cancelled" },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Project",
          entityId: archived.id,
          before: { status: existing.status },
          after: { status: "cancelled" },
        });
        return archived;
      });
    }),

  budgetSummary: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const project = await loadProjectForTenant(input.projectId, ctx);

      const agg = await db.projectExpense.aggregate({
        where: { projectId: input.projectId },
        _sum: { amount: true },
      });
      const sumValue = agg._sum.amount;
      const totalSpent =
        sumValue !== null && sumValue !== undefined ? parseFloat(sumValue.toString()) : 0;
      const totalBudget = project.budget !== null ? parseFloat(project.budget.toString()) : 0;
      const totalCommitted = 0;
      const remaining = totalBudget - totalSpent;

      return { totalBudget, totalSpent, totalCommitted, remaining };
    }),

  expense: expenseRouter,
  milestone: milestoneRouter,
});
