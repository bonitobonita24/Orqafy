/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * template-alignment T2.3 — storefront.browsePublicProducts
 *
 * Proves the new public catalog-browse query (distinct from the staff-only,
 * matrixProcedure-gated `browseProducts`):
 *  1. resolves the tenant by slug and scopes every read to it
 *  2. always filters isActive:true + ecommerceVisible:true
 *  3. applies category/brand/search/onSale/price filters into the WHERE
 *  4. 404s on an unknown/inactive tenant without ever querying product
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockTenantFindUnique,
  mockProductFindMany,
  mockProductCount,
  mockWarehouseStockGroupBy,
} = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockProductFindMany: vi.fn(),
  mockProductCount: vi.fn(),
  mockWarehouseStockGroupBy: vi.fn(),
}));

import type * as OrqafyDb from "@orqafy/db";

vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      tenant: { findUnique: mockTenantFindUnique },
      product: { findMany: mockProductFindMany, count: mockProductCount },
      warehouseStock: { groupBy: mockWarehouseStockGroupBy },
    },
    writeAuditLog: vi.fn(),
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    public: { check: vi.fn() },
    public_invoice: { check: vi.fn() },
  },
}));

vi.mock("@/server/lib/sanitize", () => ({
  sanitizePlainText: (s: string) => s,
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/xendit-invoice", () => ({
  createXenditInvoiceForOrder: vi.fn(),
}));

import { storefrontRouter } from "@/server/trpc/routers/storefront";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ storefront: storefrontRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return { headers: { get: () => null } } as unknown as NextRequest;
}

function publicCaller() {
  return createCaller({
    req: makeReq(),
    userId: "user-1",
    roles: [] as string[],
    roleId: null,
    tenantSlug: "unused",
    tenantId: "unused",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  });
}

describe("storefront.browsePublicProducts (template-alignment T2.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWarehouseStockGroupBy.mockResolvedValue([]);
  });

  it("404s on an unknown/inactive tenant and never queries product", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(null);
    const caller = publicCaller();
    await expect(
      caller.storefront.browsePublicProducts({ tenantSlug: "ghost" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });

  it("scopes by resolved tenant id + isActive + ecommerceVisible, with no extra filters by default", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ id: "tenant-A", isActive: true });
    mockProductFindMany.mockResolvedValueOnce([]);
    mockProductCount.mockResolvedValueOnce(0);

    const caller = publicCaller();
    await caller.storefront.browsePublicProducts({ tenantSlug: "acme" });

    const findArg = mockProductFindMany.mock.calls[0]![0];
    expect(findArg.where).toMatchObject({
      tenantId: "tenant-A",
      isActive: true,
      ecommerceVisible: true,
    });
    expect(findArg.where.AND).toBeUndefined();
    expect(findArg.orderBy).toEqual([{ createdAt: "desc" }]);

    const countArg = mockProductCount.mock.calls[0]![0];
    expect(countArg.where).toMatchObject({ tenantId: "tenant-A" });
  });

  it("applies category/brand/search/onSale filters into WHERE.AND", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ id: "tenant-A", isActive: true });
    mockProductFindMany.mockResolvedValueOnce([]);
    mockProductCount.mockResolvedValueOnce(0);

    const caller = publicCaller();
    await caller.storefront.browsePublicProducts({
      tenantSlug: "acme",
      categorySlug: "widgets",
      brandId: "clbrandxxxxxxxxxxxxxxx1",
      search: "gadget",
      onSale: true,
      sort: "price_asc",
    });

    const findArg = mockProductFindMany.mock.calls[0]![0];
    const and = findArg.where.AND as Record<string, unknown>[];
    expect(and).toEqual(
      expect.arrayContaining([
        { category: { slug: "widgets" } },
        { brandId: "clbrandxxxxxxxxxxxxxxx1" },
        { compareAtPrice: { not: null } },
      ]),
    );
    expect(findArg.orderBy).toEqual([{ tier1Price: "asc" }, { baseCost: "asc" }]);
  });

  it("defaults pagination to skip 0 / take 24", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ id: "tenant-A", isActive: true });
    mockProductFindMany.mockResolvedValueOnce([]);
    mockProductCount.mockResolvedValueOnce(0);

    const caller = publicCaller();
    await caller.storefront.browsePublicProducts({ tenantSlug: "acme" });

    const findArg = mockProductFindMany.mock.calls[0]![0];
    expect(findArg.skip).toBe(0);
    expect(findArg.take).toBe(24);
  });
});
