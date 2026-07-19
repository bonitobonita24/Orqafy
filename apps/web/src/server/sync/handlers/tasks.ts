// Mobile-sync handler for `tasks` (status-change updates only — tasks are
// pull-first: the mobile client only ever queues an `update` sync op for a
// task's status; `create`/`delete` of tasks happens on the web).
//
// `clientId`/`entityId` here IS the server-side Task id already (tasks are
// pull-first, so the mobile client's local record carries the real
// server_id — see docs/PRODUCT.md mobile-sync decision log). There is no
// create-op mapping lookup, unlike dtr_entries.
//
// RBAC feature: "tasks" (ENTITY_FEATURE_MAP, handlers.ts), action "update".
// See the worker's report re: verifying `tasks:update` is actually granted
// to mobile-usable roles in packages/db/src/seed/role-permissions.ts.
//
// Reuses the router's TASK_STATUS_TRANSITIONS state machine (exported from
// server/trpc/routers/tasks.ts) so the transition rules can never drift
// between the tRPC surface and this REST surface.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma, writeAuditLog } from "@orqafy/db";
import type { SyncHandler } from "@/server/sync/handlers";
import { recordSyncOp } from "@/server/sync/idempotency";
import { TASK_STATUS_TRANSITIONS } from "@/server/trpc/routers/tasks";

const ENTITY_TYPE = "tasks";

const TASK_STATUS = z.enum(["todo", "in_progress", "review", "done", "blocked"]);

const updateStatusSchema = z
  .object({
    status: TASK_STATUS,
  })
  .strict();

export const tasksHandler: SyncHandler = async ({ ctx, action, clientId, data }) => {
  if (action !== "update") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only status updates are supported for mobile task sync.",
    });
  }

  const parsed = updateStatusSchema.parse(data);

  const task = await prisma.task.findUnique({ where: { id: clientId } });
  if (!task || task.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
  }

  const current = task.status;
  const allowed = TASK_STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(parsed.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid status transition: ${current} → ${parsed.status}.`,
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id: task.id }, data: { status: parsed.status } });
    await writeAuditLog(tx, {
      userId: ctx.userId,
      action: "UPDATE",
      entity: "Task",
      entityId: updated.id,
      before: { status: current },
      after: { status: parsed.status },
    });
    await recordSyncOp(
      tx,
      { tenantId: ctx.tenantId, userId: ctx.userId, entityType: ENTITY_TYPE, clientId, action },
      updated.id,
    );
    return { serverId: updated.id };
  });
};
