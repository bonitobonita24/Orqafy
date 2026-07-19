// Mobile-sync handler for `expenses` (`create` only — v1 mobile scope is
// filing a new expense; approve/reject stay web-only admin actions).
//
// Owner decision: mobile uses a CATEGORY PICKER, so the client always sends
// a real `expenseCategoryId` (resolved via GET /api/sync/expense-categories
// — see that route for the tenant-scoped active-category list). `receiptUrl`
// is deliberately NOT accepted here — receipt upload is a separate,
// later leg (a worker/queue path), matching the architect's scope note.
//
// Reuses the SAME validation + creation rules as the `expenses` tRPC router
// (server/trpc/routers/expense.ts `create`) — re-implemented here (not
// extracted) for the same reason as dtr_entries: the router's procedure is
// tightly coupled to writeProcedure/ctx and extracting it would risk
// touching its call signature. Note the router's `create` does NOT write
// an audit log entry — this handler mirrors that (no drift).
//
// RBAC feature: "expenses" (ENTITY_FEATURE_MAP, handlers.ts), action
// "create" — packages/db/src/seed/role-permissions.ts grants
// `expenses: { internalStaff: { create: true, ... } }` broadly (no
// role-specific narrowing), so this one is NOT gated like tasks:update.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@orqafy/db";
import type { SyncHandler } from "@/server/sync/handlers";
import { recordSyncOp } from "@/server/sync/idempotency";

const ENTITY_TYPE = "expenses";

const createExpenseSchema = z
  .object({
    expenseCategoryId: z.string().cuid(),
    projectId: z.string().cuid().optional(),
    description: z.string().min(1).max(1000),
    amount: z.number().positive(),
    currency: z.string().length(3).default("PHP"),
    date: z.coerce.date(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const expensesHandler: SyncHandler = async ({ ctx, action, clientId, data }) => {
  if (action !== "create") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only expense creation is supported via mobile sync.",
    });
  }

  const parsed = createExpenseSchema.parse(data);

  const category = await prisma.expenseCategory.findUnique({ where: { id: parsed.expenseCategoryId } });
  if (!category || category.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Category not found." });
  }

  if (parsed.projectId !== undefined) {
    const project = await prisma.project.findUnique({ where: { id: parsed.projectId } });
    if (!project || project.tenantId !== ctx.tenantId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Project not found." });
    }
  }

  const expenseNumber = `EXP-${Date.now()}`;

  return prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        tenantId: ctx.tenantId,
        expenseCategoryId: parsed.expenseCategoryId,
        projectId: parsed.projectId ?? null,
        description: parsed.description,
        amount: parsed.amount,
        currency: parsed.currency,
        date: parsed.date,
        receiptUrl: null,
        notes: parsed.notes ?? null,
        expenseNumber,
        createdById: ctx.userId,
        status: "pending",
      },
    });
    await recordSyncOp(
      tx,
      { tenantId: ctx.tenantId, userId: ctx.userId, entityType: ENTITY_TYPE, clientId, action },
      created.id,
    );
    return { serverId: created.id };
  });
};
