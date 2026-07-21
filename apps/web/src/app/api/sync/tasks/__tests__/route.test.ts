// route.test.ts — GET /api/sync/tasks (down-sync pull)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockResolveSyncBearerContext,
  mockRateLimitCheck,
  mockCheckMatrixGrant,
  mockTaskFindMany,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockResolveSyncBearerContext: vi.fn(),
  mockRateLimitCheck: vi.fn(),
  mockCheckMatrixGrant: vi.fn(),
  mockTaskFindMany: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/server/sync/bearer-context", () => ({
  resolveSyncBearerContext: mockResolveSyncBearerContext,
}));
vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { mobile_sync: { check: mockRateLimitCheck } },
}));
vi.mock("@/server/sync/matrix-check", () => ({
  checkMatrixGrant: mockCheckMatrixGrant,
}));
vi.mock("@orqafy/db", () => ({
  prisma: { task: { findMany: mockTaskFindMany } },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: mockLoggerError } }));

import { GET } from "../route";
import { TRPCError } from "@trpc/server";

const BEARER_CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  roleId: "role-1",
  roles: ["Operator"],
  isDemoTenant: false,
};

const TASK_ROW = {
  id: "task-1",
  tenantId: "tenant-1",
  title: "Fix the pump",
  description: null,
  status: "todo",
  priority: "high",
  dueDate: null,
  projectId: "proj-1",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/sync/tasks", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveSyncBearerContext.mockResolvedValue(BEARER_CTX);
  mockRateLimitCheck.mockReturnValue(undefined);
  mockCheckMatrixGrant.mockResolvedValue(true);
  mockTaskFindMany.mockResolvedValue([]);
});

describe("GET /api/sync/tasks", () => {
  it("returns a generic 401 when bearer auth fails", async () => {
    mockResolveSyncBearerContext.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockTaskFindMany).not.toHaveBeenCalled();
  });

  it("returns a generic 500 when bearer resolution throws unexpectedly", async () => {
    mockResolveSyncBearerContext.mockRejectedValueOnce(new Error("db exploded: secret detail"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/db exploded/);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    mockRateLimitCheck.mockImplementationOnce(() => {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "slow down" });
    });
    expect((await GET(makeRequest())).status).toBe(429);
  });

  it("returns 403 when the RBAC matrix denies tasks:view", async () => {
    mockCheckMatrixGrant.mockResolvedValueOnce(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockTaskFindMany).not.toHaveBeenCalled();
  });

  it("scopes the query to the caller's tenant AND their own assignments", async () => {
    await GET(makeRequest());
    expect(mockTaskFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        assignments: { some: { userId: "user-1" } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 500,
    });
    expect(mockCheckMatrixGrant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      roleId: "role-1",
      feature: "tasks",
      action: "view",
    });
  });

  it("returns a generic 500 when the DB query throws unexpectedly, without leaking the error", async () => {
    mockTaskFindMany.mockRejectedValueOnce(new Error("db exploded: secret detail"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/db exploded/);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("returns 200 with serialized records and a serverTime", async () => {
    mockTaskFindMany.mockResolvedValueOnce([TASK_ROW]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      records: Array<Record<string, unknown>>;
      serverTime: string;
    };
    expect(body.records).toHaveLength(1);
    expect(body.records[0]).toMatchObject({
      server_id: "task-1",
      tenant_id: "tenant-1",
      assigned_to: "user-1",
      synced: true,
    });
    expect(Number.isNaN(Date.parse(body.serverTime))).toBe(false);
  });
});
