/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime closure — Department tenant parity
 *
 * Proves:
 *  1. department.update throws NOT_FOUND when dept belongs to tenant-B but ctx is tenant-A
 *  2. department.delete throws NOT_FOUND when dept belongs to tenant-B but ctx is tenant-A
 *  3. department.create injects tenantId from ctx into db.department.create data
 *  4. department.delete throws PRECONDITION_FAILED when dept has assigned members
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const { mockDeptFindUnique, mockDeptCreate, mockDeptUpdate, mockDeptDelete } = vi.hoisted(() => ({
  mockDeptFindUnique: vi.fn(),
  mockDeptCreate: vi.fn(),
  mockDeptUpdate: vi.fn(),
  mockDeptDelete: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    department: {
      findUnique: mockDeptFindUnique,
      findMany: vi.fn().mockResolvedValue([]),
      create: mockDeptCreate,
      update: mockDeptUpdate,
      delete: mockDeptDelete,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { departmentRouter } from "@/server/trpc/routers/department";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ department: departmentRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(tenantId: string, roles: string[] = ["Tenant Super Admin"]) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Department tenant parity (K-prime closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("department.update throws NOT_FOUND when dept belongs to tenant-B but ctx is tenant-A", async () => {
    mockDeptFindUnique.mockResolvedValueOnce({
      id: "clh3dept0000hxog4d8e5f9a",
      tenantId: "tenant-B",
      name: "HR",
      code: "HR",
      isActive: true,
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.department.update({ id: "clh3dept0000hxog4d8e5f9a", name: "Human Resources" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Department not found." });
  });

  it("department.delete throws NOT_FOUND when dept belongs to tenant-B but ctx is tenant-A", async () => {
    mockDeptFindUnique.mockResolvedValueOnce({
      id: "clh3dept0001hxog4d8e5f9b",
      tenantId: "tenant-B",
      name: "Finance",
      _count: { users: 0, employees: 0 },
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.department.delete({ id: "clh3dept0001hxog4d8e5f9b" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Department not found." });
  });

  it("department.create injects tenantId from ctx into db.department.create data", async () => {
    // No parent lookup needed (no parentId supplied), no code conflict (no existing code)
    mockDeptFindUnique.mockResolvedValueOnce(null); // code uniqueness check returns null = no conflict

    const created = {
      id: "clh3dept0002hxog4d8e5f9c",
      tenantId: "tenant-A",
      name: "Engineering",
      code: "ENG",
      description: null,
      parentId: null,
      isActive: true,
    };
    mockDeptCreate.mockResolvedValueOnce(created);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.department.create({ name: "Engineering", code: "ENG" });

    expect(mockDeptCreate).toHaveBeenCalledOnce();
    const callArg = mockDeptCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });

  // ── RBAC: tenant owner ("Tenant Super Admin") may manage departments (#9b) ──────

  it("department.create succeeds for the tenant owner role 'Tenant Super Admin'", async () => {
    // No code supplied → no uniqueness findUnique call.
    mockDeptCreate.mockResolvedValueOnce({
      id: "clh3dept0004hxog4d8e5f9e",
      tenantId: "tenant-A",
      name: "Marketing",
      code: null,
      description: null,
      parentId: null,
      isActive: true,
    });

    const caller = createCaller(ctxForTenant("tenant-A", ["Tenant Super Admin"]));
    await expect(caller.department.create({ name: "Marketing" })).resolves.toMatchObject({
      name: "Marketing",
    });
    expect(mockDeptCreate).toHaveBeenCalledOnce();
  });

  it("department.create succeeds for the tenant 'Admin' role", async () => {
    // No code supplied → no uniqueness findUnique call.
    mockDeptCreate.mockResolvedValueOnce({
      id: "clh3dept0005hxog4d8e5f9f",
      tenantId: "tenant-A",
      name: "Sales",
      code: null,
      description: null,
      parentId: null,
      isActive: true,
    });

    const caller = createCaller(ctxForTenant("tenant-A", ["Admin"]));
    await expect(caller.department.create({ name: "Sales" })).resolves.toMatchObject({
      name: "Sales",
    });
  });

  it("department.create is FORBIDDEN for an unauthorized role ('Staff')", async () => {
    const caller = createCaller(ctxForTenant("tenant-A", ["Staff"]));
    await expect(caller.department.create({ name: "Hacks" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You don't have permission to manage departments.",
    });
    expect(mockDeptCreate).not.toHaveBeenCalled();
  });

  it("department.delete throws PRECONDITION_FAILED when dept has assigned members", async () => {
    mockDeptFindUnique.mockResolvedValueOnce({
      id: "clh3dept0003hxog4d8e5f9d",
      tenantId: "tenant-A",
      name: "Operations",
      _count: { users: 3, employees: 2 },
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.department.delete({ id: "clh3dept0003hxog4d8e5f9d" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  // ── M7.2 — raw-FK-write IDOR closure (parentId re-validated on update) ──────

  it("department.update throws BAD_REQUEST when re-pointed parentId belongs to a different tenant (M7.2)", async () => {
    const deptId = "clh3dept0006hxog4d8e5f9g";
    const parentId = "clh3dept0007hxog4d8e5f9h";
    // First findUnique: the department being updated (tenant-A, ownership check).
    // Second findUnique: the parentId guard — belongs to tenant-B.
    mockDeptFindUnique
      .mockResolvedValueOnce({ id: deptId, tenantId: "tenant-A", name: "Engineering", code: "ENG" })
      .mockResolvedValueOnce({ id: parentId, tenantId: "tenant-B", name: "Other" });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.department.update({ id: deptId, parentId }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Parent department not found." });
    expect(mockDeptUpdate).not.toHaveBeenCalled();
  });
});
