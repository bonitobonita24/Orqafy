/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * D7 — notification router unit tests.
 *
 * Proves:
 *  1. list filters on BOTH tenantId AND recipientUserId (recipient + tenant scoping)
 *  2. list orders unread-first then newest, and computes unreadCount
 *  3. list unreadOnly applies readAt: null
 *  4. unreadCount is tenant + recipient scoped
 *  5. markRead can only ever touch the caller's own row (updateMany predicate
 *     carries tenantId + recipientUserId) — a foreign id matches zero rows
 *  6. markAllRead scopes to tenant + recipient + unread
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockCount, mockUpdateMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockUpdateMany: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    notification: {
      findMany: mockFindMany,
      count: mockCount,
      updateMany: mockUpdateMany,
    },
  },
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

import { notificationRouter } from "@/server/trpc/routers/notification";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ notification: notificationRouter });
const createCaller = createCallerFactory(testRouter);

function ctx(tenantId: string, userId: string) {
  return {
    req: {} as NextRequest,
    userId,
    roles: ["Administrator"] as string[],
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

describe("Notification router (D7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list scopes the query to tenantId AND recipientUserId", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    const caller = createCaller(ctx("tenant-A", "user-1"));
    await caller.notification.list({ limit: 10 });

    const where = mockFindMany.mock.calls[0]![0].where;
    expect(where.tenantId).toBe("tenant-A");
    expect(where.recipientUserId).toBe("user-1");
  });

  it("list returns isRead/unreadCount and orders unread-first then newest", async () => {
    const rows = [
      { id: "n1", category: "system", title: "A", body: "a", payload: null, readAt: null, createdAt: new Date("2024-01-02") },
      { id: "n2", category: "system", title: "B", body: "b", payload: null, readAt: new Date(), createdAt: new Date("2024-01-01") },
    ];
    mockFindMany.mockResolvedValueOnce(rows);
    mockCount.mockResolvedValueOnce(1);

    const caller = createCaller(ctx("tenant-A", "user-1"));
    const res = await caller.notification.list({ limit: 10 });

    const orderBy = mockFindMany.mock.calls[0]![0].orderBy;
    expect(orderBy).toEqual([{ readAt: "asc" }, { createdAt: "desc" }]);
    expect(res.items[0]).toMatchObject({ id: "n1", isRead: false });
    expect(res.items[1]).toMatchObject({ id: "n2", isRead: true });
    expect(res.unreadCount).toBe(1);
  });

  it("list unreadOnly adds readAt: null to the predicate", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    const caller = createCaller(ctx("tenant-A", "user-1"));
    await caller.notification.list({ limit: 10, unreadOnly: true });

    expect(mockFindMany.mock.calls[0]![0].where.readAt).toBeNull();
  });

  it("unreadCount is tenant + recipient + unread scoped", async () => {
    mockCount.mockResolvedValueOnce(3);

    const caller = createCaller(ctx("tenant-B", "user-9"));
    const res = await caller.notification.unreadCount();

    expect(res.count).toBe(3);
    expect(mockCount.mock.calls[0]![0].where).toEqual({
      tenantId: "tenant-B",
      recipientUserId: "user-9",
      readAt: null,
    });
  });

  it("markRead predicate carries tenantId + recipientUserId (cannot touch a foreign row)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 }); // foreign id → 0 rows

    const caller = createCaller(ctx("tenant-A", "user-1"));
    const res = await caller.notification.markRead({ id: "n-belongs-to-tenant-B" });

    const where = mockUpdateMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      id: "n-belongs-to-tenant-B",
      tenantId: "tenant-A",
      recipientUserId: "user-1",
    });
    expect(res.updated).toBe(0); // proves the foreign row was not modified
  });

  it("markAllRead scopes to tenant + recipient + unread", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 5 });

    const caller = createCaller(ctx("tenant-A", "user-1"));
    const res = await caller.notification.markAllRead();

    expect(mockUpdateMany.mock.calls[0]![0].where).toEqual({
      tenantId: "tenant-A",
      recipientUserId: "user-1",
      readAt: null,
    });
    expect(res.updated).toBe(5);
  });
});
