import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma as db } from "@orqafy/db";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { matrixMiddleware } from "../middleware/matrix";
import { logger } from "@/lib/logger";

// Task 5.1 — migrated from the inline `ADMIN_ROLES` name-allowlist to the
// data-driven `role_permissions` matrix (feature key "settings"). Any
// authenticated user can still read (list stays on `protectedProcedure`,
// unchanged — used by expense forms). `writeProcedure` still enforces the
// demo-tenant mutation guard; `matrixMiddleware` resolves the (feature,
// action) grant on top of it.
const settingsCreateProcedure = writeProcedure.use(matrixMiddleware("settings", "create"));
const settingsUpdateProcedure = writeProcedure.use(matrixMiddleware("settings", "update"));
const settingsDeleteProcedure = writeProcedure.use(matrixMiddleware("settings", "delete"));

const createInput = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
}).strict();

const updateInput = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

export const expenseCategoryRouter = createTRPCRouter({
  /**
   * List all expense categories for the current tenant.
   * Accessible to any authenticated user — used by expense creation forms.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.expenseCategory.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isDefault: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { expenses: true } },
      },
    });
  }),

  /**
   * Create a new expense category. Code must be unique within the tenant.
   */
  create: settingsCreateProcedure.input(createInput).mutation(async ({ input, ctx }) => {
    const existing = await db.expenseCategory.findFirst({
      where: { tenantId: ctx.tenantId, code: input.code },
    });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Expense category code "${input.code}" is already in use.`,
      });
    }

    const cat = await db.expenseCategory.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        code: input.code,
        description: input.description ?? null,
        isDefault: input.isDefault,
        sortOrder: input.sortOrder,
      },
    });

    logger.info(
      {
        tenantId: ctx.tenantId,
        expenseCategoryId: cat.id,
        surface: "settings.expense-categories",
        action: "create",
      },
      "expense category created",
    );
    return cat;
  }),

  /**
   * Update an existing expense category.
   */
  update: settingsUpdateProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
    const existing = await db.expenseCategory.findUnique({ where: { id: input.id } });
    if (!existing || existing.tenantId !== ctx.tenantId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Expense category not found." });
    }

    // Guard: code uniqueness if changing
    if (input.code != null && input.code !== "" && input.code !== existing.code) {
      const conflict = await db.expenseCategory.findFirst({
        where: { tenantId: ctx.tenantId, code: input.code, NOT: { id: input.id } },
      });
      if (conflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Expense category code "${input.code}" is already in use.`,
        });
      }
    }

    const cat = await db.expenseCategory.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.code !== undefined && { code: input.code }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
    });

    logger.info(
      {
        tenantId: ctx.tenantId,
        expenseCategoryId: cat.id,
        surface: "settings.expense-categories",
        action: "update",
      },
      "expense category updated",
    );
    return cat;
  }),

  /**
   * Delete an expense category. Blocked when expenses still reference it.
   */
  delete: settingsDeleteProcedure
    .input(z.object({ id: z.string().cuid() }).strict())
    .mutation(async ({ input, ctx }) => {
      const existing = await db.expenseCategory.findUnique({
        where: { id: input.id },
        include: { _count: { select: { expenses: true } } },
      });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense category not found." });
      }
      if (existing._count.expenses > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete expense category — ${String(existing._count.expenses)} expense(s) still use it.`,
        });
      }

      const deleted = await db.expenseCategory.delete({ where: { id: input.id } });
      logger.warn(
        {
          tenantId: ctx.tenantId,
          expenseCategoryId: input.id,
          surface: "settings.expense-categories",
          action: "delete",
        },
        "expense category deleted",
      );
      return deleted;
    }),
});
