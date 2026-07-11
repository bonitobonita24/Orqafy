/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Project tenant-parity tests
 *
 * Proves:
 *  1. project.list scopes to ctx.tenantId only
 *  2. project.byId throws NOT_FOUND for cross-tenant access (IDOR guard)
 *  3. project.create injects tenantId from ctx (not input) + writes audit log
 *  4. project.update throws NOT_FOUND for cross-tenant (IDOR guard)
 *  5. project.update writes audit log on own-tenant project
 *  6. project.archive throws NOT_FOUND for cross-tenant (IDOR guard)
 *  7. project.archive writes audit log on own-tenant project
 *  8. project.milestone.create injects tenantId + writes audit log
 *  9. project.milestone.delete throws NOT_FOUND for cross-tenant
 * 10. project.milestone.complete throws BAD_REQUEST when already completed
 * 11. project.expense.recordProjectExpense throws NOT_FOUND for cross-tenant
 * 12. writeProcedure (demo guard) blocks mutations on demo tenant
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const {
  mockProjectFindUnique,
  mockProjectFindMany,
  mockProjectCreate,
  mockProjectUpdate,
  mockProjectCount,
  mockMilestoneFindUnique,
  mockMilestoneCreate,
  mockMilestoneUpdate,
  mockMilestoneDelete,
  mockProjectExpenseCreate,
  mockProjectExpenseUpdate,
  mockProjectExpenseCount,
  mockFundSourceFindUnique,
  mockFundTransactionCreate,
  mockFundSourceUpdate,
  mockCustomerFindUnique,
  mockAuditLogCreate,
  mockRoleFindFirst,
  mockRolePermissionFindUnique,
} = vi.hoisted(() => ({
  mockProjectFindUnique: vi.fn(),
  mockProjectFindMany: vi.fn(),
  mockProjectCreate: vi.fn(),
  mockProjectUpdate: vi.fn(),
  mockProjectCount: vi.fn(),
  mockMilestoneFindUnique: vi.fn(),
  mockMilestoneCreate: vi.fn(),
  mockMilestoneUpdate: vi.fn(),
  mockMilestoneDelete: vi.fn(),
  mockProjectExpenseCreate: vi.fn(),
  mockProjectExpenseUpdate: vi.fn(),
  mockProjectExpenseCount: vi.fn(),
  mockFundSourceFindUnique: vi.fn(),
  mockFundTransactionCreate: vi.fn(),
  mockFundSourceUpdate: vi.fn(),
  mockCustomerFindUnique: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRolePermissionFindUnique: vi.fn(),
}));

// Keep the real `hasPermission` resolver (matrix.ts imports it directly from
// "@orqafy/db") — only mock the prisma client calls it and the router make.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@orqafy/db");
  const mockDb = {
    project: {
      findUnique: mockProjectFindUnique,
      findMany: mockProjectFindMany,
      create: mockProjectCreate,
      update: mockProjectUpdate,
      count: mockProjectCount,
    },
    milestone: {
      findUnique: mockMilestoneFindUnique,
      create: mockMilestoneCreate,
      update: mockMilestoneUpdate,
      delete: mockMilestoneDelete,
      findMany: vi.fn().mockResolvedValue([]),
    },
    projectExpense: {
      create: mockProjectExpenseCreate,
      update: mockProjectExpenseUpdate,
      count: mockProjectExpenseCount,
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    fundSource: {
      findUnique: mockFundSourceFindUnique,
      update: mockFundSourceUpdate,
    },
    fundTransaction: {
      create: mockFundTransactionCreate,
    },
    customer: {
      findUnique: mockCustomerFindUnique,
    },
    auditLog: { create: mockAuditLogCreate },
    // Router migrated to the data-driven `role_permissions` matrix (feature
    // key "projects") — matrixMiddleware resolves the caller's role via
    // role.findFirst. beforeEach defaults role-1 to "Platform Owner", which
    // bypasses the matrix entirely (this suite proves tenant-scoping
    // business logic, not matrix grants — see project-matrix.test.ts).
    role: {
      findFirst: mockRoleFindFirst,
    },
    rolePermission: {
      findUnique: mockRolePermissionFindUnique,
    },
  };
  return {
    ...actual,
    prisma: {
      ...mockDb,
      $transaction: vi.fn((fn: any) => fn(mockDb)),
    },
    writeAuditLog: async (tx: any, entry: any) => {
      await tx.auditLog.create({ data: entry });
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

vi.mock("@/server/lib/sanitize", () => ({
  sanitizePlainText: (s: string) => s,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { projectRouter } from "@/server/trpc/routers/project";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ project: projectRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(tenantId: string, isDemoTenant = false) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    roleId: "role-1",
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant,
    session: null,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const PROJECT_A = {
  id: "proj-a-0000000000000000",
  tenantId: "tenant-A",
  name: "Alpha Project",
  status: "planning",
  priority: "medium",
  projectNumber: "PRJ-001",
  customerId: null,
  description: null,
  startDate: null,
  targetEndDate: null,
  actualEndDate: null,
  budget: null,
  managerId: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MILESTONE_A = {
  id: "ms-a-00000000000000000000",
  tenantId: "tenant-A",
  projectId: PROJECT_A.id,
  name: "Phase 1 Kickoff",
  description: null,
  dueDate: null,
  completedAt: null,
  progress: 0,
  sortOrder: 0,
  isAutoComplete: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FUND_SOURCE_A = {
  id: "fs-a-000000000000000000",
  tenantId: "tenant-A",
  type: "cash_on_hand",
  currentBalance: 50000,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Project tenant parity (L3 RBAC + L5 AuditLog + tenant-scope isolation)", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    const { prisma } = await import("@orqafy/db");
    const mockDb = {
      project: {
        findUnique: mockProjectFindUnique,
        findMany: mockProjectFindMany,
        create: mockProjectCreate,
        update: mockProjectUpdate,
        count: mockProjectCount,
      },
      milestone: {
        findUnique: mockMilestoneFindUnique,
        create: mockMilestoneCreate,
        update: mockMilestoneUpdate,
        delete: mockMilestoneDelete,
        findMany: vi.fn().mockResolvedValue([]),
      },
      projectExpense: {
        create: mockProjectExpenseCreate,
        update: mockProjectExpenseUpdate,
        count: mockProjectExpenseCount,
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      fundSource: {
        findUnique: mockFundSourceFindUnique,
        update: mockFundSourceUpdate,
      },
      fundTransaction: {
        create: mockFundTransactionCreate,
      },
      customer: {
        findUnique: mockCustomerFindUnique,
      },
      auditLog: { create: mockAuditLogCreate },
      role: {
        findFirst: mockRoleFindFirst,
      },
      rolePermission: {
        findUnique: mockRolePermissionFindUnique,
      },
    };
    (prisma as any).$transaction.mockImplementation((fn: any) => fn(mockDb));
    // Default: role-1 resolves to Platform Owner, bypassing the "projects"
    // matrix entirely — this suite proves tenant-scoping business logic, not
    // matrix grant/deny behavior (see project-matrix.test.ts for that coverage).
    mockRoleFindFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "tenant-A",
      name: "Platform Owner",
    });
  });

  // ── 1. project.list scope ──────────────────────────────────────────────────
  it("project.list only queries projects scoped to ctx.tenantId", async () => {
    mockProjectFindMany.mockResolvedValueOnce([PROJECT_A]);
    mockProjectCount.mockResolvedValueOnce(1);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.project.list({});

    expect(mockProjectFindMany).toHaveBeenCalledOnce();
    const callArg = mockProjectFindMany.mock.calls[0]![0];
    expect(callArg.where.tenantId).toBe("tenant-A");
    expect(result.items).toHaveLength(1);
  });

  // ── 2. project.byId IDOR guard ────────────────────────────────────────────
  it("project.byId throws NOT_FOUND when project belongs to a different tenant", async () => {
    mockProjectFindUnique.mockResolvedValueOnce({ ...PROJECT_A, tenantId: "tenant-B" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.project.byId({ id: PROJECT_A.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Project not found" });
  });

  // ── 3. project.create injects tenantId + audit log ────────────────────────
  it("project.create injects tenantId from ctx into db.project.create", async () => {
    mockProjectCreate.mockResolvedValueOnce(PROJECT_A);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.project.create({ name: "Alpha Project" });

    expect(mockProjectCreate).toHaveBeenCalledOnce();
    const callArg = mockProjectCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });

  it("project.create writes an audit log row with action CREATE and entity Project", async () => {
    mockProjectCreate.mockResolvedValueOnce(PROJECT_A);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.project.create({ name: "Alpha Project" });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", entity: "Project" }),
      }),
    );
  });

  // ── 4. project.update IDOR guard ──────────────────────────────────────────
  it("project.update throws NOT_FOUND when project belongs to a different tenant", async () => {
    mockProjectFindUnique.mockResolvedValueOnce({ ...PROJECT_A, tenantId: "tenant-B" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.project.update({ id: PROJECT_A.id, name: "New name" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Project not found" });
  });

  // ── 5. project.update writes audit log ────────────────────────────────────
  it("project.update writes audit log with action UPDATE", async () => {
    mockProjectFindUnique.mockResolvedValueOnce(PROJECT_A);
    const updated = { ...PROJECT_A, name: "Updated Name" };
    mockProjectUpdate.mockResolvedValueOnce(updated);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.project.update({ id: PROJECT_A.id, name: "Updated Name" });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "UPDATE", entity: "Project" }),
      }),
    );
  });

  // ── 6. project.archive IDOR guard ─────────────────────────────────────────
  it("project.archive throws NOT_FOUND when project belongs to a different tenant", async () => {
    mockProjectFindUnique.mockResolvedValueOnce({ ...PROJECT_A, tenantId: "tenant-B" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.project.archive({ id: PROJECT_A.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Project not found" });
  });

  // ── 7. project.archive writes audit log ───────────────────────────────────
  it("project.archive writes audit log with action UPDATE (status → cancelled)", async () => {
    mockProjectFindUnique.mockResolvedValueOnce(PROJECT_A);
    mockProjectExpenseCount.mockResolvedValueOnce(0);
    mockProjectUpdate.mockResolvedValueOnce({ ...PROJECT_A, status: "cancelled" });

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.project.archive({ id: PROJECT_A.id });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE",
          entity: "Project",
        }),
      }),
    );
  });

  // ── 8. milestone.create injects tenantId + audit log ──────────────────────
  it("milestone.create injects tenantId from ctx and writes audit log", async () => {
    mockProjectFindUnique.mockResolvedValueOnce(PROJECT_A);
    mockMilestoneCreate.mockResolvedValueOnce(MILESTONE_A);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.project.milestone.create({
      projectId: PROJECT_A.id,
      name: "Phase 1 Kickoff",
    });

    expect(mockMilestoneCreate).toHaveBeenCalledOnce();
    const callArg = mockMilestoneCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", entity: "Milestone" }),
      }),
    );
  });

  // ── 9. milestone.delete IDOR guard ────────────────────────────────────────
  it("milestone.delete throws NOT_FOUND when milestone belongs to a different tenant project", async () => {
    // Milestone exists but its project belongs to tenant-B
    mockMilestoneFindUnique.mockResolvedValueOnce(MILESTONE_A);
    mockProjectFindUnique.mockResolvedValueOnce({ ...PROJECT_A, tenantId: "tenant-B" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.project.milestone.delete({ milestoneId: MILESTONE_A.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Project not found" });
  });

  // ── 10. milestone.complete guard ──────────────────────────────────────────
  it("milestone.complete throws BAD_REQUEST when milestone already completed", async () => {
    const completedMilestone = { ...MILESTONE_A, completedAt: new Date() };
    mockMilestoneFindUnique.mockResolvedValueOnce(completedMilestone);
    mockProjectFindUnique.mockResolvedValueOnce(PROJECT_A);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.project.milestone.complete({ milestoneId: MILESTONE_A.id }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Milestone already completed.",
    });
  });

  // ── 11. expense.recordProjectExpense IDOR guard ───────────────────────────
  it("expense.recordProjectExpense throws NOT_FOUND for cross-tenant project", async () => {
    mockProjectFindUnique.mockResolvedValueOnce({ ...PROJECT_A, tenantId: "tenant-B" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.project.expense.recordProjectExpense({
        projectId: PROJECT_A.id,
        amount: 1000,
        type: "direct",
        description: "Test expense",
        fundSourceId: FUND_SOURCE_A.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Project not found" });
  });

  // ── 11b. expense.recordProjectExpense fund-source IDOR guard ─────────────
  it("expense.recordProjectExpense throws NOT_FOUND when fundSourceId belongs to a different tenant", async () => {
    mockProjectFindUnique.mockResolvedValueOnce(PROJECT_A);
    mockFundSourceFindUnique.mockResolvedValueOnce({ ...FUND_SOURCE_A, tenantId: "tenant-B" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.project.expense.recordProjectExpense({
        projectId: PROJECT_A.id,
        amount: 1000,
        type: "direct",
        description: "Test expense",
        fundSourceId: FUND_SOURCE_A.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Fund source not found." });

    expect(mockFundSourceUpdate).not.toHaveBeenCalled();
    expect(mockFundTransactionCreate).not.toHaveBeenCalled();
  });

  // ── 12. demo tenant guard ─────────────────────────────────────────────────
  it("project.create throws FORBIDDEN on demo tenant", async () => {
    const caller = createCaller(ctxForTenant("tenant-A", true /* isDemoTenant */));

    await expect(
      caller.project.create({ name: "Demo project" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("project.milestone.create throws FORBIDDEN on demo tenant", async () => {
    const caller = createCaller(ctxForTenant("tenant-A", true /* isDemoTenant */));

    await expect(
      caller.project.milestone.create({ projectId: PROJECT_A.id, name: "Demo milestone" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
