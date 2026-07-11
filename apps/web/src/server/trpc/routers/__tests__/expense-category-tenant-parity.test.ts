/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime closure — ExpenseCategory tenant parity
 *
 * Proves:
 *  1. expenseCategory.update throws NOT_FOUND when category belongs to tenant-B but ctx is tenant-A
 *  2. expenseCategory.delete throws NOT_FOUND when category belongs to tenant-B but ctx is tenant-A
 *  3. expenseCategory.create injects tenantId from ctx into db.expenseCategory.create data
 *  4. expenseCategory.delete throws PRECONDITION_FAILED when expenses still reference it
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type * as OrqafyDb from "@orqafy/db";

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    auth: { check: vi.fn() },
    upload: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const {
  mockCatFindUnique,
  mockCatFindFirst,
  mockCatCreate,
  mockCatUpdate,
  mockCatDelete,
  mockRoleFindFirst,
  mockRolePermFindUnique,
} = vi.hoisted(() => ({
  mockCatFindUnique: vi.fn(),
  mockCatFindFirst: vi.fn(),
  mockCatCreate: vi.fn(),
  mockCatUpdate: vi.fn(),
  mockCatDelete: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRolePermFindUnique: vi.fn(),
}));

// Keep the real `hasPermission` resolver (it takes prisma as an argument) —
// only mock the prisma client calls it (and the router) make. See the
// canonical pattern in matrix-procedure.test.ts.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      expenseCategory: {
        findUnique: mockCatFindUnique,
        findFirst: mockCatFindFirst,
        findMany: vi.fn().mockResolvedValue([]),
        create: mockCatCreate,
        update: mockCatUpdate,
        delete: mockCatDelete,
      },
      role: { findFirst: mockRoleFindFirst },
      rolePermission: { findUnique: mockRolePermFindUnique },
    },
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { expenseCategoryRouter } from "@/server/trpc/routers/expense-category";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ expenseCategory: expenseCategoryRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {
    headers: { get: (_h: string): string | null => null },
  } as unknown as NextRequest;
}

function ctxForTenant(tenantId: string) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Admin"] as string[],
    roleId: "role-1",
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ExpenseCategory tenant parity (K-prime closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: the acting "Admin" role resolves within the caller's own
    // tenant and is granted full create/update/delete on "settings" — these
    // tests assert tenant ISOLATION, not RBAC denial, so the matrix always
    // allows by default. "Admin" is NOT a bypass role name (only "Platform
    // Owner" / "Tenant Super Admin" are) so it must resolve via the matrix.
    mockRoleFindFirst.mockImplementation(
      ({ where }: { where: { id: string; tenantId: string } }) =>
        Promise.resolve({ id: where.id, tenantId: where.tenantId, name: "Admin" }),
    );
    mockRolePermFindUnique.mockResolvedValue({
      view: true,
      create: true,
      update: true,
      delete: true,
    });
  });

  it("expenseCategory.update throws NOT_FOUND when category belongs to tenant-B but ctx is tenant-A", async () => {
    mockCatFindUnique.mockResolvedValueOnce({
      id: "clh3cat0000hxog4d8e5f9aa",
      tenantId: "tenant-B",
      name: "Travel",
      code: "TRAVEL",
      isActive: true,
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.expenseCategory.update({ id: "clh3cat0000hxog4d8e5f9aa", name: "Travel Expenses" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Expense category not found." });
  });

  it("expenseCategory.delete throws NOT_FOUND when category belongs to tenant-B but ctx is tenant-A", async () => {
    mockCatFindUnique.mockResolvedValueOnce({
      id: "clh3cat0001hxog4d8e5f9ab",
      tenantId: "tenant-B",
      name: "Office",
      _count: { expenses: 0 },
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.expenseCategory.delete({ id: "clh3cat0001hxog4d8e5f9ab" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Expense category not found." });
  });

  it("expenseCategory.create injects tenantId from ctx into db.expenseCategory.create data", async () => {
    mockCatFindFirst.mockResolvedValueOnce(null); // no code conflict

    const created = {
      id: "clh3cat0002hxog4d8e5f9ac",
      tenantId: "tenant-A",
      name: "Office Supplies",
      code: "OFFICE",
      isDefault: false,
      isActive: true,
      sortOrder: 0,
    };
    mockCatCreate.mockResolvedValueOnce(created);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.expenseCategory.create({ name: "Office Supplies", code: "OFFICE" });

    expect(mockCatCreate).toHaveBeenCalledOnce();
    const callArg = mockCatCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });

  it("expenseCategory.delete throws PRECONDITION_FAILED when expenses still reference it", async () => {
    mockCatFindUnique.mockResolvedValueOnce({
      id: "clh3cat0003hxog4d8e5f9ad",
      tenantId: "tenant-A",
      name: "Meals",
      _count: { expenses: 7 },
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.expenseCategory.delete({ id: "clh3cat0003hxog4d8e5f9ad" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
