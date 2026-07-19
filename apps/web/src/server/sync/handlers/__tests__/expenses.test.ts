/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * expenses mobile-sync handler tests.
 *
 * Covers:
 *  1. valid category -> creates expense (status "pending", no receiptUrl,
 *     no audit log — matches the router's `create`), records sync-op
 *  2. invalid/missing category -> BAD_REQUEST, no create
 *  3. category belongs to a different tenant -> BAD_REQUEST
 *  4. projectId belongs to a different tenant -> BAD_REQUEST
 *  5. "update" action rejected (expenses sync is create-only) -> BAD_REQUEST
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCategoryFindUnique, mockProjectFindUnique, mockExpenseCreate, mockSyncOpCreate } = vi.hoisted(
  () => ({
    mockCategoryFindUnique: vi.fn(),
    mockProjectFindUnique: vi.fn(),
    mockExpenseCreate: vi.fn(),
    mockSyncOpCreate: vi.fn(),
  }),
);

function makeMockDb() {
  return {
    expenseCategory: { findUnique: mockCategoryFindUnique },
    project: { findUnique: mockProjectFindUnique },
    expense: { create: mockExpenseCreate },
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
  };
});

import { expensesHandler } from "@/server/sync/handlers/expenses";

const CTX = { tenantId: "tenant-A", userId: "user-1", roles: ["Operator"], roleId: "role-1" };

// z.string().cuid() (Zod v3) accepts any string starting with "c" followed
// by 8+ non-space, non-hyphen characters — these fixtures satisfy that so
// validation passes before reaching the mocked DB layer.
const CATEGORY = { id: "cexpensecategoryidaaa1", tenantId: "tenant-A", name: "Fuel" };
const PROJECT = { id: "cprojectidbbbbbbbbbbb1", tenantId: "tenant-A", name: "Site A" };
const CREATED_EXPENSE = { id: "cexpenseidccccccccccc1", tenantId: "tenant-A", status: "pending" };

const VALID_DATA = {
  description: "Diesel for generator",
  amount: 1500.5,
  currency: "PHP",
  date: "2026-07-19T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("expensesHandler", () => {
  it("creates the expense with a valid category, no receiptUrl, no audit log, records sync-op", async () => {
    mockCategoryFindUnique.mockResolvedValueOnce(CATEGORY);
    mockExpenseCreate.mockResolvedValueOnce(CREATED_EXPENSE);

    const result = await expensesHandler({
      ctx: CTX,
      action: "create",
      clientId: "local-exp-1",
      data: { ...VALID_DATA, expenseCategoryId: CATEGORY.id },
    });

    expect(result).toEqual({ serverId: CREATED_EXPENSE.id });
    const createData = (mockExpenseCreate.mock.calls[0] as any)[0].data;
    expect(createData.tenantId).toBe("tenant-A");
    expect(createData.receiptUrl).toBeNull();
    expect(createData.status).toBe("pending");
    expect(createData.createdById).toBe("user-1");
    expect(mockSyncOpCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "expenses",
        clientId: "local-exp-1",
        action: "create",
        serverId: CREATED_EXPENSE.id,
      }),
    });
  });

  it("throws BAD_REQUEST when the category does not exist", async () => {
    mockCategoryFindUnique.mockResolvedValueOnce(null);

    await expect(
      expensesHandler({
        ctx: CTX,
        action: "create",
        clientId: "local-exp-1",
        data: { ...VALID_DATA, expenseCategoryId: CATEGORY.id },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockExpenseCreate).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when the category belongs to a different tenant", async () => {
    mockCategoryFindUnique.mockResolvedValueOnce({ ...CATEGORY, tenantId: "tenant-B" });

    await expect(
      expensesHandler({
        ctx: CTX,
        action: "create",
        clientId: "local-exp-1",
        data: { ...VALID_DATA, expenseCategoryId: CATEGORY.id },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when a supplied projectId belongs to a different tenant", async () => {
    mockCategoryFindUnique.mockResolvedValueOnce(CATEGORY);
    mockProjectFindUnique.mockResolvedValueOnce({ ...PROJECT, tenantId: "tenant-B" });

    await expect(
      expensesHandler({
        ctx: CTX,
        action: "create",
        clientId: "local-exp-1",
        data: { ...VALID_DATA, expenseCategoryId: CATEGORY.id, projectId: PROJECT.id },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockExpenseCreate).not.toHaveBeenCalled();
  });

  it("rejects the update action — expenses sync is create-only", async () => {
    await expect(
      expensesHandler({
        ctx: CTX,
        action: "update",
        clientId: "local-exp-1",
        data: { ...VALID_DATA, expenseCategoryId: CATEGORY.id },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockCategoryFindUnique).not.toHaveBeenCalled();
  });
});
