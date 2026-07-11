/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, createCallerFactory, writeProcedure } from "@/server/trpc/trpc";
import { matrixProcedure, matrixMiddleware } from "@/server/trpc/middleware/matrix";
import type * as OrqafyDb from "@orqafy/db";

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    auth: { check: vi.fn() },
    upload: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

// Keep the real `hasPermission` resolver (it takes prisma as an argument) —
// only mock the prisma client calls it makes.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      role: { findFirst: vi.fn() },
      rolePermission: { findUnique: vi.fn() },
    },
  };
});

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  role: { findFirst: any };
  rolePermission: { findUnique: any };
};

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {
    headers: { get: (_h: string): string | null => null },
  } as unknown as NextRequest;
}

function ctx(roleId: string | null = "role-1", isDemoTenant = false) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Custom Role"],
    roleId,
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant,
    session: null,
  };
}

// Mini router mirroring payroll.ts's "payroll" feature wiring: a view
// (matrixProcedure) and a create (writeProcedure + matrixMiddleware) endpoint.
const testRouter = createTRPCRouter({
  payrollView: matrixProcedure("payroll", "view").query(() => "ok" as const),
  payrollCreate: writeProcedure.use(matrixMiddleware("payroll", "create")).mutation(() => "created" as const),
});
const createCaller = createCallerFactory(testRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("payroll router — matrix migration", () => {
  it("allows a role WITH the matrix grant for the requested feature+action", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Custom Role",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue({
      view: true,
      create: false,
      update: false,
      delete: false,
    });

    const caller = createCaller(ctx());
    await expect(caller.payrollView()).resolves.toBe("ok");
  });

  it("denies a role WITHOUT the matrix grant (deny-by-default)", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Custom Role",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx());
    await expect(caller.payrollView()).rejects.toThrow(TRPCError);
    await expect(caller.payrollView()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bypasses the matrix entirely for Platform Owner", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Platform Owner",
    });

    const caller = createCaller(ctx());
    await expect(caller.payrollView()).resolves.toBe("ok");
    expect(mockDb.rolePermission.findUnique).not.toHaveBeenCalled();
  });

  it("bypasses the matrix entirely for Tenant Super Admin", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Tenant Super Admin",
    });

    const caller = createCaller(ctx());
    await expect(caller.payrollView()).resolves.toBe("ok");
    expect(mockDb.rolePermission.findUnique).not.toHaveBeenCalled();
  });

  it("mutation endpoint composed via writeProcedure.use(matrixMiddleware) allows a granted role", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Custom Role",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue({
      view: false,
      create: true,
      update: false,
      delete: false,
    });

    const caller = createCaller(ctx());
    await expect(caller.payrollCreate()).resolves.toBe("created");
  });

  it("denies when ctx.roleId is missing without querying the matrix", async () => {
    const caller = createCaller(ctx(null));
    await expect(caller.payrollView()).rejects.toThrow(TRPCError);
    expect(mockDb.role.findFirst).not.toHaveBeenCalled();
  });
});
