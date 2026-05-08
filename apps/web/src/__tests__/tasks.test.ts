/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tasksRouter } from "@/server/trpc/routers/tasks";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

vi.mock("@orqafy/db", () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    taskAssignment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    taskStatusReport: {
      create: vi.fn(),
    },
    toDo: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    toDoAttachment: {
      create: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
    },
    plan: {
      findFirst: vi.fn(),
    },
  },
}));

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {} as NextRequest;
}
function authenticatedCtx() {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}
function unauthenticatedCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [] as string[],
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}

const testRouter = createTRPCRouter({ tasks: tasksRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  task: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  taskAssignment: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  taskStatusReport: {
    create: ReturnType<typeof vi.fn>;
  };
  toDo: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  toDoAttachment: {
    create: ReturnType<typeof vi.fn>;
  };
  tenant: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  plan: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

// ─── taskList ─────────────────────────────────────────────────────────────────
describe("tasks.taskList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns tasks for a project for authenticated user", async () => {
    const tasks = [
      { id: "task-1", title: "Build feature", status: "todo", priority: "medium" },
      { id: "task-2", title: "Write tests", status: "in_progress", priority: "high" },
    ];
    mockDb.task.findMany.mockResolvedValueOnce(tasks);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskList({ projectId: "proj-1" });

    expect(mockDb.task.findMany).toHaveBeenCalledOnce();
    expect(result).toEqual(tasks);
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.tasks.taskList({ projectId: "proj-1" })).rejects.toThrow(TRPCError);
  });

  it("filters by status when provided", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([]);
    const caller = createCaller(authenticatedCtx());
    await caller.tasks.taskList({ projectId: "proj-1", status: "in_progress" });

    const call = mockDb.task.findMany.mock.calls[0]![0] as { where: { status?: string } };
    expect(call.where.status).toBe("in_progress");
  });

  it("filters by priority when provided", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([]);
    const caller = createCaller(authenticatedCtx());
    await caller.tasks.taskList({ projectId: "proj-1", priority: "high" });

    const call = mockDb.task.findMany.mock.calls[0]![0] as { where: { priority?: string } };
    expect(call.where.priority).toBe("high");
  });

  it("filters by parentTaskId when provided (subtasks lookup)", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([]);
    const caller = createCaller(authenticatedCtx());
    await caller.tasks.taskList({ projectId: "proj-1", parentTaskId: "task-parent" });

    const call = mockDb.task.findMany.mock.calls[0]![0] as { where: { parentTaskId?: string } };
    expect(call.where.parentTaskId).toBe("task-parent");
  });

  it("filters by assigneeId via TaskAssignment join", async () => {
    mockDb.task.findMany.mockResolvedValueOnce([]);
    const caller = createCaller(authenticatedCtx());
    await caller.tasks.taskList({ projectId: "proj-1", assigneeId: "user-7" });

    const call = mockDb.task.findMany.mock.calls[0]![0] as {
      where: { assignments?: { some?: { userId?: string } } };
    };
    expect(call.where.assignments?.some?.userId).toBe("user-7");
  });
});

// ─── taskGetById ──────────────────────────────────────────────────────────────
describe("tasks.taskGetById", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns a task with assignments, attachments, and subtasks included", async () => {
    const task = {
      id: "task-1",
      title: "Build feature",
      status: "todo",
      tenantId: "acme-tenant-id",
      assignments: [{ userId: "user-1", id: "assign-1" }],
      attachments: [{ id: "att-1", fileName: "spec.pdf" }],
      subtasks: [{ id: "task-2", title: "Subtask 1" }],
    };
    mockDb.task.findFirst.mockResolvedValueOnce(task);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskGetById({ id: "task-1" });

    const call = mockDb.task.findFirst.mock.calls[0]![0] as {
      include?: { assignments?: boolean; attachments?: boolean; subtasks?: boolean };
    };
    expect(call.include?.assignments).toBe(true);
    expect(call.include?.attachments).toBe(true);
    expect(call.include?.subtasks).toBe(true);
    expect(result).toEqual(task);
  });

  it("throws NOT_FOUND when task does not exist", async () => {
    mockDb.task.findFirst.mockResolvedValueOnce(null);

    const caller = createCaller(authenticatedCtx());
    await expect(caller.tasks.taskGetById({ id: "missing" })).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });
});

// ─── taskCreate ───────────────────────────────────────────────────────────────
describe("tasks.taskCreate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a task and returns it", async () => {
    const created = {
      id: "task-new",
      title: "New task",
      status: "todo",
      priority: "medium",
      tenantId: "acme-tenant-id",
    };
    mockDb.task.create.mockResolvedValueOnce(created);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskCreate({ projectId: "proj-1", title: "New task" });

    expect(mockDb.task.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
  });

  it("forwards optional priority, description, and parentTaskId to Prisma", async () => {
    mockDb.task.create.mockResolvedValueOnce({ id: "task-new" });

    const caller = createCaller(authenticatedCtx());
    await caller.tasks.taskCreate({
      projectId: "proj-1",
      title: "Subtask",
      description: "An optional description",
      priority: "high",
      parentTaskId: "task-parent",
    });

    const call = mockDb.task.create.mock.calls[0]![0] as {
      data: {
        description?: string;
        priority?: string;
        parentTaskId?: string;
      };
    };
    expect(call.data.description).toBe("An optional description");
    expect(call.data.priority).toBe("high");
    expect(call.data.parentTaskId).toBe("task-parent");
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(
      caller.tasks.taskCreate({ projectId: "proj-1", title: "New task" }),
    ).rejects.toThrow(TRPCError);
  });
});

// ─── taskUpdate ───────────────────────────────────────────────────────────────
describe("tasks.taskUpdate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates a task title", async () => {
    const existing = { id: "task-1", title: "Old title", status: "todo", tenantId: "acme-tenant-id" };
    const updated = { ...existing, title: "New title" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.task.update.mockResolvedValueOnce(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskUpdate({ id: "task-1", title: "New title" });

    expect(mockDb.task.update).toHaveBeenCalledOnce();
    expect(result).toEqual(updated);
  });

  it("updates description and priority partially", async () => {
    const existing = { id: "task-1", title: "Existing", description: null, priority: "medium" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.task.update.mockResolvedValueOnce({ ...existing, description: "New desc", priority: "high" });

    const caller = createCaller(authenticatedCtx());
    await caller.tasks.taskUpdate({
      id: "task-1",
      description: "New desc",
      priority: "high",
    });

    const call = mockDb.task.update.mock.calls[0]![0] as {
      data: { description?: string; priority?: string; title?: string };
    };
    expect(call.data.description).toBe("New desc");
    expect(call.data.priority).toBe("high");
    expect(call.data.title).toBeUndefined();
  });

  it("throws NOT_FOUND when task does not exist", async () => {
    mockDb.task.findFirst.mockResolvedValueOnce(null);

    const caller = createCaller(authenticatedCtx());
    await expect(caller.tasks.taskUpdate({ id: "missing", title: "X" })).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });
});

// ─── taskUpdateStatus ─────────────────────────────────────────────────────────
describe("tasks.taskUpdateStatus", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("transitions todo → in_progress", async () => {
    const existing = { id: "task-1", status: "todo", tenantId: "acme-tenant-id", milestoneId: null };
    const updated = { ...existing, status: "in_progress" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.task.update.mockResolvedValueOnce(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskUpdateStatus({ id: "task-1", status: "in_progress" });

    expect(result.status).toBe("in_progress");
  });

  it("transitions in_progress → review", async () => {
    const existing = { id: "task-1", status: "in_progress", tenantId: "acme-tenant-id", milestoneId: null };
    const updated = { ...existing, status: "review" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.task.update.mockResolvedValueOnce(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskUpdateStatus({ id: "task-1", status: "review" });

    expect(result.status).toBe("review");
  });

  it("rejects invalid status transition (done → in_progress)", async () => {
    const existing = { id: "task-1", status: "done", tenantId: "acme-tenant-id", milestoneId: null };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.tasks.taskUpdateStatus({ id: "task-1", status: "in_progress" }),
    ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });

  it("rejects unknown status value (cancelled is not a valid status)", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.tasks.taskUpdateStatus({ id: "task-1", status: "cancelled" as any }),
    ).rejects.toThrow(TRPCError);
  });

  it("rejects skipping todo → done (must go through in_progress / review)", async () => {
    const existing = { id: "task-1", status: "todo", tenantId: "acme-tenant-id" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.tasks.taskUpdateStatus({ id: "task-1", status: "done" }),
    ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });

  it("allows blocked → in_progress (recovery transition)", async () => {
    const existing = { id: "task-1", status: "blocked", tenantId: "acme-tenant-id" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.task.update.mockResolvedValueOnce({ ...existing, status: "in_progress" });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskUpdateStatus({ id: "task-1", status: "in_progress" });
    expect(result.status).toBe("in_progress");
  });
});

// ─── taskAssign ───────────────────────────────────────────────────────────────
describe("tasks.taskAssign", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("assigns a user to a task", async () => {
    const existing = { id: "task-1", status: "todo", tenantId: "acme-tenant-id" };
    const assignment = { id: "assign-1", taskId: "task-1", userId: "user-2" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.taskAssignment.findFirst.mockResolvedValueOnce(null);
    mockDb.taskAssignment.create.mockResolvedValueOnce(assignment);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskAssign({ taskId: "task-1", userId: "user-2" });

    expect(mockDb.taskAssignment.create).toHaveBeenCalledOnce();
    expect(result).toEqual(assignment);
  });

  it("throws CONFLICT when user is already assigned", async () => {
    const existing = { id: "task-1", status: "todo", tenantId: "acme-tenant-id" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.taskAssignment.findFirst.mockResolvedValueOnce({ id: "assign-existing" });

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.tasks.taskAssign({ taskId: "task-1", userId: "user-2" }),
    ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
});

// ─── taskUnassign ─────────────────────────────────────────────────────────────
describe("tasks.taskUnassign", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("removes a user assignment from a task", async () => {
    const existing = { id: "task-1", status: "todo", tenantId: "acme-tenant-id" };
    const assignment = { id: "assign-1", taskId: "task-1", userId: "user-2" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.taskAssignment.findFirst.mockResolvedValueOnce(assignment);
    mockDb.taskAssignment.delete.mockResolvedValueOnce(assignment);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskUnassign({ taskId: "task-1", userId: "user-2" });

    expect(mockDb.taskAssignment.delete).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true });
  });

  it("throws NOT_FOUND when assignment does not exist", async () => {
    const existing = { id: "task-1", status: "todo", tenantId: "acme-tenant-id" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.taskAssignment.findFirst.mockResolvedValueOnce(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.tasks.taskUnassign({ taskId: "task-1", userId: "user-99" }),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });
});

// ─── taskAddStatusReport ──────────────────────────────────────────────────────
describe("tasks.taskAddStatusReport", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a status report for a task", async () => {
    const existing = { id: "task-1", status: "in_progress", tenantId: "acme-tenant-id" };
    const report = {
      id: "report-1",
      taskId: "task-1",
      userId: "user-1",
      status: "in_progress",
      note: "Progress made",
    };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.taskStatusReport.create.mockResolvedValueOnce(report);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.taskAddStatusReport({
      taskId: "task-1",
      status: "in_progress",
      note: "Progress made",
    });

    expect(mockDb.taskStatusReport.create).toHaveBeenCalledOnce();
    expect(result).toEqual(report);
  });

  it("throws NOT_FOUND when task does not exist", async () => {
    mockDb.task.findFirst.mockResolvedValueOnce(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.tasks.taskAddStatusReport({ taskId: "missing", status: "in_progress" }),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });
});

// ─── todoList ─────────────────────────────────────────────────────────────────
describe("tasks.todoList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns todos for the current user", async () => {
    const todos = [
      { id: "todo-1", title: "Personal task", isCompleted: false, userId: "user-1" },
    ];
    mockDb.toDo.findMany.mockResolvedValueOnce(todos);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.todoList();

    expect(mockDb.toDo.findMany).toHaveBeenCalledOnce();
    expect(result).toEqual(todos);
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.tasks.todoList()).rejects.toThrow(TRPCError);
  });
});

// ─── todoCreate ───────────────────────────────────────────────────────────────
describe("tasks.todoCreate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a todo for the current user", async () => {
    const created = {
      id: "todo-new",
      title: "Do laundry",
      isCompleted: false,
      userId: "user-1",
      priority: "medium",
    };
    mockDb.toDo.create.mockResolvedValueOnce(created);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.todoCreate({ title: "Do laundry" });

    expect(mockDb.toDo.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
  });
});

// ─── todoComplete ─────────────────────────────────────────────────────────────
describe("tasks.todoComplete", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("marks a todo as completed", async () => {
    const existing = { id: "todo-1", isCompleted: false, userId: "user-1" };
    const updated = { ...existing, isCompleted: true, completedAt: new Date() };
    mockDb.toDo.findFirst.mockResolvedValueOnce(existing);
    mockDb.toDo.update.mockResolvedValueOnce(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.todoComplete({ id: "todo-1" });

    expect(mockDb.toDo.update).toHaveBeenCalledOnce();
    expect(result.isCompleted).toBe(true);
  });

  it("throws NOT_FOUND if todo does not belong to current user", async () => {
    mockDb.toDo.findFirst.mockResolvedValueOnce(null);

    const caller = createCaller(authenticatedCtx());
    await expect(caller.tasks.todoComplete({ id: "todo-other" })).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });
});

// ─── todoUpdate ───────────────────────────────────────────────────────────────
describe("tasks.todoUpdate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates a todo's title and priority for the owning user", async () => {
    const existing = { id: "todo-1", title: "Old", priority: "medium", userId: "user-1" };
    const updated = { ...existing, title: "New", priority: "high" };
    mockDb.toDo.findFirst.mockResolvedValueOnce(existing);
    mockDb.toDo.update.mockResolvedValueOnce(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.todoUpdate({
      id: "todo-1",
      title: "New",
      priority: "high",
    });

    expect(mockDb.toDo.update).toHaveBeenCalledOnce();
    expect(result.title).toBe("New");
    expect(result.priority).toBe("high");
  });

  it("throws NOT_FOUND when todo does not belong to current user", async () => {
    mockDb.toDo.findFirst.mockResolvedValueOnce(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.tasks.todoUpdate({ id: "todo-other", title: "Hack" }),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });
});

// ─── todoDelete ───────────────────────────────────────────────────────────────
describe("tasks.todoDelete", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("deletes a todo for the owning user", async () => {
    const existing = { id: "todo-1", userId: "user-1" };
    mockDb.toDo.findFirst.mockResolvedValueOnce(existing);
    mockDb.toDo.delete.mockResolvedValueOnce(existing);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.todoDelete({ id: "todo-1" });

    expect(mockDb.toDo.delete).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true });
  });

  it("throws NOT_FOUND when todo does not belong to current user", async () => {
    mockDb.toDo.findFirst.mockResolvedValueOnce(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.tasks.todoDelete({ id: "todo-other" }),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });
});

// ─── taskAddStatusReport (writes to TaskStatusReport.userId) ─────────────────
describe("tasks.taskAddStatusReport — Prisma field mapping", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("writes ctx.userId into the userId field (NOT reportedById — schema field is userId)", async () => {
    const existing = { id: "task-1", status: "in_progress" };
    mockDb.task.findFirst.mockResolvedValueOnce(existing);
    mockDb.taskStatusReport.create.mockResolvedValueOnce({ id: "report-1" });

    const caller = createCaller(authenticatedCtx());
    await caller.tasks.taskAddStatusReport({
      taskId: "task-1",
      status: "in_progress",
      note: "ok",
    });

    const call = mockDb.taskStatusReport.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data["userId"]).toBe("user-1");
    expect(call.data["reportedById"]).toBeUndefined();
  });
});

// ─── todoAddAttachment (free-plan gate) ───────────────────────────────────────
describe("tasks.todoAddAttachment", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("adds attachment on paid plan", async () => {
    const existing = { id: "todo-1", isCompleted: false, userId: "user-1" };
    const tenant = { id: "acme-tenant-id", planId: "plan-pro" };
    const plan = { id: "plan-pro", slug: "pro" };
    const attachment = { id: "att-1", toDoId: "todo-1", fileName: "file.pdf" };

    mockDb.toDo.findFirst.mockResolvedValueOnce(existing);
    mockDb.tenant.findFirst.mockResolvedValueOnce(tenant);
    mockDb.plan.findFirst.mockResolvedValueOnce(plan);
    mockDb.toDoAttachment.create.mockResolvedValueOnce(attachment);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.tasks.todoAddAttachment({
      toDoId: "todo-1",
      fileName: "file.pdf",
      fileUrl: "https://storage/file.pdf",
      fileSizeBytes: 1024,
      mimeType: "application/pdf",
    });

    expect(mockDb.toDoAttachment.create).toHaveBeenCalledOnce();
    expect(result).toEqual(attachment);
  });

  it("throws FORBIDDEN on free plan", async () => {
    const existing = { id: "todo-1", isCompleted: false, userId: "user-1" };
    const tenant = { id: "acme-tenant-id", planId: "plan-free" };
    const plan = { id: "plan-free", slug: "free" };

    mockDb.toDo.findFirst.mockResolvedValueOnce(existing);
    mockDb.tenant.findFirst.mockResolvedValueOnce(tenant);
    mockDb.plan.findFirst.mockResolvedValueOnce(plan);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.tasks.todoAddAttachment({
        toDoId: "todo-1",
        fileName: "file.pdf",
        fileUrl: "https://storage/file.pdf",
        fileSizeBytes: 1024,
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
});
