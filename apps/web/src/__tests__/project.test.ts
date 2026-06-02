/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { projectRouter } from "@/server/trpc/routers/project";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

vi.mock("@orqafy/db", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    projectExpense: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    milestone: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    fundSource: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    fundTransaction: {
      create: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const testRouter = createTRPCRouter({ project: projectRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
type MockFn = ReturnType<typeof vi.fn>;
const mockDb = db as unknown as {
  project: {
    findMany: MockFn;
    findUnique: MockFn;
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
    count: MockFn;
  };
  projectExpense: {
    findMany: MockFn;
    findUnique: MockFn;
    create: MockFn;
    update: MockFn;
    count: MockFn;
    aggregate: MockFn;
  };
  milestone: {
    findMany: MockFn;
    findUnique: MockFn;
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
  };
  fundSource: {
    findUnique: MockFn;
    update: MockFn;
  };
  fundTransaction: {
    create: MockFn;
  };
  customer: {
    findUnique: MockFn;
  };
  $transaction: MockFn;
};

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {} as NextRequest;
}
function authenticatedCtx() {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
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
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}
function demoCtx() {
  return { ...authenticatedCtx(), isDemoTenant: true };
}

const fakeProject = {
  id: "proj-1",
  projectNumber: "PRJ-123",
  name: "Test Project",
  description: null,
  customerId: null,
  managerId: "user-1",
  status: "planning",
  priority: "medium",
  startDate: null,
  targetEndDate: null,
  actualEndDate: null,
  budget: null,
  tenantId: "acme-tenant-id",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeBankSource = {
  id: "src-1",
  name: "Main Bank",
  type: "bank",
  currentBalance: { toString: () => "5000" },
};

const fakeCreditSource = {
  id: "src-2",
  name: "Corp Card",
  type: "credit_card",
  currentBalance: { toString: () => "0" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── project.update ───────────────────────────────────────────────────────────

describe("project.update", () => {
  it("planning → active (valid transition)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, status: "planning" });
    mockDb.project.update.mockResolvedValue({ ...fakeProject, status: "active" });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.update({ id: "proj-1", status: "active" });
    expect(result.status).toBe("active");
  });

  it("active → on_hold (valid transition)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, status: "active" });
    mockDb.project.update.mockResolvedValue({ ...fakeProject, status: "on_hold" });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.update({ id: "proj-1", status: "on_hold" });
    expect(result.status).toBe("on_hold");
  });

  it("on_hold → active (valid transition)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, status: "on_hold" });
    mockDb.project.update.mockResolvedValue({ ...fakeProject, status: "active" });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.update({ id: "proj-1", status: "active" });
    expect(result.status).toBe("active");
  });

  it("active → completed (valid transition)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, status: "active" });
    mockDb.project.update.mockResolvedValue({ ...fakeProject, status: "completed" });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.update({ id: "proj-1", status: "completed" });
    expect(result.status).toBe("completed");
  });

  it("planning → cancelled (valid transition)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, status: "planning" });
    mockDb.project.update.mockResolvedValue({ ...fakeProject, status: "cancelled" });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.update({ id: "proj-1", status: "cancelled" });
    expect(result.status).toBe("cancelled");
  });

  it("active → cancelled (valid transition)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, status: "active" });
    mockDb.project.update.mockResolvedValue({ ...fakeProject, status: "cancelled" });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.update({ id: "proj-1", status: "cancelled" });
    expect(result.status).toBe("cancelled");
  });

  it("planning → completed (INVALID — throws BAD_REQUEST)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, status: "planning" });
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.update({ id: "proj-1", status: "completed" })
    ).rejects.toThrow(TRPCError);
  });

  it("completed → active (INVALID — throws BAD_REQUEST)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, status: "completed" });
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.update({ id: "proj-1", status: "active" })
    ).rejects.toThrow(TRPCError);
  });

  it("cancelled → active (INVALID — throws BAD_REQUEST)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, status: "cancelled" });
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.update({ id: "proj-1", status: "active" })
    ).rejects.toThrow(TRPCError);
  });

  it("update name only (no status change) succeeds", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject });
    mockDb.project.update.mockResolvedValue({ ...fakeProject, name: "New Name" });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.update({ id: "proj-1", name: "New Name" });
    expect(result.name).toBe("New Name");
  });

  it("NOT_FOUND when project missing", async () => {
    mockDb.project.findUnique.mockResolvedValue(null);
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.update({ id: "proj-missing", name: "X" })
    ).rejects.toThrow(TRPCError);
  });

  it("unauthenticated → throws TRPCError", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(
      caller.project.update({ id: "proj-1", name: "X" })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── project.archive ──────────────────────────────────────────────────────────

describe("project.archive", () => {
  it("archives project when no expenses exist", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject });
    mockDb.projectExpense.count.mockResolvedValue(0);
    mockDb.project.update.mockResolvedValue({ ...fakeProject, status: "cancelled" });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.archive({ id: "proj-1" });
    expect(result.status).toBe("cancelled");
  });

  it("rejects when expenses exist (BAD_REQUEST)", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject });
    mockDb.projectExpense.count.mockResolvedValue(3);
    const caller = createCaller(authenticatedCtx());
    await expect(caller.project.archive({ id: "proj-1" })).rejects.toThrow(TRPCError);
  });

  it("demo tenant → throws FORBIDDEN", async () => {
    const caller = createCaller(demoCtx());
    await expect(caller.project.archive({ id: "proj-1" })).rejects.toThrow(TRPCError);
  });
});

// ─── project.budgetSummary ────────────────────────────────────────────────────

describe("project.budgetSummary", () => {
  it("returns zero totalSpent when no expenses", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, budget: 10000 });
    mockDb.projectExpense.aggregate.mockResolvedValue({ _sum: { amount: null } });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.budgetSummary({ projectId: "proj-1" });
    expect(result.totalSpent).toBe(0);
    expect(result.totalBudget).toBe(10000);
    expect(result.remaining).toBe(10000);
    expect(result.totalCommitted).toBe(0);
  });

  it("sums expenses correctly", async () => {
    mockDb.project.findUnique.mockResolvedValue({ ...fakeProject, budget: 10000 });
    mockDb.projectExpense.aggregate.mockResolvedValue({
      _sum: { amount: { toString: () => "2500" } },
    });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.budgetSummary({ projectId: "proj-1" });
    expect(result.totalSpent).toBe(2500);
    expect(result.remaining).toBe(7500);
  });

  it("NOT_FOUND when project missing", async () => {
    mockDb.project.findUnique.mockResolvedValue(null);
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.budgetSummary({ projectId: "proj-missing" })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── expense.listByProject ────────────────────────────────────────────────────

describe("expense.listByProject", () => {
  it("returns paginated expenses", async () => {
    mockDb.project.findUnique.mockResolvedValueOnce({ ...fakeProject });
    const expenses = [
      { id: "exp-1", projectId: "proj-1", amount: 500, type: "direct", description: "Paint", date: new Date() },
    ];
    mockDb.projectExpense.findMany.mockResolvedValue(expenses);
    mockDb.projectExpense.count.mockResolvedValue(1);
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.expense.listByProject({ projectId: "proj-1" });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("unauthenticated → throws TRPCError", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(
      caller.project.expense.listByProject({ projectId: "proj-1" })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── expense.recordProjectExpense ─────────────────────────────────────────────

describe("expense.recordProjectExpense", () => {
  const expenseInput = {
    projectId: "proj-1",
    amount: 1000,
    type: "direct" as const,
    description: "Materials purchase",
    fundSourceId: "src-1",
  };

  it("records expense for real-cash source: creates expense + transaction, updates balance", async () => {
    mockDb.project.findUnique.mockResolvedValue(fakeProject);
    mockDb.fundSource.findUnique.mockResolvedValue(fakeBankSource);

    const createdExpense = { id: "exp-new", projectId: "proj-1", referenceType: null, referenceId: null };
    const createdTx = { id: "tx-new", type: "expense", amount: 1000 };
    const updatedExpense = { ...createdExpense, referenceType: "fund_transaction", referenceId: "tx-new" };

    mockDb.$transaction.mockImplementation((callback: (tx: any) => Promise<any>): unknown => {
      return callback({
        projectExpense: {
          create: vi.fn().mockResolvedValue(createdExpense),
          update: vi.fn().mockResolvedValue(updatedExpense),
        },
        fundTransaction: {
          create: vi.fn().mockResolvedValue(createdTx),
        },
        fundSource: {
          update: vi.fn().mockResolvedValue({ ...fakeBankSource, currentBalance: 4000 }),
        },
      });
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.expense.recordProjectExpense(expenseInput);
    expect(result.expense.referenceType).toBe("fund_transaction");
    expect(result.expense.referenceId).toBe("tx-new");
    expect(result.transaction.id).toBe("tx-new");
  });

  it("rejects when insufficient balance on bank source", async () => {
    mockDb.project.findUnique.mockResolvedValue(fakeProject);
    mockDb.fundSource.findUnique.mockResolvedValue({
      ...fakeBankSource,
      currentBalance: { toString: () => "100" },
    });
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.expense.recordProjectExpense({ ...expenseInput, amount: 500 })
    ).rejects.toThrow(TRPCError);
  });

  it("rejects when fund source not found", async () => {
    mockDb.project.findUnique.mockResolvedValue(fakeProject);
    mockDb.fundSource.findUnique.mockResolvedValue(null);
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.expense.recordProjectExpense(expenseInput)
    ).rejects.toThrow(TRPCError);
  });

  it("rejects when project not found", async () => {
    mockDb.project.findUnique.mockResolvedValue(null);
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.expense.recordProjectExpense(expenseInput)
    ).rejects.toThrow(TRPCError);
  });

  it("credit_card source: no balance check, succeeds", async () => {
    mockDb.project.findUnique.mockResolvedValue(fakeProject);
    mockDb.fundSource.findUnique.mockResolvedValue(fakeCreditSource);

    const createdExpense = { id: "exp-cc", projectId: "proj-1", referenceType: null, referenceId: null };
    const createdTx = { id: "tx-cc", type: "expense" };
    const updatedExpense = { ...createdExpense, referenceType: "fund_transaction", referenceId: "tx-cc" };

    mockDb.$transaction.mockImplementation((callback: (tx: any) => Promise<any>): unknown => {
      return callback({
        projectExpense: {
          create: vi.fn().mockResolvedValue(createdExpense),
          update: vi.fn().mockResolvedValue(updatedExpense),
        },
        fundTransaction: {
          create: vi.fn().mockResolvedValue(createdTx),
        },
        fundSource: {
          update: vi.fn().mockResolvedValue(fakeCreditSource),
        },
      });
    });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.expense.recordProjectExpense({
      ...expenseInput,
      fundSourceId: "src-2",
    });
    expect(result.expense.referenceType).toBe("fund_transaction");
  });

  it("transaction rollback: $transaction throw propagates to caller", async () => {
    mockDb.project.findUnique.mockResolvedValue(fakeProject);
    mockDb.fundSource.findUnique.mockResolvedValue(fakeBankSource);
    mockDb.$transaction.mockRejectedValue(new Error("DB connection lost"));
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.expense.recordProjectExpense(expenseInput)
    ).rejects.toThrow();
  });
});

// ─── milestone.listByProject ──────────────────────────────────────────────────

describe("milestone.listByProject", () => {
  it("returns milestones ordered by sortOrder", async () => {
    const milestones = [
      { id: "ms-1", projectId: "proj-1", name: "Foundation", sortOrder: 0 },
      { id: "ms-2", projectId: "proj-1", name: "Framing", sortOrder: 1 },
    ];
    mockDb.milestone.findMany.mockResolvedValue(milestones);
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.milestone.listByProject({ projectId: "proj-1" });
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("Foundation");
  });

  it("returns empty array when no milestones", async () => {
    mockDb.milestone.findMany.mockResolvedValue([]);
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.milestone.listByProject({ projectId: "proj-1" });
    expect(result).toHaveLength(0);
  });
});

// ─── milestone.create ─────────────────────────────────────────────────────────

describe("milestone.create", () => {
  it("creates milestone when project exists", async () => {
    mockDb.project.findUnique.mockResolvedValue(fakeProject);
    mockDb.milestone.create.mockResolvedValue({
      id: "ms-new",
      projectId: "proj-1",
      name: "Phase 1",
      sortOrder: 0,
    });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.milestone.create({
      projectId: "proj-1",
      name: "Phase 1",
    });
    expect(result.id).toBe("ms-new");
  });

  it("NOT_FOUND when project missing", async () => {
    mockDb.project.findUnique.mockResolvedValue(null);
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.milestone.create({ projectId: "proj-missing", name: "Phase 1" })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── milestone.complete ───────────────────────────────────────────────────────

describe("milestone.complete", () => {
  it("sets completedAt and progress=100", async () => {
    mockDb.milestone.findUnique.mockResolvedValueOnce({
      id: "ms-1",
      projectId: "proj-1",
      name: "Foundation",
      completedAt: null,
    });
    mockDb.project.findUnique.mockResolvedValueOnce({ ...fakeProject });
    mockDb.milestone.update.mockResolvedValue({
      id: "ms-1",
      completedAt: new Date(),
      progress: 100,
    });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.milestone.complete({ milestoneId: "ms-1" });
    expect(result.progress).toBe(100);
    expect(result.completedAt).toBeTruthy();
  });

  it("throws BAD_REQUEST if already completed", async () => {
    mockDb.milestone.findUnique.mockResolvedValueOnce({
      id: "ms-1",
      projectId: "proj-1",
      completedAt: new Date(),
    });
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.milestone.complete({ milestoneId: "ms-1" })
    ).rejects.toThrow(TRPCError);
  });

  it("NOT_FOUND when milestone missing", async () => {
    mockDb.milestone.findUnique.mockResolvedValueOnce(null);
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.milestone.complete({ milestoneId: "ms-missing" })
    ).rejects.toThrow(TRPCError);
  });
});

// ─── milestone.update ─────────────────────────────────────────────────────────

describe("milestone.update", () => {
  it("partial update succeeds", async () => {
    mockDb.milestone.findUnique.mockResolvedValueOnce({
      id: "ms-1",
      projectId: "proj-1",
      name: "Old Name",
      sortOrder: 0,
    });
    mockDb.project.findUnique.mockResolvedValueOnce({ ...fakeProject });
    mockDb.milestone.update.mockResolvedValue({
      id: "ms-1",
      name: "New Name",
      sortOrder: 2,
    });
    const caller = createCaller(authenticatedCtx());
    const result = await caller.project.milestone.update({
      milestoneId: "ms-1",
      name: "New Name",
      sortOrder: 2,
    });
    expect(result.name).toBe("New Name");
    expect(result.sortOrder).toBe(2);
  });

  it("NOT_FOUND when milestone missing", async () => {
    mockDb.milestone.findUnique.mockResolvedValueOnce(null);
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.project.milestone.update({ milestoneId: "ms-missing", name: "X" })
    ).rejects.toThrow(TRPCError);
  });
});
