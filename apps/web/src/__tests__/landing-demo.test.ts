/**
 * Phase 8 Batch 1 Item 3: Landing page + demo entry system
 *
 * Covers:
 *  1. plan.listActive — public endpoint returning active plans sorted by sortOrder
 *  2. Middleware — "/" and "/demo-login" are public (no auth redirect)
 *  3. Demo mutation blocking — writeProcedure rejects isDemoTenant
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Modules under test
// ---------------------------------------------------------------------------
import { planRouter } from "@/server/trpc/routers/plan";
import { createTRPCRouter, createCallerFactory, writeProcedure } from "@/server/trpc/trpc";

// ---------------------------------------------------------------------------
// Mock heavy dependencies
// ---------------------------------------------------------------------------
vi.mock("@orqafy/db", () => ({
  prisma: {
    plan: {
      findMany: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Context factory helpers
// ---------------------------------------------------------------------------
import type { NextRequest } from "next/server";

function makeReq(): NextRequest {
  return {} as NextRequest;
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

function demoTenantCtx() {
  return {
    req: makeReq(),
    userId: "demo-user-1",
    roles: ["Administrator"],
    tenantSlug: "demo",
    tenantId: "demo-tenant-id",
    securityVersion: 1,
    isDemoTenant: true,
    session: null,
  };
}

function regularUserCtx() {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"],
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

// ---------------------------------------------------------------------------
// 1. plan.listActive — public endpoint
// ---------------------------------------------------------------------------
describe("plan.listActive", () => {
  const router = createTRPCRouter({ plan: planRouter });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active plans sorted by sortOrder", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.plan.findMany).mockResolvedValue([
      { id: "p1", slug: "free", name: "Free", priceMonthly: 0, priceYearly: 0, maxUsers: 3, features: ["Basic"], sortOrder: 0, isActive: true },
      { id: "p2", slug: "starter", name: "Starter", priceMonthly: 1499, priceYearly: 14990, maxUsers: 10, features: ["All Free features"], sortOrder: 1, isActive: true },
    ] as never);

    const caller = createCallerFactory(router)(unauthenticatedCtx());
    const result = await caller.plan.listActive();

    expect(result.plans).toHaveLength(2);
    expect(result.plans[0]?.slug).toBe("free");
    expect(result.plans[1]?.slug).toBe("starter");
    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
    );
  });

  it("is accessible without authentication", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.plan.findMany).mockResolvedValue([]);

    const caller = createCallerFactory(router)(unauthenticatedCtx());
    const result = await caller.plan.listActive();

    expect(result.plans).toEqual([]);
  });

  it("returns empty array when no active plans exist", async () => {
    const { prisma } = await import("@orqafy/db");
    vi.mocked(prisma.plan.findMany).mockResolvedValue([]);

    const caller = createCallerFactory(router)(unauthenticatedCtx());
    const result = await caller.plan.listActive();

    expect(result.plans).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Demo tenant mutation blocking (writeProcedure)
// ---------------------------------------------------------------------------
describe("writeProcedure demo blocking", () => {
  it("blocks mutations on demo tenant with FORBIDDEN", async () => {
    const router = createTRPCRouter({
      testMutate: writeProcedure.mutation(() => "mutated"),
    });
    const caller = createCallerFactory(router)(demoTenantCtx());
    await expect(caller.testMutate()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows mutations on regular tenant", async () => {
    const router = createTRPCRouter({
      testMutate: writeProcedure.mutation(() => "mutated"),
    });
    const caller = createCallerFactory(router)(regularUserCtx());
    await expect(caller.testMutate()).resolves.toBe("mutated");
  });
});

// ---------------------------------------------------------------------------
// 3. Middleware public paths (unit-level check on the isPublic helper)
// ---------------------------------------------------------------------------
describe("middleware public paths", () => {
  it("allows / as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/")).toBe(true);
  });

  it("allows /demo-login as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo-login")).toBe(true);
  });

  it("does not allow /dashboard as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/dashboard")).toBe(false);
  });
});
