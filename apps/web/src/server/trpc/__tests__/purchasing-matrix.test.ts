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

// Mini router mirroring purchasing.ts's "purchasing" feature wiring: a view
// (matrixProcedure), a create, an update, and a delete-tier (approve/reactivate)
// endpoint — all composed via writeProcedure + matrixMiddleware.
const testRouter = createTRPCRouter({
  purchasingView: matrixProcedure("purchasing", "view").query(() => "ok" as const),
  purchasingCreate: writeProcedure.use(matrixMiddleware("purchasing", "create")).mutation(() => "created" as const),
  purchasingUpdate: writeProcedure.use(matrixMiddleware("purchasing", "update")).mutation(() => "updated" as const),
  // Stand-in for po.approve / vendor.reactivate — both gated on the "delete" tier.
  purchasingApprove: writeProcedure.use(matrixMiddleware("purchasing", "delete")).mutation(() => "approved" as const),
});
const createCaller = createCallerFactory(testRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("purchasing router — matrix migration", () => {
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
    await expect(caller.purchasingView()).resolves.toBe("ok");
  });

  it("denies a role WITHOUT the matrix grant (deny-by-default)", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Custom Role",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx());
    await expect(caller.purchasingView()).rejects.toThrow(TRPCError);
    await expect(caller.purchasingView()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bypasses the matrix entirely for Platform Owner", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Platform Owner",
    });

    const caller = createCaller(ctx());
    await expect(caller.purchasingView()).resolves.toBe("ok");
    expect(mockDb.rolePermission.findUnique).not.toHaveBeenCalled();
  });

  it("bypasses the matrix entirely for Tenant Super Admin", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Tenant Super Admin",
    });

    const caller = createCaller(ctx());
    await expect(caller.purchasingView()).resolves.toBe("ok");
    expect(mockDb.rolePermission.findUnique).not.toHaveBeenCalled();
  });

  it("create endpoint composed via writeProcedure.use(matrixMiddleware) allows a granted role", async () => {
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
    await expect(caller.purchasingCreate()).resolves.toBe("created");
  });

  it("update endpoint composed via writeProcedure.use(matrixMiddleware) allows a granted role", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Custom Role",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue({
      view: false,
      create: false,
      update: true,
      delete: false,
    });

    const caller = createCaller(ctx());
    await expect(caller.purchasingUpdate()).resolves.toBe("updated");
  });

  it("denies po.approve / vendor.reactivate (delete-tier) for a non-bypass role WITHOUT purchasing delete", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Custom Role",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue({
      view: true,
      create: true,
      update: true,
      delete: false,
    });

    const caller = createCaller(ctx());
    await expect(caller.purchasingApprove()).rejects.toThrow(TRPCError);
    await expect(caller.purchasingApprove()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows po.approve / vendor.reactivate (delete-tier) for a non-bypass role WITH purchasing delete", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Custom Role",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue({
      view: true,
      create: true,
      update: true,
      delete: true,
    });

    const caller = createCaller(ctx());
    await expect(caller.purchasingApprove()).resolves.toBe("approved");
  });

  it("denies when ctx.roleId is missing without querying the matrix", async () => {
    const caller = createCaller(ctx(null));
    await expect(caller.purchasingView()).rejects.toThrow(TRPCError);
    expect(mockDb.role.findFirst).not.toHaveBeenCalled();
  });
});
