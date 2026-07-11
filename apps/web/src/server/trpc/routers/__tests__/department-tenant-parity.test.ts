/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime closure — Department tenant parity
 *
 * Proves:
 *  1. department.update throws NOT_FOUND when dept belongs to tenant-B but ctx is tenant-A
 *  2. department.delete throws NOT_FOUND when dept belongs to tenant-B but ctx is tenant-A
 *  3. department.create injects tenantId from ctx into db.department.create data
 *  4. department.delete throws PRECONDITION_FAILED when dept has assigned members
 *
 * RBAC note: department.create/update/delete are matrix-gated on the
 * "settings" feature (writeProcedure.use(matrixMiddleware("settings", <action>))).
 * "Tenant Super Admin" and "Platform Owner" bypass the matrix entirely; every
 * other role (including "Admin") is resolved from the `role_permissions`
 * matrix row for (tenantId, roleId, "settings"). Tests below mock
 * `prisma.role.findFirst` + `prisma.rolePermission.findUnique` alongside the
 * `prisma.department.*` mocks, following the pattern in
 * matrix-procedure.test.ts.
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
  mockDeptFindUnique,
  mockDeptCreate,
  mockDeptUpdate,
  mockDeptDelete,
  mockRoleFindFirst,
  mockRolePermissionFindUnique,
} = vi.hoisted(() => ({
  mockDeptFindUnique: vi.fn(),
  mockDeptCreate: vi.fn(),
  mockDeptUpdate: vi.fn(),
  mockDeptDelete: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRolePermissionFindUnique: vi.fn(),
}));

// Keep the real `hasPermission` resolver (it takes prisma as an argument) —
// only mock the prisma client calls it (and the department router) make.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      department: {
        findUnique: mockDeptFindUnique,
        findMany: vi.fn().mockResolvedValue([]),
        create: mockDeptCreate,
        update: mockDeptUpdate,
        delete: mockDeptDelete,
      },
      role: { findFirst: mockRoleFindFirst },
      rolePermission: { findUnique: mockRolePermissionFindUnique },
    },
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { departmentRouter } from "@/server/trpc/routers/department";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ department: departmentRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return { headers: { get: (_h: string): string | null => null } } as unknown as NextRequest;
}

function ctxForTenant(tenantId: string, roleId: string | null = "role-1") {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Tenant Super Admin"],
    roleId,
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

/** Wires `prisma.role.findFirst` to resolve a role by (roleId, tenantId, name). */
function mockRole(roleId: string, tenantId: string, name: string) {
  mockRoleFindFirst.mockImplementation(
    (args: { where: { id: string; tenantId: string } }) => {
      if (args.where.id === roleId && args.where.tenantId === tenantId) {
        return Promise.resolve({ id: roleId, tenantId, name });
      }
      return Promise.resolve(null);
    },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Department tenant parity (K-prime closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: acting role is the tenant owner, which bypasses the matrix
    // entirely — pure tenant-parity assertions don't need matrix wiring.
    mockRole("role-1", "tenant-A", "Tenant Super Admin");
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

  // ── RBAC: matrix-gated on the "settings" feature (#9b) ──────────────────────

  it("department.create succeeds for the tenant owner role 'Tenant Super Admin'", async () => {
    mockRole("role-1", "tenant-A", "Tenant Super Admin"); // bypass — matrix not consulted

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

    const caller = createCaller(ctxForTenant("tenant-A"));
    await expect(caller.department.create({ name: "Marketing" })).resolves.toMatchObject({
      name: "Marketing",
    });
    expect(mockDeptCreate).toHaveBeenCalledOnce();
    expect(mockRolePermissionFindUnique).not.toHaveBeenCalled();
  });

  it("department.create succeeds for the tenant 'Admin' role", async () => {
    mockRole("role-1", "tenant-A", "Admin"); // NOT a bypass role — resolved via matrix
    mockRolePermissionFindUnique.mockResolvedValueOnce({
      view: true,
      create: true,
      update: true,
      delete: true,
    });

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

    const caller = createCaller(ctxForTenant("tenant-A"));
    await expect(caller.department.create({ name: "Sales" })).resolves.toMatchObject({
      name: "Sales",
    });
  });

  it("department.create is FORBIDDEN for an unauthorized role ('Staff')", async () => {
    mockRole("role-1", "tenant-A", "Staff"); // NOT a bypass role
    mockRolePermissionFindUnique.mockResolvedValueOnce(null); // no matrix row → deny-by-default

    const caller = createCaller(ctxForTenant("tenant-A"));
    await expect(caller.department.create({ name: "Hacks" })).rejects.toMatchObject({
      code: "FORBIDDEN",
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
