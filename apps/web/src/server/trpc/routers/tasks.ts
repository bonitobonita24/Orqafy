import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";
import { createNotification } from "@/server/notifications/create";

const TASK_STATUS = z.enum(["todo", "in_progress", "review", "done", "blocked"]);
const TASK_PRIORITY = z.enum(["low", "medium", "high", "critical"]);
const TODO_PRIORITY = z.enum(["low", "medium", "high"]);

// Allowed status transitions for tasks. Keys are current status,
// values are statuses that can be transitioned to from that current status.
const TASK_STATUS_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  todo: ["in_progress", "blocked"],
  in_progress: ["review", "blocked", "todo"],
  review: ["done", "in_progress", "blocked"],
  blocked: ["todo", "in_progress"],
  done: [],
};

async function loadProjectForTenant(id: string, ctx: { tenantId: string }) {
  const p = await db.project.findUnique({ where: { id } });
  if (!p || p.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return p;
}

async function loadTaskForTenant(id: string, ctx: { tenantId: string }) {
  const t = await db.task.findUnique({ where: { id } });
  if (!t || t.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
  }
  return t;
}

async function loadToDoForUser(id: string, ctx: { tenantId: string; userId: string }) {
  const td = await db.toDo.findUnique({ where: { id } });
  if (!td || td.tenantId !== ctx.tenantId || td.userId !== ctx.userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "To-do not found" });
  }
  return td;
}

export const tasksRouter = createTRPCRouter({
  // Cross-project query — returns all tasks for the tenant, optionally filtered by project.
  taskListAll: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1).optional(),
      status: TASK_STATUS.optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where: Record<string, unknown> = { tenantId: ctx.tenantId };
      if (input.projectId !== undefined) where["projectId"] = input.projectId;
      if (input.status !== undefined) where["status"] = input.status;
      return db.task.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
          project: { select: { id: true, name: true } },
          assignments: {
            select: {
              user: { select: { id: true, firstName: true, lastName: true, displayName: true } },
            },
          },
        },
      });
    }),

  taskList: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1),
      status: TASK_STATUS.optional(),
      priority: TASK_PRIORITY.optional(),
      parentTaskId: z.string().min(1).optional(),
      assigneeId: z.string().min(1).optional(),
    }))
    .query(async ({ input, ctx }) => {
      await loadProjectForTenant(input.projectId, ctx);
      const where: Record<string, unknown> = { projectId: input.projectId };
      if (input.status !== undefined) where["status"] = input.status;
      if (input.priority !== undefined) where["priority"] = input.priority;
      if (input.parentTaskId !== undefined) where["parentTaskId"] = input.parentTaskId;
      if (input.assigneeId !== undefined) {
        where["assignments"] = { some: { userId: input.assigneeId } };
      }
      return db.task.findMany({ where });
    }),

  taskGetById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      await loadTaskForTenant(input.id, ctx);
      const task = await db.task.findFirst({
        where: { id: input.id },
        include: {
          assignments: true,
          attachments: true,
          subtasks: true,
        },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  taskCreate: writeProcedure
    .input(z.object({
      projectId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1).optional(),
      priority: TASK_PRIORITY.optional(),
      dueDate: z.coerce.date().optional(),
      parentTaskId: z.string().min(1).optional(),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      await loadProjectForTenant(input.projectId, ctx);
      // Tenant-isolation: a parent task (if any) must belong to the caller's
      // tenant — otherwise a cross-tenant task could be nested under it.
      if (input.parentTaskId !== undefined) {
        await loadTaskForTenant(input.parentTaskId, ctx);
      }
      return db.$transaction(async (tx) => {
        const created = await tx.task.create({
          data: {
            projectId: input.projectId,
            title: input.title,
            tenantId: ctx.tenantId,
            ...(input.description !== undefined && { description: input.description }),
            ...(input.priority !== undefined && { priority: input.priority }),
            ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
            ...(input.parentTaskId !== undefined && { parentTaskId: input.parentTaskId }),
          },
          // Return the same relation shape the board's TaskRow expects, so the
          // client optimistic insert can render project.name / assignments
          // without a `Cannot read properties of undefined (reading 'name')`
          // crash (must mirror the taskList include above).
          include: {
            project: { select: { id: true, name: true } },
            assignments: {
              select: {
                user: { select: { id: true, firstName: true, lastName: true, displayName: true } },
              },
            },
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "Task",
          entityId: created.id,
          before: null,
          after: { id: created.id, projectId: created.projectId, title: created.title, status: created.status, priority: created.priority },
        });
        return created;
      });
    }),

  taskUpdate: writeProcedure
    .input(z.object({
      id: z.string().min(1),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      priority: TASK_PRIORITY.optional(),
      dueDate: z.coerce.date().nullable().optional(),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      const before = await loadTaskForTenant(input.id, ctx);
      return db.$transaction(async (tx) => {
        const updated = await tx.task.update({
          where: { id: input.id },
          data: {
            ...(input.title !== undefined && { title: input.title }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.priority !== undefined && { priority: input.priority }),
            ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Task",
          entityId: updated.id,
          before: { title: (before as { title: string }).title, priority: (before as { priority: string }).priority, dueDate: (before as { dueDate: Date | null }).dueDate },
          after: { title: updated.title, priority: updated.priority, dueDate: updated.dueDate },
        });
        return updated;
      });
    }),

  taskUpdateStatus: writeProcedure
    .input(z.object({
      id: z.string().min(1),
      status: TASK_STATUS,
    }).strict())
    .mutation(async ({ input, ctx }) => {
      const task = await loadTaskForTenant(input.id, ctx);
      const current = (task as { status: string }).status;
      const allowed = TASK_STATUS_TRANSITIONS[current] ?? [];
      if (!allowed.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid status transition: ${current} → ${input.status}.`,
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.task.update({ where: { id: input.id }, data: { status: input.status } });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Task",
          entityId: updated.id,
          before: { status: current },
          after: { status: input.status },
        });
        return updated;
      });
    }),

  taskDelete: writeProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ input, ctx }) => {
      const task = await loadTaskForTenant(input.id, ctx);
      return db.$transaction(async (tx) => {
        await tx.task.delete({ where: { id: input.id } });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "DELETE",
          entity: "Task",
          entityId: input.id,
          before: { title: (task as { title: string }).title, status: (task as { status: string }).status },
          after: null,
        });
        return { success: true };
      });
    }),

  taskSetDueDate: writeProcedure
    .input(z.object({
      id: z.string().min(1),
      dueDate: z.coerce.date().nullable(),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      const before = await loadTaskForTenant(input.id, ctx);
      return db.$transaction(async (tx) => {
        const updated = await tx.task.update({ where: { id: input.id }, data: { dueDate: input.dueDate } });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "Task",
          entityId: updated.id,
          before: { dueDate: (before as { dueDate: Date | null }).dueDate },
          after: { dueDate: input.dueDate },
        });
        return updated;
      });
    }),

  taskAssign: writeProcedure
    .input(z.object({ taskId: z.string().min(1), userId: z.string().min(1) }).strict())
    .mutation(async ({ input, ctx }) => {
      const task = await loadTaskForTenant(input.taskId, ctx);
      // Tenant-isolation: the assignee must belong to the caller's tenant —
      // both for the assignment itself and so the notification below can
      // never be published to a cross-tenant user.
      const assignee = await db.user.findUnique({ where: { id: input.userId } });
      if (!assignee || assignee.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User not found." });
      }
      const existing = await db.taskAssignment.findFirst({
        where: { taskId: input.taskId, userId: input.userId },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "User already assigned to this task." });
      const assignment = await db.taskAssignment.create({
        data: {
          taskId: input.taskId,
          userId: input.userId,
          tenantId: task.tenantId,
        },
      });

      // D7 — notify the assignee (skip self-assignment, no point pinging yourself).
      if (input.userId !== ctx.userId) {
        await createNotification({
          tenantId: task.tenantId,
          recipientUserId: input.userId,
          category: "task_assigned",
          title: "New task assigned",
          body: `You were assigned to "${task.title}".`,
          payload: { taskId: task.id, projectId: task.projectId },
        });
      }

      return assignment;
    }),

  taskUnassign: writeProcedure
    .input(z.object({ taskId: z.string().min(1), userId: z.string().min(1) }).strict())
    .mutation(async ({ input, ctx }) => {
      await loadTaskForTenant(input.taskId, ctx);
      const assignment = await db.taskAssignment.findFirst({
        where: { taskId: input.taskId, userId: input.userId },
      });
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found." });
      await db.taskAssignment.delete({ where: { id: (assignment as { id: string }).id } });
      return { success: true };
    }),

  taskAddStatusReport: writeProcedure
    .input(z.object({
      taskId: z.string().min(1),
      status: z.string().min(1),
      note: z.string().optional(),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      const task = await loadTaskForTenant(input.taskId, ctx);
      return db.taskStatusReport.create({
        data: {
          taskId: input.taskId,
          status: input.status,
          userId: ctx.userId,
          tenantId: task.tenantId,
          ...(input.note !== undefined && { note: input.note }),
        },
      });
    }),

  todoList: protectedProcedure
    .query(async ({ ctx }) => {
      return db.toDo.findMany({ where: { userId: ctx.userId, tenantId: ctx.tenantId } });
    }),

  todoCreate: writeProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().min(1).optional(),
      priority: TODO_PRIORITY.optional(),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      return db.toDo.create({
        data: {
          title: input.title,
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.priority !== undefined && { priority: input.priority }),
        },
      });
    }),

  todoUpdate: writeProcedure
    .input(z.object({
      id: z.string().min(1),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      priority: TODO_PRIORITY.optional(),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      await loadToDoForUser(input.id, ctx);
      return db.toDo.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.priority !== undefined && { priority: input.priority }),
        },
      });
    }),

  todoDelete: writeProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ input, ctx }) => {
      await loadToDoForUser(input.id, ctx);
      await db.toDo.delete({ where: { id: input.id } });
      return { success: true };
    }),

  todoComplete: writeProcedure
    .input(z.object({ id: z.string().min(1) }).strict())
    .mutation(async ({ input, ctx }) => {
      await loadToDoForUser(input.id, ctx);
      return db.toDo.update({ where: { id: input.id }, data: { isCompleted: true } });
    }),

  todoAddAttachment: writeProcedure
    .input(z.object({
      toDoId: z.string().min(1),
      fileName: z.string().min(1),
      fileUrl: z.string().min(1),
      fileSizeBytes: z.number().int().positive(),
      mimeType: z.string().min(1),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      const todo = await loadToDoForUser(input.toDoId, ctx);
      const tenant = await db.tenant.findFirst({ where: { id: ctx.tenantId } });
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found." });
      const plan = await db.plan.findFirst({ where: { id: (tenant as { planId: string }).planId } });
      if (plan && (plan as { slug: string }).slug === "free") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Attachments are not available on the free plan." });
      }
      return db.toDoAttachment.create({
        data: {
          toDoId: input.toDoId,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          fileSizeBytes: input.fileSizeBytes,
          mimeType: input.mimeType,
          tenantId: todo.tenantId,
        },
      });
    }),
});
