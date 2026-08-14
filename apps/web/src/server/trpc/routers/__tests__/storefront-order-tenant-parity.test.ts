/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime Extended Phase 2: Storefront EcommerceOrder tenant parity (IDOR guards)
 *
 * Proves:
 *  1. storefront.getOrderById throws NOT_FOUND when order belongs to tenant-B but ctx is tenant-A
 *  2. storefront.listMyOrders throws NOT_FOUND when customerId belongs to tenant-B but ctx is tenant-A
 *  3. storefront.listAllOrders scopes findMany by ctx.tenantId
 *  4. storefront.updateFulfillment throws NOT_FOUND when order belongs to tenant-B but ctx is tenant-A
 *  5. storefront.updateOrderStatus throws NOT_FOUND when order belongs to tenant-B but ctx is tenant-A
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockOrderFindUnique,
  mockOrderFindFirst,
  mockOrderFindMany,
  mockOrderCount,
  mockOrderUpdate,
  mockCustomerFindFirst,
  mockRoleFindFirst,
  mockRolePermissionFindUnique,
  mockTenantFindUnique,
  mockBrandFindMany,
  mockMerchContentFindMany,
  mockProductFindFirst,
  mockProductFindMany,
  mockWarehouseStockGroupBy,
} = vi.hoisted(() => ({
  mockOrderFindUnique: vi.fn(),
  mockOrderFindFirst: vi.fn(),
  mockOrderFindMany: vi.fn(),
  mockOrderCount: vi.fn(),
  mockOrderUpdate: vi.fn(),
  mockCustomerFindFirst: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRolePermissionFindUnique: vi.fn(),
  mockTenantFindUnique: vi.fn(),
  mockBrandFindMany: vi.fn(),
  mockMerchContentFindMany: vi.fn(),
  mockProductFindFirst: vi.fn(),
  mockProductFindMany: vi.fn(),
  mockWarehouseStockGroupBy: vi.fn(),
}));

import type * as OrqafyDb from "@orqafy/db";

// Keep the real `hasPermission` resolver (tenant-rbac-standard.md §4 — the
// storefront router's procedures now run through matrixMiddleware, which
// calls hasPermission -> prisma.role.findFirst + prisma.rolePermission
// .findUnique). Only the prisma client + writeAuditLog are mocked.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      ecommerceOrder: {
        findUnique: mockOrderFindUnique,
        findFirst: mockOrderFindFirst,
        findMany: mockOrderFindMany,
        count: mockOrderCount,
        update: mockOrderUpdate,
      },
      customer: {
        findFirst: mockCustomerFindFirst,
        findUnique: vi.fn(),
      },
      tenant: { findUnique: mockTenantFindUnique },
      warehouse: { findFirst: vi.fn() },
      warehouseStock: {
        findMany: vi.fn(),
        update: vi.fn(),
        groupBy: mockWarehouseStockGroupBy,
      },
      product: {
        findMany: mockProductFindMany,
        findFirst: mockProductFindFirst,
        findUnique: vi.fn(),
      },
      brand: { findMany: mockBrandFindMany },
      merchContent: { findMany: mockMerchContentFindMany },
      stockMovement: { findMany: vi.fn(), create: vi.fn() },
      // RBAC matrix resolver mocks (tenant-rbac-standard.md §4). Defaulted
      // to a Platform Owner bypass in the top-level beforeEach so these
      // tenant-parity/IDOR assertions stay unaffected by the RBAC layer.
      role: { findFirst: mockRoleFindFirst },
      rolePermission: { findUnique: mockRolePermissionFindUnique },
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

function ctxForTenant(tenantId: string) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    roleId: "role-a",
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const ORDER_CUID = "clorderxxxxxxxxxxxxxxxx";
const CUSTOMER_CUID = "clcustomerxxxxxxxxxxx0";

describe("Storefront EcommerceOrder tenant parity (K-prime Extended Phase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // RBAC matrix bypass (tenant-rbac-standard.md §4) — Platform Owner
    // short-circuits hasPermission entirely so the IDOR/tenant-parity
    // assertions below stay the sole focus.
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: "tenant-A", name: "Platform Owner" });
  });

  it("getOrderById throws NOT_FOUND when order belongs to a different tenant", async () => {
    // findFirst with { id, tenantId } returns null because tenantId in WHERE doesn't match
    mockOrderFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.storefront.getOrderById({ id: ORDER_CUID }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Order not found",
    });

    // Verify the WHERE clause was scoped by tenantId
    expect(mockOrderFindFirst).toHaveBeenCalledOnce();
    const callArg = mockOrderFindFirst.mock.calls[0]![0];
    expect(callArg.where).toMatchObject({ id: ORDER_CUID, tenantId: "tenant-A" });
  });

  it("listMyOrders throws NOT_FOUND when customer belongs to a different tenant", async () => {
    // customer.findFirst scoped by tenantId returns null because customer is in tenant-B
    mockCustomerFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.storefront.listMyOrders({ customerId: CUSTOMER_CUID }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Customer not found",
    });

    expect(mockCustomerFindFirst).toHaveBeenCalledOnce();
    const callArg = mockCustomerFindFirst.mock.calls[0]![0];
    expect(callArg.where).toMatchObject({ id: CUSTOMER_CUID, tenantId: "tenant-A" });
  });

  it("listAllOrders scopes findMany + count by ctx.tenantId", async () => {
    mockCustomerFindFirst.mockResolvedValue({ id: CUSTOMER_CUID });
    mockOrderFindMany.mockResolvedValueOnce([]);
    mockOrderCount.mockResolvedValueOnce(0);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.storefront.listAllOrders({});

    expect(mockOrderFindMany).toHaveBeenCalledOnce();
    const findArg = mockOrderFindMany.mock.calls[0]![0];
    expect(findArg.where).toMatchObject({ tenantId: "tenant-A" });

    expect(mockOrderCount).toHaveBeenCalledOnce();
    const countArg = mockOrderCount.mock.calls[0]![0];
    expect(countArg.where).toMatchObject({ tenantId: "tenant-A" });
  });

  it("updateFulfillment throws NOT_FOUND when order belongs to a different tenant", async () => {
    // loadOrderForTenant: findUnique returns tenant-B order → guard fires
    mockOrderFindUnique.mockResolvedValueOnce({
      id: ORDER_CUID,
      tenantId: "tenant-B",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.storefront.updateFulfillment({
        id: ORDER_CUID,
        trackingNumber: "TRK-1",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Order not found",
    });

    // Update must NOT have been called
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("updateOrderStatus throws NOT_FOUND when order belongs to a different tenant", async () => {
    mockOrderFindUnique.mockResolvedValueOnce({
      id: ORDER_CUID,
      tenantId: "tenant-B",
      status: "pending",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.storefront.updateOrderStatus({
        id: ORDER_CUID,
        status: "confirmed",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Order not found",
    });

    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });
});

describe("Storefront public catalog reads (T2.1) — tenant-scoped + ecommerceVisible-only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWarehouseStockGroupBy.mockResolvedValue([]);
  });

  function publicCaller() {
    // publicProcedure ignores tenantId/roleId — the new queries resolve the
    // tenant from input.tenantSlug instead, same as placeOrderAsCustomer.
    return createCaller(ctxForTenant("unused"));
  }

  it("listBrands 404s on an unknown/inactive tenant and never queries brand", async () => {
    mockTenantFindUnique.mockResolvedValueOnce(null);
    const caller = publicCaller();
    await expect(
      caller.storefront.listBrands({ tenantSlug: "ghost" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockBrandFindMany).not.toHaveBeenCalled();
  });

  it("listBrands scopes by the resolved tenant id, not any ctx value", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ id: "tenant-A", isActive: true });
    mockBrandFindMany.mockResolvedValueOnce([]);
    const caller = publicCaller();
    await caller.storefront.listBrands({ tenantSlug: "acme" });
    expect(mockTenantFindUnique).toHaveBeenCalledWith({ where: { slug: "acme" } });
    const arg = mockBrandFindMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ tenantId: "tenant-A", isActive: true });
  });

  it("listMerchContent scopes by tenant id and optional kind filter", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ id: "tenant-A", isActive: true });
    mockMerchContentFindMany.mockResolvedValueOnce([]);
    const caller = publicCaller();
    await caller.storefront.listMerchContent({ tenantSlug: "acme", kind: "hero" });
    const arg = mockMerchContentFindMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ tenantId: "tenant-A", isActive: true, kind: "hero" });
  });

  const rawProduct = {
    id: "prod-1",
    tenantId: "tenant-A",
    name: "Widget",
    baseCost: { toString: () => "100" } as unknown as number,
    tier1Price: null,
    compareAtPrice: { toString: () => "150" } as unknown as number,
    isFeatured: true,
    ecommerceSlug: "widget",
    ecommerceVisible: true,
    isActive: true,
    brand: null,
    category: null,
  };

  it("getProductBySlug scopes by tenantId + ecommerceVisible:true and derives discountPercent", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ id: "tenant-A", isActive: true });
    mockProductFindFirst.mockResolvedValueOnce(rawProduct);
    mockWarehouseStockGroupBy.mockResolvedValueOnce([
      { productId: "prod-1", _sum: { quantity: 10, reservedQuantity: 2 } },
    ]);

    const caller = publicCaller();
    const result = await caller.storefront.getProductBySlug({
      tenantSlug: "acme",
      slug: "widget",
    });

    const arg = mockProductFindFirst.mock.calls[0]![0];
    expect(arg.where).toMatchObject({
      tenantId: "tenant-A",
      isActive: true,
      ecommerceVisible: true,
      ecommerceSlug: "widget",
    });
    expect(result.price).toBe(100);
    expect(result.compareAtPrice).toBe(150);
    expect(result.discountPercent).toBe(33);
    expect(result.inStock).toBe(true);
    expect(result.availableQuantity).toBe(8);
  });

  it("getProductBySlug 404s when the product is not ecommerceVisible in that tenant, even with a cuid-shaped fallback", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ id: "tenant-A", isActive: true });
    mockProductFindFirst.mockResolvedValue(null);
    const caller = publicCaller();
    await expect(
      caller.storefront.getProductBySlug({
        tenantSlug: "acme",
        slug: "clfallbackcuidxxxxxxxx1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // slug-lookup, then cuid-fallback lookup — both scoped to the same tenant
    expect(mockProductFindFirst).toHaveBeenCalledTimes(2);
    for (const call of mockProductFindFirst.mock.calls) {
      expect(call[0].where).toMatchObject({
        tenantId: "tenant-A",
        ecommerceVisible: true,
      });
    }
  });

  it("listFeaturedProducts scopes by tenantId + ecommerceVisible + isFeatured", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ id: "tenant-A", isActive: true });
    mockProductFindMany.mockResolvedValueOnce([rawProduct]);
    const caller = publicCaller();
    await caller.storefront.listFeaturedProducts({ tenantSlug: "acme" });
    const arg = mockProductFindMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({
      tenantId: "tenant-A",
      ecommerceVisible: true,
      isFeatured: true,
    });
  });

  it("listNewArrivals scopes by tenantId + ecommerceVisible + a 30-day createdAt window", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ id: "tenant-A", isActive: true });
    mockProductFindMany.mockResolvedValueOnce([]);
    const caller = publicCaller();
    await caller.storefront.listNewArrivals({ tenantSlug: "acme" });
    const arg = mockProductFindMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ tenantId: "tenant-A", ecommerceVisible: true });
    expect(arg.where.createdAt.gte).toBeInstanceOf(Date);
  });
});
