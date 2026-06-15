/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Tasks tenant-parity tests
 *
 * Proves:
 *  1. taskListAll only returns tasks for the calling tenant (tenant-scope assertion)
 *  2. taskGetById throws NOT_FOUND when task belongs to tenant-B but ctx is tenant-A
 *  3. taskCreate injects tenantId from ctx (not from input) + writes audit log
 *  4. taskUpdateStatus throws BAD_REQUEST on illegal transition
 *  5. taskUpdateStatus enforces tenant scope (NOT_FOUND for cross-tenant)
 *  6. taskDelete enforces tenant scope (NOT_FOUND for cross-tenant)
 *  7. writeProcedure (demo guard) blocks mutations on demo tenant
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const {
  mockTaskFindUnique,
  mockTaskFindMany,
  mockTaskCreate,
  mockTaskUpdate,
  mockTaskDelete,
  mockProjectFindUnique,
  mockAuditLogCreate,
} = vi.hoisted(() => ({
  mockTaskFindUnique: vi.fn(),
  mockTaskFindMany: vi.fn(),
  mockTaskCreate: vi.fn(),
  mockTaskUpdate: vi.fn(),
  mockTaskDelete: vi.fn(),
  mockProjectFindUnique: vi.fn(),
  mockAuditLogCreate: vi.fn(),
}));

vi.mock("@orqafy/db", () => {
  // mockDb is the object passed INTO the $transaction callback (represents the tx client).
  // It must include every model the router touches inside a transaction.
  const mockDb = {
    task: {
      findUnique: mockTaskFindUnique,
      findMany: mockTaskFindMany,
      create: mockTaskCreate,
      update: mockTaskUpdate,
      delete: mockTaskDelete,
    },
    project: {
      findUnique: mockProjectFindUnique,
    },
    auditLog: { create: mockAuditLogCreate },
  };
  return {
    prisma: {
      ...mockDb,
      // $transaction passes mockDb as the "tx" argument so the router's tx.task.xxx calls
      // resolve to the same mocks as prisma.task.xxx calls.
      $transaction: vi.fn((fn: any) => fn(mockDb)),
    },
    writeAuditLog: async (tx: any, entry: any) => {
      await tx.auditLog.create({ data: entry });
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

vi.mock("@/server/notifications/create", () => ({
  createNotification: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { tasksRouter } from "@/server/trpc/routers/tasks";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ tasks: tasksRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(tenantId: string, isDemoTenant = false) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant,
    session: null,
  };
}

const TASK_A = {
  id: "task-a-000000000000000000",
  tenantId: "tenant-A",
  projectId: "proj-a-0000000000000000",
  title: "Fix login bug",
  status: "todo",
  priority: "medium",
  dueDate: null,
  completedAt: null,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PROJECT_A = {
  id: "proj-a-0000000000000000",
  tenantId: "tenant-A",
  name: "Alpha Project",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Tasks tenant parity (L3 RBAC + L5 AuditLog + tenant-scope isolation)", () => {
  beforeEach(async () => {
    // resetAllMocks clears both call history AND mockResolvedValueOnce queues,
    // preventing leftover queued values from leaking into subsequent tests.
    vi.resetAllMocks();
    // Re-wire $transaction after reset so it always passes mockDb to the callback.
    const { prisma } = await import("@orqafy/db");
    (prisma as any).$transaction.mockImplementation((fn: any) => {
      const mockDb = {
        task: {
          findUnique: mockTaskFindUnique,
          findMany: mockTaskFindMany,
          create: mockTaskCreate,
          update: mockTaskUpdate,
          delete: mockTaskDelete,
        },
        project: { findUnique: mockProjectFindUnique },
        auditLog: { create: mockAuditLogCreate },
      };
      return fn(mockDb);
    });
  });

  // ── 1. taskListAll scope ────────────────────────────────────────────────────
  it("taskListAll only queries tasks scoped to ctx.tenantId", async () => {
    mockTaskFindMany.mockResolvedValueOnce([TASK_A]);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.tasks.taskListAll({});

    expect(result).toHaveLength(1);
    expect(mockTaskFindMany).toHaveBeenCalledOnce();
    const callArg = mockTaskFindMany.mock.calls[0]![0];
    expect(callArg.where.tenantId).toBe("tenant-A");
  });

  // ── 2. taskGetById tenant isolation ────────────────────────────────────────
  it("taskGetById throws NOT_FOUND when task belongs to a different tenant", async () => {
    mockTaskFindUnique
      .mockResolvedValueOnce({ ...TASK_A, tenantId: "tenant-B" }); // loadTaskForTenant

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.tasks.taskGetById({ id: TASK_A.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Task not found" });
  });

  it("taskGetById returns task when tenantId matches ctx", async () => {
    const fullTask = { ...TASK_A, assignments: [], attachments: [], subtasks: [] };
    // loadTaskForTenant uses findUnique; the detail fetch uses findFirst
    mockTaskFindUnique.mockResolvedValueOnce(TASK_A); // loadTaskForTenant check
    mockTaskFindMany.mockResolvedValueOnce(fullTask);  // fallback (not used for findFirst)

    const { prisma } = await import("@orqafy/db");
    // The router calls db.task.findFirst for the detail query — wire it up
    (prisma.task as any).findFirst = vi.fn().mockResolvedValueOnce(fullTask);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.tasks.taskGetById({ id: TASK_A.id });
    expect(result).toMatchObject({ id: TASK_A.id, tenantId: "tenant-A" });
  });

  // ── 3. taskCreate injects tenantId + audit log ──────────────────────────────
  it("taskCreate injects tenantId from ctx into db.task.create", async () => {
    mockProjectFindUnique.mockResolvedValueOnce(PROJECT_A);
    mockTaskCreate.mockResolvedValueOnce(TASK_A);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.tasks.taskCreate({
      projectId: PROJECT_A.id,
      title: "Fix login bug",
    });

    expect(result).toMatchObject({ tenantId: "tenant-A" });
    expect(mockTaskCreate).toHaveBeenCalledOnce();
    const callArg = mockTaskCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });

  it("taskCreate writes an audit log row with action CREATE and entity Task", async () => {
    mockProjectFindUnique.mockResolvedValueOnce(PROJECT_A);
    mockTaskCreate.mockResolvedValueOnce(TASK_A);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.tasks.taskCreate({ projectId: PROJECT_A.id, title: "Audit task" });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", entity: "Task" }),
      }),
    );
  });

  it("taskCreate throws NOT_FOUND when project belongs to a different tenant", async () => {
    mockProjectFindUnique.mockResolvedValueOnce({ ...PROJECT_A, tenantId: "tenant-B" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.tasks.taskCreate({ projectId: PROJECT_A.id, title: "Bad task" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Project not found" });
  });

  // ── 4. taskUpdateStatus state-machine guard ─────────────────────────────────
  it("taskUpdateStatus throws BAD_REQUEST on illegal status transition", async () => {
    mockTaskFindUnique.mockResolvedValueOnce(TASK_A); // status: "todo"

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.tasks.taskUpdateStatus({ id: TASK_A.id, status: "done" }), // todo → done is illegal
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Invalid status transition"),
    });
  });

  it("taskUpdateStatus allows a valid transition and writes audit log", async () => {
    mockTaskFindUnique.mockResolvedValueOnce(TASK_A); // status: "todo"
    const updated = { ...TASK_A, status: "in_progress" };
    mockTaskUpdate.mockResolvedValueOnce(updated);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.tasks.taskUpdateStatus({ id: TASK_A.id, status: "in_progress" });

    expect(result.status).toBe("in_progress");
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "UPDATE", entity: "Task" }),
      }),
    );
  });

  // ── 5. taskUpdateStatus cross-tenant guard ──────────────────────────────────
  it("taskUpdateStatus throws NOT_FOUND when task belongs to a different tenant", async () => {
    mockTaskFindUnique.mockResolvedValueOnce({ ...TASK_A, tenantId: "tenant-B" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.tasks.taskUpdateStatus({ id: TASK_A.id, status: "in_progress" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Task not found" });
  });

  // ── 6. taskDelete cross-tenant guard ───────────────────────────────────────
  it("taskDelete throws NOT_FOUND when task belongs to a different tenant", async () => {
    mockTaskFindUnique.mockResolvedValueOnce({ ...TASK_A, tenantId: "tenant-B" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.tasks.taskDelete({ id: TASK_A.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Task not found" });
  });

  it("taskDelete succeeds and writes audit log for own-tenant task", async () => {
    mockTaskFindUnique.mockResolvedValueOnce(TASK_A);
    mockTaskDelete.mockResolvedValueOnce(undefined);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.tasks.taskDelete({ id: TASK_A.id });

    expect(result).toEqual({ success: true });
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "DELETE", entity: "Task" }),
      }),
    );
  });

  // ── 7. Demo tenant guard ────────────────────────────────────────────────────
  it("taskCreate throws FORBIDDEN on demo tenant", async () => {
    const caller = createCaller(ctxForTenant("tenant-A", true /* isDemoTenant */));

    await expect(
      caller.tasks.taskCreate({ projectId: PROJECT_A.id, title: "Demo task" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
