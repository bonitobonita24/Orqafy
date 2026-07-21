// route.test.ts — GET /api/sync/payslips (down-sync pull)
// Payslips are financial PII: tenant scoping alone is NOT sufficient, the query
// must also bind to the caller's own employee record.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockResolveSyncBearerContext,
  mockRateLimitCheck,
  mockCheckMatrixGrant,
  mockPayslipFindMany,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockResolveSyncBearerContext: vi.fn(),
  mockRateLimitCheck: vi.fn(),
  mockCheckMatrixGrant: vi.fn(),
  mockPayslipFindMany: vi.fn(),
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
  prisma: { payslip: { findMany: mockPayslipFindMany } },
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

function decimal(value: number) {
  return { toNumber: () => value, toFixed: (n: number) => value.toFixed(n) };
}

const PAYSLIP_ROW = {
  id: "slip-1",
  tenantId: "tenant-1",
  grossPay: decimal(50000),
  netPay: decimal(42000),
  totalDeductions: decimal(8000),
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  payroll: {
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-06-15T00:00:00.000Z"),
  },
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/sync/payslips", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveSyncBearerContext.mockResolvedValue(BEARER_CTX);
  mockRateLimitCheck.mockReturnValue(undefined);
  mockCheckMatrixGrant.mockResolvedValue(true);
  mockPayslipFindMany.mockResolvedValue([]);
});

describe("GET /api/sync/payslips", () => {
  it("returns a generic 401 when bearer auth fails", async () => {
    mockResolveSyncBearerContext.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockPayslipFindMany).not.toHaveBeenCalled();
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

  it("returns 403 when the RBAC matrix denies payroll:view", async () => {
    mockCheckMatrixGrant.mockResolvedValueOnce(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockPayslipFindMany).not.toHaveBeenCalled();
  });

  it("binds the query to the caller's tenant AND their own employee record (PII/IDOR guard)", async () => {
    await GET(makeRequest());
    expect(mockPayslipFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        employee: { userId: "user-1" },
        payroll: { status: { in: ["approved", "paid"] } },
      },
      include: {
        payroll: { select: { periodStart: true, periodEnd: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 500,
    });
    expect(mockCheckMatrixGrant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      roleId: "role-1",
      feature: "payroll",
      action: "view",
    });
  });

  it("returns a generic 500 when the DB query throws unexpectedly, without leaking the error", async () => {
    mockPayslipFindMany.mockRejectedValueOnce(new Error("db exploded: secret detail"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/db exploded/);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("returns 200 with serialized records including the joined period", async () => {
    mockPayslipFindMany.mockResolvedValueOnce([PAYSLIP_ROW]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      records: Array<Record<string, unknown>>;
      serverTime: string;
    };
    expect(body.records[0]).toMatchObject({
      server_id: "slip-1",
      user_id: "user-1",
      period_start: Date.UTC(2026, 5, 1),
      period_end: Date.UTC(2026, 5, 15),
      gross_pay: 50000,
      net_pay: 42000,
      deductions: "8000.00",
    });
  });
});
