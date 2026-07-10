/**
 * Wave B step 2 (tenant-rbac-3tier): two-way succession — tRPC wiring
 *
 * Covers:
 *  1. platform.reassignTenantOwner — Platform Owner only; delegates to reassignTenantOwner helper
 *  2. user.transferOwnership — current tenant owner only; delegates to transferTenantOwnership helper
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { platformRouter } from "@/server/trpc/routers/platform";
import { userRouter } from "@/server/trpc/routers/user";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

// ---------------------------------------------------------------------------
// Mock @orqafy/db — cover everything platform.ts / user.ts touch
// ---------------------------------------------------------------------------
vi.mock("@orqafy/db", () => ({
  prisma: {
    tenant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    tenantAuditLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
  reassignTenantOwner: vi.fn(),
  transferTenantOwnership: vi.fn(),
}));

import type { NextRequest } from "next/server";

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function platformOwnerCtx() {
  return {
    req: makeReq(),
    userId: "platform-user-1",
    roles: ["Platform Owner"],
    tenantSlug: "platform",
    tenantId: "platform-tenant-id",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

function regularUserCtx() {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Admin"],
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
    roles: [],
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. platform.reassignTenantOwner
// ---------------------------------------------------------------------------
describe("platform.reassignTenantOwner", () => {
  const router = createTRPCRouter({ platform: platformRouter });

  it("rejects a non-platform-owner session", async () => {
    const caller = createCallerFactory(router)(regularUserCtx());
    await expect(
      caller.platform.reassignTenantOwner({
        tenantId: "t1",
        newOwnerUserId: "u2",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an unauthenticated session", async () => {
    const caller = createCallerFactory(router)(unauthenticatedCtx());
    await expect(
      caller.platform.reassignTenantOwner({
        tenantId: "t1",
        newOwnerUserId: "u2",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("invokes reassignTenantOwner helper and returns success for Platform Owner", async () => {
    const { reassignTenantOwner, prisma } = await import("@orqafy/db");
    vi.mocked(reassignTenantOwner).mockResolvedValue(undefined);
    vi.mocked(prisma.tenantAuditLog.create).mockResolvedValue({} as never);

    const caller = createCallerFactory(router)(platformOwnerCtx());
    const result = await caller.platform.reassignTenantOwner({
      tenantId: "t1",
      newOwnerUserId: "u2",
    });

    expect(result.success).toBe(true);
    expect(reassignTenantOwner).toHaveBeenCalledTimes(1);
    expect(reassignTenantOwner).toHaveBeenCalledWith(
      prisma,
      { tenantId: "t1", newOwnerUserId: "u2" },
    );
    expect(prisma.tenantAuditLog.create).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. user.transferOwnership
// ---------------------------------------------------------------------------
describe("user.transferOwnership", () => {
  const router = createTRPCRouter({ user: userRouter });

  it("rejects when the caller is not the current tenant owner", async () => {
    const { prisma, transferTenantOwnership } = await import("@orqafy/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      isTenantOwner: false,
    } as never);

    const caller = createCallerFactory(router)(regularUserCtx());
    await expect(caller.user.transferOwnership({ toUserId: "u3" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(transferTenantOwnership).not.toHaveBeenCalled();
  });

  it("invokes transferTenantOwnership helper and returns success when caller is owner", async () => {
    const { prisma, transferTenantOwnership } = await import("@orqafy/db");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      isTenantOwner: true,
    } as never);
    vi.mocked(transferTenantOwnership).mockResolvedValue(undefined);

    const ctx = regularUserCtx();
    const caller = createCallerFactory(router)(ctx);
    const result = await caller.user.transferOwnership({ toUserId: "u3" });

    expect(result.success).toBe(true);
    expect(transferTenantOwnership).toHaveBeenCalledTimes(1);
    expect(transferTenantOwnership).toHaveBeenCalledWith(prisma, {
      tenantId: ctx.tenantId,
      fromUserId: ctx.userId,
      toUserId: "u3",
    });
  });
});
