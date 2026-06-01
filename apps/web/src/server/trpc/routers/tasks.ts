import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

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
      parentTaskId: z.string().min(1).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await loadProjectForTenant(input.projectId, ctx);
      return db.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          tenantId: ctx.tenantId,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.parentTaskId !== undefined && { parentTaskId: input.parentTaskId }),
        },
      });
    }),

  taskUpdate: writeProcedure
    .input(z.object({
      id: z.string().min(1),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      priority: TASK_PRIORITY.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await loadTaskForTenant(input.id, ctx);
      return db.task.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.priority !== undefined && { priority: input.priority }),
        },
      });
    }),

  taskUpdateStatus: writeProcedure
    .input(z.object({
      id: z.string().min(1),
      status: TASK_STATUS,
    }))
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
      return db.task.update({ where: { id: input.id }, data: { status: input.status } });
    }),

  taskAssign: writeProcedure
    .input(z.object({ taskId: z.string().min(1), userId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const task = await loadTaskForTenant(input.taskId, ctx);
      const existing = await db.taskAssignment.findFirst({
        where: { taskId: input.taskId, userId: input.userId },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "User already assigned to this task." });
      return db.taskAssignment.create({
        data: {
          taskId: input.taskId,
          userId: input.userId,
          tenantId: task.tenantId,
        },
      });
    }),

  taskUnassign: writeProcedure
    .input(z.object({ taskId: z.string().min(1), userId: z.string().min(1) }))
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
    }))
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
    }))
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
    }))
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
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      await loadToDoForUser(input.id, ctx);
      await db.toDo.delete({ where: { id: input.id } });
      return { success: true };
    }),

  todoComplete: writeProcedure
    .input(z.object({ id: z.string().min(1) }))
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
    }))
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
