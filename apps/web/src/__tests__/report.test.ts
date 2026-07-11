/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OrqafyDb from "@orqafy/db";
import { reportRouter } from "@/server/trpc/routers/report";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      invoice: {
        aggregate: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
      },
      expense: {
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      expenseCategory: {
        findMany: vi.fn(),
      },
      jobOrder: {
        groupBy: vi.fn(),
      },
      customer: {
        count: vi.fn(),
      },
      project: {
        count: vi.fn(),
      },
      employee: {
        count: vi.fn(),
      },
      payroll: {
        aggregate: vi.fn(),
      },
      // RBAC matrix (feature "reports"): resolved via the real hasPermission.
      role: { findFirst: vi.fn() },
      rolePermission: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
  },
}));

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {
    headers: { get: (_h: string): string | null => null },
  } as unknown as NextRequest;
}
function authenticatedCtx(roles: string[] = ["Administrator"]) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    roleId: "role-1",
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
    roleId: null,
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}

const testRouter = createTRPCRouter({ report: reportRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  invoice: { aggregate: any; findMany: any; groupBy: any };
  expense: { aggregate: any; groupBy: any };
  expenseCategory: { findMany: any };
  jobOrder: { groupBy: any };
  customer: { count: any };
  project: { count: any };
  employee: { count: any };
  payroll: { aggregate: any };
  role: { findFirst: any };
  rolePermission: { findUnique: any };
};

beforeEach(() => {
  vi.clearAllMocks();
  // These are aggregation tests, not RBAC tests: resolve the caller's role to a
  // matrix-bypass role ("Platform Owner") so the reports "view" gate short-circuits
  // to allow. The matrix gate itself is covered in report-matrix.test.ts.
  mockDb.role.findFirst.mockResolvedValue({
    id: "role-1",
    tenantId: "acme-tenant-id",
    name: "Platform Owner",
  });
});

describe("report.dashboardKPIs", () => {
  it("aggregates revenue, expenses, job-order status counts, and entity counts (no date filter)", async () => {
    mockDb.invoice.aggregate.mockResolvedValue({
      _sum: { totalAmount: 125_000 },
      _count: { id: 12 },
    });
    mockDb.expense.aggregate.mockResolvedValue({
      _sum: { amount: 38_000 },
      _count: { id: 22 },
    });
    mockDb.jobOrder.groupBy.mockResolvedValue([
      { status: "received", _count: { id: 4 } },
      { status: "in_progress", _count: { id: 6 } },
      { status: "completed", _count: { id: 9 } },
    ]);
    mockDb.customer.count.mockResolvedValue(48);
    mockDb.project.count.mockResolvedValue(7);
    mockDb.employee.count.mockResolvedValue(15);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.dashboardKPIs({});

    expect(result.revenue).toEqual({ total: 125_000, invoiceCount: 12 });
    expect(result.expenses).toEqual({ total: 38_000, expenseCount: 22 });
    expect(result.jobOrders).toEqual({ received: 4, in_progress: 6, completed: 9 });
    expect(result.counts).toEqual({ customers: 48, projects: 7, employees: 15 });

    expect(mockDb.invoice.aggregate).toHaveBeenCalledWith({
      where: { tenantId: "acme-tenant-id" },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
  });

  it("applies createdAt date filter when startDate + endDate provided", async () => {
    mockDb.invoice.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 }, _count: { id: 0 } });
    mockDb.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } });
    mockDb.jobOrder.groupBy.mockResolvedValue([]);
    mockDb.customer.count.mockResolvedValue(0);
    mockDb.project.count.mockResolvedValue(0);
    mockDb.employee.count.mockResolvedValue(0);

    const start = new Date("2026-01-01");
    const end = new Date("2026-03-31");
    const caller = createCaller(authenticatedCtx());
    await caller.report.dashboardKPIs({ startDate: start, endDate: end });

    expect(mockDb.invoice.aggregate).toHaveBeenCalledWith({
      where: { tenantId: "acme-tenant-id", createdAt: { gte: start, lte: end } },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
    expect(mockDb.expense.aggregate).toHaveBeenCalledWith({
      where: { tenantId: "acme-tenant-id", createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { id: true },
    });
    expect(mockDb.jobOrder.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: { tenantId: "acme-tenant-id", createdAt: { gte: start, lte: end } },
      _count: { id: true },
    });
  });

  it("treats null aggregate sums as zero (empty database)", async () => {
    mockDb.invoice.aggregate.mockResolvedValue({
      _sum: { totalAmount: null },
      _count: { id: 0 },
    });
    mockDb.expense.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    });
    mockDb.jobOrder.groupBy.mockResolvedValue([]);
    mockDb.customer.count.mockResolvedValue(0);
    mockDb.project.count.mockResolvedValue(0);
    mockDb.employee.count.mockResolvedValue(0);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.dashboardKPIs({});

    expect(result.revenue.total).toBe(0);
    expect(result.expenses.total).toBe(0);
    expect(result.jobOrders).toEqual({});
  });

  it("applies only startDate filter when endDate omitted", async () => {
    mockDb.invoice.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 }, _count: { id: 0 } });
    mockDb.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } });
    mockDb.jobOrder.groupBy.mockResolvedValue([]);
    mockDb.customer.count.mockResolvedValue(0);
    mockDb.project.count.mockResolvedValue(0);
    mockDb.employee.count.mockResolvedValue(0);

    const start = new Date("2026-04-01");
    const caller = createCaller(authenticatedCtx());
    await caller.report.dashboardKPIs({ startDate: start });

    expect(mockDb.invoice.aggregate).toHaveBeenCalledWith({
      where: { tenantId: "acme-tenant-id", createdAt: { gte: start } },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
  });

  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.report.dashboardKPIs({})).rejects.toBeInstanceOf(TRPCError);
  });
});

describe("report.revenueByPeriod", () => {
  it("returns paid invoices within the date range, ordered ascending by paidAt", async () => {
    const paidInvoices = [
      { paidAt: new Date("2026-01-05"), totalAmount: 5_000 },
      { paidAt: new Date("2026-01-18"), totalAmount: 12_500 },
      { paidAt: new Date("2026-02-04"), totalAmount: 7_200 },
    ];
    mockDb.invoice.findMany.mockResolvedValue(paidInvoices);

    const start = new Date("2026-01-01");
    const end = new Date("2026-02-28");
    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.revenueByPeriod({ startDate: start, endDate: end });

    expect(result).toEqual(paidInvoices);
    expect(mockDb.invoice.findMany).toHaveBeenCalledWith({
      where: { tenantId: "acme-tenant-id", status: "paid", paidAt: { gte: start, lte: end } },
      select: { paidAt: true, totalAmount: true },
      orderBy: { paidAt: "asc" },
    });
  });

  it("returns empty list when no paid invoices in range", async () => {
    mockDb.invoice.findMany.mockResolvedValue([]);
    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.revenueByPeriod({
      startDate: new Date("2026-05-01"),
      endDate: new Date("2026-05-31"),
    });
    expect(result).toEqual([]);
  });

  it("requires both startDate and endDate (Zod validation)", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.report.revenueByPeriod({ startDate: new Date("2026-01-01") } as any)
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(
      caller.report.revenueByPeriod({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
      })
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

describe("report.invoicesByStatus", () => {
  it("groups invoices by status with count and sum totalAmount", async () => {
    const grouped = [
      { status: "paid", _count: { id: 12 }, _sum: { totalAmount: 125_000 } },
      { status: "sent", _count: { id: 4 }, _sum: { totalAmount: 28_000 } },
      { status: "draft", _count: { id: 3 }, _sum: { totalAmount: 14_500 } },
      { status: "overdue", _count: { id: 2 }, _sum: { totalAmount: 9_800 } },
    ];
    mockDb.invoice.groupBy.mockResolvedValue(grouped);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.invoicesByStatus();

    expect(result).toEqual(grouped);
    expect(mockDb.invoice.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: { tenantId: "acme-tenant-id" },
      _count: { id: true },
      _sum: { totalAmount: true },
    });
  });

  it("returns empty array when no invoices exist", async () => {
    mockDb.invoice.groupBy.mockResolvedValue([]);
    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.invoicesByStatus();
    expect(result).toEqual([]);
  });

  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.report.invoicesByStatus()).rejects.toBeInstanceOf(TRPCError);
  });
});

describe("report.expensesByCategory", () => {
  it("groups approved expenses by expenseCategoryId with no date filter", async () => {
    const grouped = [
      {
        expenseCategoryId: "cat-rent",
        _sum: { amount: 24_000 },
        _count: { id: 4 },
      },
      {
        expenseCategoryId: "cat-utilities",
        _sum: { amount: 8_500 },
        _count: { id: 6 },
      },
    ];
    mockDb.expense.groupBy.mockResolvedValue(grouped);
    mockDb.expenseCategory.findMany.mockResolvedValue([
      { id: "cat-rent", name: "Rent" },
      { id: "cat-utilities", name: "Utilities" },
    ]);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.expensesByCategory({});

    expect(result).toEqual([
      { expenseCategoryId: "cat-rent", _sum: { amount: 24_000 }, _count: { id: 4 }, categoryName: "Rent" },
      { expenseCategoryId: "cat-utilities", _sum: { amount: 8_500 }, _count: { id: 6 }, categoryName: "Utilities" },
    ]);
    expect(mockDb.expense.groupBy).toHaveBeenCalledWith({
      by: ["expenseCategoryId"],
      where: { tenantId: "acme-tenant-id", status: "approved" },
      _sum: { amount: true },
      _count: { id: true },
    });
  });

  it("applies date filter on Expense.date field (not createdAt) when provided", async () => {
    mockDb.expense.groupBy.mockResolvedValue([]);
    mockDb.expenseCategory.findMany.mockResolvedValue([]);

    const start = new Date("2026-01-01");
    const end = new Date("2026-03-31");
    const caller = createCaller(authenticatedCtx());
    await caller.report.expensesByCategory({ startDate: start, endDate: end });

    expect(mockDb.expense.groupBy).toHaveBeenCalledWith({
      by: ["expenseCategoryId"],
      where: {
        tenantId: "acme-tenant-id",
        status: "approved",
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: { id: true },
    });
  });

  it("filters only approved expenses (rejects pending/rejected from totals)", async () => {
    mockDb.expense.groupBy.mockResolvedValue([
      { expenseCategoryId: "cat-rent", _sum: { amount: 24_000 }, _count: { id: 4 } },
    ]);
    mockDb.expenseCategory.findMany.mockResolvedValue([]);

    const caller = createCaller(authenticatedCtx());
    await caller.report.expensesByCategory({});

    const call = mockDb.expense.groupBy.mock.calls[0][0];
    expect(call.where.status).toBe("approved");
  });

  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.report.expensesByCategory({})).rejects.toBeInstanceOf(TRPCError);
  });
});

describe("report.topClients", () => {
  it("groups paid invoices by customerId, ordered by sum totalAmount desc, default limit 10", async () => {
    const grouped = [
      { customerId: "cust-a", _sum: { totalAmount: 80_000 }, _count: { id: 6 } },
      { customerId: "cust-b", _sum: { totalAmount: 45_000 }, _count: { id: 3 } },
      { customerId: "cust-c", _sum: { totalAmount: 22_500 }, _count: { id: 2 } },
    ];
    mockDb.invoice.groupBy.mockResolvedValue(grouped);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.topClients({});

    expect(result).toEqual(grouped);
    expect(mockDb.invoice.groupBy).toHaveBeenCalledWith({
      by: ["customerId"],
      where: { tenantId: "acme-tenant-id", status: "paid" },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    });
  });

  it("honors a custom limit value (5)", async () => {
    mockDb.invoice.groupBy.mockResolvedValue([]);
    const caller = createCaller(authenticatedCtx());
    await caller.report.topClients({ limit: 5 });

    const call = mockDb.invoice.groupBy.mock.calls[0][0];
    expect(call.take).toBe(5);
  });

  it("rejects limit > 20 via Zod max constraint", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(caller.report.topClients({ limit: 50 })).rejects.toBeInstanceOf(TRPCError);
  });

  it("rejects limit < 1 via Zod min constraint", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(caller.report.topClients({ limit: 0 })).rejects.toBeInstanceOf(TRPCError);
  });

  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.report.topClients({})).rejects.toBeInstanceOf(TRPCError);
  });
});

describe("report.payrollSummary", () => {
  it("aggregates paid payrolls — sum gross, deductions, net, and count", async () => {
    mockDb.payroll.aggregate.mockResolvedValue({
      _sum: { totalGross: 480_000, totalNet: 384_000, totalDeductions: 96_000 },
      _count: { id: 8 },
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.payrollSummary({});

    expect(result._sum.totalGross).toBe(480_000);
    expect(result._sum.totalNet).toBe(384_000);
    expect(result._sum.totalDeductions).toBe(96_000);
    expect(result._count.id).toBe(8);

    expect(mockDb.payroll.aggregate).toHaveBeenCalledWith({
      where: { tenantId: "acme-tenant-id", status: "paid" },
      _sum: { totalGross: true, totalNet: true, totalDeductions: true },
      _count: { id: true },
    });
  });

  it("applies periodStart date filter when startDate + endDate provided", async () => {
    mockDb.payroll.aggregate.mockResolvedValue({
      _sum: { totalGross: 0, totalNet: 0, totalDeductions: 0 },
      _count: { id: 0 },
    });

    const start = new Date("2026-01-01");
    const end = new Date("2026-06-30");
    const caller = createCaller(authenticatedCtx());
    await caller.report.payrollSummary({ startDate: start, endDate: end });

    expect(mockDb.payroll.aggregate).toHaveBeenCalledWith({
      where: {
        tenantId: "acme-tenant-id",
        status: "paid",
        periodStart: { gte: start, lte: end },
      },
      _sum: { totalGross: true, totalNet: true, totalDeductions: true },
      _count: { id: true },
    });
  });

  it("excludes draft/processing/approved/void payrolls (paid only)", async () => {
    mockDb.payroll.aggregate.mockResolvedValue({
      _sum: { totalGross: 0, totalNet: 0, totalDeductions: 0 },
      _count: { id: 0 },
    });

    const caller = createCaller(authenticatedCtx());
    await caller.report.payrollSummary({});

    const call = mockDb.payroll.aggregate.mock.calls[0][0];
    expect(call.where.status).toBe("paid");
  });

  it("handles null sums as zero (no paid payrolls yet)", async () => {
    mockDb.payroll.aggregate.mockResolvedValue({
      _sum: { totalGross: null, totalNet: null, totalDeductions: null },
      _count: { id: 0 },
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.report.payrollSummary({});

    expect(result._sum.totalGross).toBeNull();
    expect(result._sum.totalNet).toBeNull();
    expect(result._sum.totalDeductions).toBeNull();
    expect(result._count.id).toBe(0);
  });

  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.report.payrollSummary({})).rejects.toBeInstanceOf(TRPCError);
  });
});
