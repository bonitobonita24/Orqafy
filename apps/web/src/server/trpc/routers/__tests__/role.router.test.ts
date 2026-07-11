/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Task 6.1 — role router (list/create/update/assign/myPermissions)
 *
 * Covers:
 *  1. non-superadmin (e.g. "Admin") is blocked from create/update/assign — FORBIDDEN
 *  2. create rejects a Billing/Users grant — FORBIDDEN_FEATURE -> FORBIDDEN
 *  3. create rejects a matrix that exceeds the Admin ceiling -> FORBIDDEN
 *  4. update rejects editing a fixed system role (Admin) -> FORBIDDEN
 *  5. assign rejects reassigning the sole tenant owner's role -> BAD_REQUEST
 *  6. create happy path writes the role + its permission rows
 *  7. myPermissions returns the caller's view set (bypass roles -> all features)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type * as OrqafyDb from "@orqafy/db";

const {
  mockRoleFindFirst,
  mockRoleFindUnique,
  mockRoleFindMany,
  mockRoleCreate,
  mockRolePermissionFindMany,
  mockRolePermissionCreateMany,
  mockRolePermissionUpsert,
  mockUserFindUnique,
  mockUserUpdate,
  mockAuditLogCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockRoleFindFirst: vi.fn(),
  mockRoleFindUnique: vi.fn(),
  mockRoleFindMany: vi.fn(),
  mockRoleCreate: vi.fn(),
  mockRolePermissionFindMany: vi.fn(),
  mockRolePermissionCreateMany: vi.fn(),
  mockRolePermissionUpsert: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  const prismaMock = {
    role: {
      findFirst: mockRoleFindFirst,
      findUnique: mockRoleFindUnique,
      findMany: mockRoleFindMany,
      create: mockRoleCreate,
    },
    rolePermission: {
      findMany: mockRolePermissionFindMany,
      createMany: mockRolePermissionCreateMany,
      upsert: mockRolePermissionUpsert,
    },
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
    $transaction: mockTransaction,
  };
  return {
    ...actual,
    prisma: prismaMock,
    writeAuditLog: actual.writeAuditLog,
  };
});

import { roleRouter } from "@/server/trpc/routers/role";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ role: roleRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctx(roles: string[], overrides: Partial<Record<string, unknown>> = {}) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    roleId: "role-caller",
    tenantSlug: "acme",
    tenantId: "tenant-A",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
    ...overrides,
  };
}

const FULL_ROW = (featureKey: "crm" | "billing" | "users") => ({
  featureKey,
  view: true,
  create: true,
  update: true,
  delete: true,
});

const NONE_ROW = (featureKey: "crm" | "billing" | "users") => ({
  featureKey,
  view: false,
  create: false,
  update: false,
  delete: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default $transaction: just invoke the callback with the same mocked "tx" shape.
  mockTransaction.mockImplementation((fn: any) =>
    fn({
      role: { create: mockRoleCreate },
      rolePermission: { createMany: mockRolePermissionCreateMany, upsert: mockRolePermissionUpsert },
      auditLog: { create: mockAuditLogCreate },
    }),
  );
});

describe("role router", () => {
  describe("authorization gate", () => {
    it("create is blocked for a non-superadmin role", async () => {
      const caller = createCaller(ctx(["Admin"]));
      await expect(
        caller.role.create({ name: "Custom Viewer", permissions: [NONE_ROW("crm")] }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("update is blocked for a non-superadmin role", async () => {
      const caller = createCaller(ctx(["Staff"]));
      await expect(
        caller.role.update({ roleId: "clrole00000000000000001", permissions: [] }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("assign is blocked for a non-superadmin role", async () => {
      const caller = createCaller(ctx(["Sales Staff"]));
      await expect(
        caller.role.assign({ userId: "clusr0000000000000000001", roleId: "clrole00000000000000001" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("guardrails", () => {
    it("create rejects a Billing grant with FORBIDDEN", async () => {
      const caller = createCaller(ctx(["Tenant Super Admin"]));
      await expect(
        caller.role.create({
          name: "Sneaky",
          permissions: [{ featureKey: "billing", view: true, create: false, update: false, delete: false }],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mockRoleCreate).not.toHaveBeenCalled();
    });

    it("create rejects a Users grant with FORBIDDEN", async () => {
      const caller = createCaller(ctx(["Tenant Super Admin"]));
      await expect(
        caller.role.create({
          name: "Sneaky2",
          permissions: [{ featureKey: "users", view: false, create: false, update: true, delete: false }],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("create rejects a matrix that exceeds the Admin ceiling", async () => {
      mockRoleFindFirst.mockResolvedValueOnce({ id: "clrole0admin00000000001", tenantId: "tenant-A", slug: "admin" });
      // Admin ceiling has crm.delete = false
      mockRolePermissionFindMany.mockResolvedValueOnce([
        { featureKey: "crm", view: true, create: true, update: true, delete: false },
      ]);

      const caller = createCaller(ctx(["Tenant Super Admin"]));
      await expect(
        caller.role.create({
          name: "Over ceiling",
          permissions: [{ featureKey: "crm", view: true, create: true, update: true, delete: true }],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mockRoleCreate).not.toHaveBeenCalled();
    });

    it("update rejects editing a fixed system role (Admin)", async () => {
      mockRoleFindUnique.mockResolvedValueOnce({
        id: "clrole0admin00000000001",
        tenantId: "tenant-A",
        name: "Admin",
        slug: "admin",
        isSystem: true,
      });

      const caller = createCaller(ctx(["Tenant Super Admin"]));
      await expect(
        caller.role.update({ roleId: "clrole0admin00000000001", permissions: [NONE_ROW("crm")] }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mockRolePermissionUpsert).not.toHaveBeenCalled();
    });

    it("assign rejects reassigning the sole tenant owner's role", async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: "clusr0owner000000000001",
        tenantId: "tenant-A",
        roleId: "clrole0superadmin0000001",
        isTenantOwner: true,
      });

      const caller = createCaller(ctx(["Tenant Super Admin"]));
      await expect(
        caller.role.assign({ userId: "clusr0owner000000000001", roleId: "clrole0custom000000001" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  describe("happy paths", () => {
    it("create writes the role + its permission rows and audits", async () => {
      mockRoleFindFirst.mockResolvedValueOnce({ id: "clrole0admin00000000001", tenantId: "tenant-A", slug: "admin" });
      mockRolePermissionFindMany.mockResolvedValueOnce([FULL_ROW("crm")]); // ceiling: crm fully open

      mockRoleCreate.mockResolvedValueOnce({
        id: "clrole0new0000000000001",
        tenantId: "tenant-A",
        name: "CRM Viewer",
        slug: "crm_viewer",
        isSystem: false,
      });

      const caller = createCaller(ctx(["Tenant Super Admin"]));
      const result = await caller.role.create({
        name: "CRM Viewer",
        permissions: [{ featureKey: "crm", view: true, create: false, update: false, delete: false }],
      });

      expect(result).toMatchObject({ id: "clrole0new0000000000001", name: "CRM Viewer" });
      expect(mockRoleCreate).toHaveBeenCalledOnce();
      expect(mockRolePermissionCreateMany).toHaveBeenCalledOnce();
      const rowsArg = mockRolePermissionCreateMany.mock.calls[0]![0];
      expect(rowsArg.data).toEqual([
        {
          tenantId: "tenant-A",
          roleId: "clrole0new0000000000001",
          featureKey: "crm",
          view: true,
          create: false,
          update: false,
          delete: false,
        },
      ]);
      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    });

    it("assign sets the target user's roleId, bumps securityVersion, and audits", async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: "clusr0regular000000001",
        tenantId: "tenant-A",
        roleId: "clrole0old00000000001",
        isTenantOwner: false,
      });
      mockRoleFindUnique.mockResolvedValueOnce({
        id: "clrole0custom000000001",
        tenantId: "tenant-A",
        name: "CRM Viewer",
        isSystem: false,
      });
      mockUserUpdate.mockResolvedValueOnce({ id: "clusr0regular000000001", roleId: "clrole0custom000000001" });

      const caller = createCaller(ctx(["Tenant Super Admin"]));
      const result = await caller.role.assign({
        userId: "clusr0regular000000001",
        roleId: "clrole0custom000000001",
      });

      expect(result).toEqual({ success: true });
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "clusr0regular000000001" },
        data: { roleId: "clrole0custom000000001", securityVersion: { increment: 1 } },
        select: { id: true, roleId: true },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
    });
  });

  describe("myPermissions", () => {
    it("returns every feature for Platform Owner (matrix bypass)", async () => {
      const caller = createCaller(ctx(["Platform Owner"]));
      const result = await caller.role.myPermissions();
      expect(result.view).toContain("crm");
      expect(result.view).toContain("billing");
      expect(mockRolePermissionFindMany).not.toHaveBeenCalled();
    });

    it("returns every feature for Tenant Super Admin (matrix bypass)", async () => {
      const caller = createCaller(ctx(["Tenant Super Admin"]));
      const result = await caller.role.myPermissions();
      expect(result.view).toContain("users");
    });

    it("resolves the caller's own view set from the matrix for a non-bypass role", async () => {
      mockRolePermissionFindMany.mockResolvedValueOnce([{ featureKey: "crm" }, { featureKey: "tasks" }]);

      const caller = createCaller(ctx(["Sales Staff"], { roleId: "clrole0sales00000000001" }));
      const result = await caller.role.myPermissions();

      expect(result.view).toEqual(["crm", "tasks"]);
      expect(mockRolePermissionFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-A", roleId: "clrole0sales00000000001", view: true },
        select: { featureKey: true },
      });
    });

    it("returns an empty view set when the caller has no roleId", async () => {
      const caller = createCaller(ctx(["Sales Staff"], { roleId: null }));
      const result = await caller.role.myPermissions();
      expect(result.view).toEqual([]);
    });
  });
});
