/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { matrixProcedure } from "@/server/trpc/middleware/matrix";
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

// Mini router mirroring report.ts's "reports" feature wiring — the router is
// read-only, so every endpoint maps to matrixProcedure("reports", "view").
const testRouter = createTRPCRouter({
  reportsView: matrixProcedure("reports", "view").query(() => "ok" as const),
});
const createCaller = createCallerFactory(testRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("report router — matrix migration", () => {
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
    await expect(caller.reportsView()).resolves.toBe("ok");
  });

  it("denies a role WITHOUT the matrix grant (deny-by-default)", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Custom Role",
    });
    mockDb.rolePermission.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx());
    await expect(caller.reportsView()).rejects.toThrow(TRPCError);
    await expect(caller.reportsView()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bypasses the matrix entirely for Platform Owner", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Platform Owner",
    });

    const caller = createCaller(ctx());
    await expect(caller.reportsView()).resolves.toBe("ok");
    expect(mockDb.rolePermission.findUnique).not.toHaveBeenCalled();
  });

  it("bypasses the matrix entirely for Tenant Super Admin", async () => {
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Tenant Super Admin",
    });

    const caller = createCaller(ctx());
    await expect(caller.reportsView()).resolves.toBe("ok");
    expect(mockDb.rolePermission.findUnique).not.toHaveBeenCalled();
  });

  it("denies when ctx.roleId is missing without querying the matrix", async () => {
    const caller = createCaller(ctx(null));
    await expect(caller.reportsView()).rejects.toThrow(TRPCError);
    expect(mockDb.role.findFirst).not.toHaveBeenCalled();
  });
});
