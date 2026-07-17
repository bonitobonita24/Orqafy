/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime closure — Expense tenant parity
 *
 * Proves:
 *  1. expense.byId throws NOT_FOUND when expense belongs to tenant-B but ctx is tenant-A
 *  2. expense.byId returns the expense when tenantId matches ctx
 *  3. expense.create throws BAD_REQUEST when expenseCategory belongs to tenant-B but ctx is tenant-A
 *  4. expense.create injects tenantId from ctx into db.expense.create data
 *  5. (M7.2) expense.create throws BAD_REQUEST when projectId belongs to tenant-B
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OrqafyDb from "@orqafy/db";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const {
  mockExpenseFindUnique,
  mockExpenseCreate,
  mockExpenseCategoryFindUnique,
  mockProjectFindUnique,
  mockRoleFindFirst,
} = vi.hoisted(() => ({
  mockExpenseFindUnique: vi.fn(),
  mockExpenseCreate: vi.fn(),
  mockExpenseCategoryFindUnique: vi.fn(),
  mockProjectFindUnique: vi.fn(),
  mockRoleFindFirst: vi.fn(),
}));

// Keep the real `hasPermission` resolver (matrix.ts imports it directly from
// "@orqafy/db") — only mock the prisma client calls it and the router make.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      expense: {
        findUnique: mockExpenseFindUnique,
        findMany: vi.fn(),
        create: mockExpenseCreate,
        update: vi.fn(),
        count: vi.fn(),
      },
      expenseCategory: {
        findUnique: mockExpenseCategoryFindUnique,
        findMany: vi.fn(),
      },
      project: {
        findUnique: mockProjectFindUnique,
      },
      // Router migrated to the data-driven `role_permissions` matrix
      // (feature key "expenses") — matrixMiddleware resolves the caller's
      // role via role.findFirst. Every ctx below uses roleId "role-1" and
      // role name "Platform Owner" so the matrix bypasses entirely (this
      // suite proves tenant-scoping business logic, not matrix grants —
      // see expense-matrix.test.ts for matrix grant/deny coverage).
      role: {
        findFirst: mockRoleFindFirst,
      },
      rolePermission: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { expenseRouter } from "@/server/trpc/routers/expense";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ expense: expenseRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(tenantId: string) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    roleId: "role-1",
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Expense tenant parity (K-prime closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every test's caller resolves to a "Platform Owner" role, which
    // bypasses the "expenses" matrix entirely (tenant-rbac-standard.md §4)
    // — this suite exercises tenant-scoping business logic, not matrix
    // grant/deny behaviour (see expense-matrix.test.ts for that coverage).
    mockRoleFindFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "tenant-A",
      name: "Platform Owner",
    });
  });

  it("expense.byId throws NOT_FOUND when expense belongs to tenant-B but ctx is tenant-A", async () => {
    // loadExpenseForTenant calls findUnique — returns tenant-B row → should throw
    const expenseIdB = "clh3k2p0q0002hxog4d8e5f9b";
    mockExpenseFindUnique.mockResolvedValueOnce({
      id: expenseIdB,
      tenantId: "tenant-B",
      description: "Other expense",
      amount: 100,
      currency: "PHP",
      status: "pending",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(caller.expense.byId({ id: expenseIdB })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Expense not found",
    });
  });

  it("expense.byId returns the expense when tenantId matches ctx", async () => {
    const expenseId = "clh3k2p0q0003hxog4d8e5f9c";
    const expense = {
      id: expenseId,
      tenantId: "tenant-A",
      description: "Office supplies",
      amount: 500,
      currency: "PHP",
      status: "pending",
      expenseCategory: { name: "Office", code: "OFF" },
      createdBy: { firstName: "Alice", lastName: "Smith", displayName: "Alice Smith", email: "alice@example.com" },
      approvedBy: null,
    };
    // byId calls findUnique twice: once in loadExpenseForTenant (plain row), once with include
    // mockResolvedValue (not Once) so both calls return the same object
    mockExpenseFindUnique.mockResolvedValue(expense);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.expense.byId({ id: expenseId });

    expect(result).toEqual(expense);
  });

  it("expense.create throws BAD_REQUEST when expenseCategory belongs to tenant-B but ctx is tenant-A", async () => {
    // Category in tenant-B — ctx is tenant-A
    // cuid format: c + 24 lowercase alphanumeric chars
    const catId = "clh3k2p0q0000hxog4d8e5f9j";
    mockExpenseCategoryFindUnique.mockResolvedValueOnce({
      id: catId,
      tenantId: "tenant-B",
      name: "Travel",
      isActive: true,
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.expense.create({
        expenseCategoryId: catId,
        description: "test",
        amount: 100,
        currency: "PHP",
        date: new Date("2024-01-01"),
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Category not found.",
    });
  });

  it("expense.create injects tenantId from ctx into db.expense.create data", async () => {
    const catId = "clh3k2p0q0000hxog4d8e5f9j";
    // Category in tenant-A — should pass the guard
    mockExpenseCategoryFindUnique.mockResolvedValueOnce({
      id: catId,
      tenantId: "tenant-A",
      name: "Office",
      isActive: true,
    });

    const createdExpense = {
      id: "clh3k2p0q0001hxog4d8e5f9k",
      tenantId: "tenant-A",
      expenseCategoryId: catId,
      description: "test",
      amount: 100,
      currency: "PHP",
      date: new Date("2024-01-01"),
      status: "pending",
    };
    mockExpenseCreate.mockResolvedValueOnce(createdExpense);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.expense.create({
      expenseCategoryId: catId,
      description: "test",
      amount: 100,
      currency: "PHP",
      date: new Date("2024-01-01"),
    });

    expect(mockExpenseCreate).toHaveBeenCalledOnce();
    const callArg = mockExpenseCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });

  it("expense.create throws BAD_REQUEST when projectId belongs to a different tenant (M7.2)", async () => {
    const catId = "clh3k2p0q0000hxog4d8e5f9j";
    mockExpenseCategoryFindUnique.mockResolvedValueOnce({
      id: catId,
      tenantId: "tenant-A",
      name: "Office",
      isActive: true,
    });
    const projectId = "clh3k2p0q0005hxog4d8e5f9m";
    mockProjectFindUnique.mockResolvedValueOnce({
      id: projectId,
      tenantId: "tenant-B",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.expense.create({
        expenseCategoryId: catId,
        projectId,
        description: "test",
        amount: 100,
        currency: "PHP",
        date: new Date("2024-01-01"),
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Project not found.",
    });
    expect(mockExpenseCreate).not.toHaveBeenCalled();
  });
});
