// route.test.ts — GET /api/sync/expense-categories
//
// Covers:
//   (a) auth failure -> 401
//   (b) auth throws unexpectedly -> 500, generic message, error logged
//   (c) rate-limited -> 429
//   (d) RBAC denied -> 403
//   (e) success -> 200, tenant-scoped active categories, only {id, name}
//       returned as a bare array

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockResolveSyncBearerContext,
  mockRateLimitCheck,
  mockCheckMatrixGrant,
  mockCategoryFindMany,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockResolveSyncBearerContext: vi.fn(),
  mockRateLimitCheck: vi.fn(),
  mockCheckMatrixGrant: vi.fn(),
  mockCategoryFindMany: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@/server/sync/bearer-context", () => ({
  resolveSyncBearerContext: mockResolveSyncBearerContext,
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    mobile_sync: { check: mockRateLimitCheck },
  },
}));

vi.mock("@/server/sync/matrix-check", () => ({
  checkMatrixGrant: mockCheckMatrixGrant,
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    expenseCategory: { findMany: mockCategoryFindMany },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mockLoggerError },
}));

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

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/sync/expense-categories", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveSyncBearerContext.mockResolvedValue(BEARER_CTX);
  mockRateLimitCheck.mockReturnValue(undefined);
  mockCheckMatrixGrant.mockResolvedValue(true);
  mockCategoryFindMany.mockResolvedValue([]);
});

describe("GET /api/sync/expense-categories", () => {
  it("returns a generic 401 when bearer auth fails", async () => {
    mockResolveSyncBearerContext.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
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
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns 403 when the RBAC matrix denies the grant", async () => {
    mockCheckMatrixGrant.mockResolvedValueOnce(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockCategoryFindMany).not.toHaveBeenCalled();
  });

  it("returns 200 with the tenant-scoped active category list", async () => {
    mockCategoryFindMany.mockResolvedValueOnce([
      { id: "cat-1", name: "Fuel" },
      { id: "cat-2", name: "Supplies" },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string; name: string }>;
    expect(body).toEqual([
      { id: "cat-1", name: "Fuel" },
      { id: "cat-2", name: "Supplies" },
    ]);
    expect(mockCategoryFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    });
    expect(mockCheckMatrixGrant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      roleId: "role-1",
      feature: "expenses",
      action: "view",
    });
  });
});
