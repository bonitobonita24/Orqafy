/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
/**
 * D7 — createNotification helper tests.
 *
 * Proves:
 *  1. persists to Prisma with the exact tenantId + recipientUserId passed (no leak)
 *  2. fans out to Valkey on the tenant+user-scoped channel
 *  3. fail-soft: a Valkey publish failure does NOT throw — the durable row wins
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockPublish } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPublish: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: { notification: { create: mockCreate } },
}));

vi.mock("@/server/notifications/valkey", () => ({
  publishNotification: mockPublish,
}));

import { createNotification } from "@/server/notifications/create";

const dbRow = {
  id: "notif-1",
  category: "task_assigned",
  title: "New task assigned",
  body: "body",
  payload: { taskId: "t1" },
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

describe("createNotification (D7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(dbRow);
    mockPublish.mockResolvedValue(true);
  });

  it("persists with the exact tenantId + recipientUserId (no cross-tenant leak)", async () => {
    await createNotification({
      tenantId: "tenant-A",
      recipientUserId: "user-7",
      category: "task_assigned",
      title: "New task assigned",
      body: "body",
      payload: { taskId: "t1" },
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0]![0].data;
    expect(data.tenantId).toBe("tenant-A");
    expect(data.recipientUserId).toBe("user-7");
    expect(data.category).toBe("task_assigned");
  });

  it("fans out to Valkey with the tenantId + recipient + persisted row", async () => {
    await createNotification({
      tenantId: "tenant-A",
      recipientUserId: "user-7",
      category: "task_assigned",
      title: "New task assigned",
      body: "body",
    });

    expect(mockPublish).toHaveBeenCalledOnce();
    const [tenantId, userId, payload] = mockPublish.mock.calls[0]!;
    expect(tenantId).toBe("tenant-A");
    expect(userId).toBe("user-7");
    expect(payload).toMatchObject({ id: "notif-1", category: "task_assigned" });
  });

  it("is fail-soft: a Valkey publish rejection does not throw", async () => {
    mockPublish.mockRejectedValueOnce(new Error("valkey down"));

    await expect(
      createNotification({
        tenantId: "tenant-A",
        recipientUserId: "user-7",
        category: "system",
        title: "t",
        body: "b",
      })
    ).resolves.toEqual({ id: "notif-1" });

    // The durable write still happened.
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});
