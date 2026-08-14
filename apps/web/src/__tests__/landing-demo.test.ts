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

  // SEO infrastructure + public marketing surfaces must be crawler-reachable
  // without auth, else the auth middleware 307-redirects them to /login and
  // search engines can never read the robots directives / sitemap. (Rule 35)
  it("allows /robots.txt as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/robots.txt")).toBe(true);
  });

  it("allows /sitemap.xml as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/sitemap.xml")).toBe(true);
  });

  it("allows /privacy (public policy page, indexable) as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/privacy")).toBe(true);
  });

  // Guest storefront — /{tenantSlug}/store(/...) must be crawlable + usable
  // without auth (guest cart, guest checkout, guest order tracking). (Rule 35)
  it("allows /demo/store (root store landing) as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo/store")).toBe(true);
  });

  it("allows /demo/store/products as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo/store/products")).toBe(true);
  });

  it("allows /demo/store/products/abc123 as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo/store/products/abc123")).toBe(true);
  });

  it("allows /demo/store/checkout as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo/store/checkout")).toBe(true);
  });

  it("allows /demo/store/orders/track as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo/store/orders/track")).toBe(true);
  });

  it("does not allow /demo/dashboard as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo/dashboard")).toBe(false);
  });

  // Demo storefront static assets (public/demo/shopix/**) — the seeded Shopix
  // catalog photos are plain /demo/shopix/... URLs; without this the auth
  // middleware 307-walls every guest-visible product image to /login.
  it("allows /demo/shopix/product-card/image-01.webp as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo/shopix/product-card/image-01.webp")).toBe(true);
  });

  it("does not allow /store (no tenant slug) as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/store")).toBe(false);
  });

  it("does not allow /demo/storefront (must not loosely prefix-match store) as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo/storefront")).toBe(false);
  });

  it("does not allow /demo/store-x/anything as a public path", async () => {
    const { isPublic } = await import("@/lib/public-paths");
    expect(isPublic("/demo/store-x/anything")).toBe(false);
  });
});
