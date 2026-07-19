/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * tasks mobile-sync handler tests.
 *
 * Covers:
 *  1. valid status transition -> updates, writes audit + sync-op, returns serverId
 *  2. invalid status transition -> BAD_REQUEST, no write
 *  3. task belongs to a different tenant -> NOT_FOUND
 *  4. "create" action rejected (tasks sync is update-only) -> BAD_REQUEST
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTaskFindUnique, mockTaskUpdate, mockAuditLogCreate, mockSyncOpCreate } = vi.hoisted(() => ({
  mockTaskFindUnique: vi.fn(),
  mockTaskUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockSyncOpCreate: vi.fn(),
}));

function makeMockDb() {
  return {
    task: { findUnique: mockTaskFindUnique, update: mockTaskUpdate },
    auditLog: { create: mockAuditLogCreate },
    mobileSyncOp: { create: mockSyncOpCreate },
  };
}

vi.mock("@orqafy/db", () => {
  const mockDb = makeMockDb();
  return {
    prisma: {
      ...mockDb,
      $transaction: vi.fn((fn: any) => fn(mockDb)),
    },
    writeAuditLog: async (tx: any, entry: any) => {
      await tx.auditLog.create({ data: entry });
    },
  };
});

import { tasksHandler } from "@/server/sync/handlers/tasks";

const CTX = { tenantId: "tenant-A", userId: "user-1", roles: ["Operator"], roleId: "role-1" };

const TASK = { id: "task-1", tenantId: "tenant-A", status: "todo" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tasksHandler", () => {
  it("applies a valid status transition and writes audit + sync-op", async () => {
    mockTaskFindUnique.mockResolvedValueOnce(TASK);
    mockTaskUpdate.mockResolvedValueOnce({ ...TASK, status: "in_progress" });

    const result = await tasksHandler({
      ctx: CTX,
      action: "update",
      clientId: "task-1",
      data: { status: "in_progress" },
    });

    expect(result).toEqual({ serverId: "task-1" });
    expect(mockTaskUpdate).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: "in_progress" },
    });
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    expect(mockSyncOpCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-A",
        userId: "user-1",
        entityType: "tasks",
        clientId: "task-1",
        action: "update",
        serverId: "task-1",
      }),
    });
  });

  it("rejects an invalid status transition with BAD_REQUEST and does not write", async () => {
    mockTaskFindUnique.mockResolvedValueOnce({ ...TASK, status: "done" }); // done -> no transitions allowed

    await expect(
      tasksHandler({ ctx: CTX, action: "update", clientId: "task-1", data: { status: "todo" } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockTaskUpdate).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the task belongs to a different tenant", async () => {
    mockTaskFindUnique.mockResolvedValueOnce({ ...TASK, tenantId: "tenant-B" });

    await expect(
      tasksHandler({ ctx: CTX, action: "update", clientId: "task-1", data: { status: "in_progress" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects the create action — tasks sync is update-only", async () => {
    await expect(
      tasksHandler({ ctx: CTX, action: "create", clientId: "task-1", data: { status: "todo" } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockTaskFindUnique).not.toHaveBeenCalled();
  });
});
