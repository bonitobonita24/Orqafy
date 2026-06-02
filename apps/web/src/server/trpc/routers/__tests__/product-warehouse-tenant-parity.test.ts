/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime Extended Phase 2 Wave B: Product + Warehouse tenant parity (IDOR guards)
 *
 * Proves:
 *  1. storefront.browseProducts scopes findMany by ctx.tenantId
 *  2. storefront.getProductById throws NOT_FOUND when product belongs to tenant-B
 *  3. storefront.placeOrder rejects products from another tenant
 *  4. inventory.warehouseList scopes findMany by ctx.tenantId
 *  5. inventory.warehouseUpdate throws NOT_FOUND when warehouse belongs to tenant-B
 *  6. inventory.stockList scopes findMany by ctx.tenantId
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockProductFindMany,
  mockProductCount,
  mockProductFindFirst,
  mockWarehouseFindMany,
  mockWarehouseFindFirst,
  mockWarehouseStockFindMany,
  mockCustomerFindUnique,
} = vi.hoisted(() => ({
  mockProductFindMany: vi.fn(),
  mockProductCount: vi.fn(),
  mockProductFindFirst: vi.fn(),
  mockWarehouseFindMany: vi.fn(),
  mockWarehouseFindFirst: vi.fn(),
  mockWarehouseStockFindMany: vi.fn(),
  mockCustomerFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    product: {
      findMany: mockProductFindMany,
      findFirst: mockProductFindFirst,
      findUnique: vi.fn(),
      count: mockProductCount,
    },
    warehouse: {
      findMany: mockWarehouseFindMany,
      findFirst: mockWarehouseFindFirst,
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    warehouseStock: {
      findMany: mockWarehouseStockFindMany,
      update: vi.fn(),
    },
    customer: { findUnique: mockCustomerFindUnique, findFirst: vi.fn() },
    ecommerceOrder: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    ecommerceOrderItem: { create: vi.fn(), createMany: vi.fn() },
    stockMovement: { findMany: vi.fn(), create: vi.fn() },
    tenant: { findUnique: vi.fn() },
    category: { findMany: vi.fn() },
    $transaction: vi.fn((fn: any) => fn({
      ecommerceOrder: { create: vi.fn().mockResolvedValue({ id: "order-1", orderNumber: "ORD-001" }) },
      ecommerceOrderItem: { create: vi.fn() },
      warehouseStock: { update: vi.fn() },
      stockMovement: { create: vi.fn() },
    })),
  },
  writeAuditLog: vi.fn(),
}));

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
import { inventoryRouter } from "@/server/trpc/routers/inventory";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ storefront: storefrontRouter, inventory: inventoryRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return { headers: { get: () => null } } as unknown as NextRequest;
}

function ctxForTenant(tenantId: string) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"] as string[],
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const PRODUCT_CUID = "clproductxxxxxxxxxxxxx0";
const WAREHOUSE_CUID = "clwarehousexxxxxxxxxx0";

describe("Product + Warehouse tenant parity (K-prime Extended Phase 2 Wave B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("browseProducts scopes findMany by ctx.tenantId", async () => {
    mockProductFindMany.mockResolvedValueOnce([]);
    mockProductCount.mockResolvedValueOnce(0);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.storefront.browseProducts({});

    expect(mockProductFindMany).toHaveBeenCalledOnce();
    const callArg = mockProductFindMany.mock.calls[0]![0];
    expect(callArg.where).toMatchObject({ tenantId: "tenant-A" });
  });

  it("getProductById throws NOT_FOUND when product belongs to a different tenant", async () => {
    mockProductFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.storefront.getProductById({ id: PRODUCT_CUID }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Product not found",
    });

    expect(mockProductFindFirst).toHaveBeenCalledOnce();
    const callArg = mockProductFindFirst.mock.calls[0]![0];
    expect(callArg.where).toMatchObject({ id: PRODUCT_CUID, tenantId: "tenant-A" });
  });

  it("placeOrder rejects when products belong to a different tenant", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({
      id: "clcustomerxxxxxxxxxxx0",
      tenantId: "tenant-A",
      isActive: true,
    });
    // product.findMany returns empty because tenantId filter excludes tenant-B products
    mockProductFindMany.mockResolvedValueOnce([]);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.storefront.placeOrder({
        customerId: "clcustomerxxxxxxxxxxx0",
        warehouseId: WAREHOUSE_CUID,
        items: [{ productId: PRODUCT_CUID, quantity: 1, unitPrice: 100 }],
        shippingAddress: { line1: "123 Test St" },
        billingAddress: { line1: "123 Test St" },
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "One or more products not found or inactive",
    });

    expect(mockProductFindMany).toHaveBeenCalledOnce();
    const callArg = mockProductFindMany.mock.calls[0]![0];
    expect(callArg.where).toMatchObject({ tenantId: "tenant-A" });
  });

  it("warehouseList scopes findMany by ctx.tenantId", async () => {
    mockWarehouseFindMany.mockResolvedValueOnce([]);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.inventory.warehouseList({});

    expect(mockWarehouseFindMany).toHaveBeenCalledOnce();
    const callArg = mockWarehouseFindMany.mock.calls[0]![0];
    expect(callArg.where).toMatchObject({ tenantId: "tenant-A" });
  });

  it("warehouseUpdate throws NOT_FOUND when warehouse belongs to a different tenant", async () => {
    mockWarehouseFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.inventory.warehouseUpdate({ id: WAREHOUSE_CUID, name: "New Name" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(mockWarehouseFindFirst).toHaveBeenCalledOnce();
    const callArg = mockWarehouseFindFirst.mock.calls[0]![0];
    expect(callArg.where).toMatchObject({ id: WAREHOUSE_CUID, tenantId: "tenant-A" });
  });

  it("stockList scopes findMany by ctx.tenantId", async () => {
    mockWarehouseStockFindMany.mockResolvedValueOnce([]);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.inventory.stockList({});

    expect(mockWarehouseStockFindMany).toHaveBeenCalledOnce();
    const callArg = mockWarehouseStockFindMany.mock.calls[0]![0];
    expect(callArg.where).toMatchObject({ tenantId: "tenant-A" });
  });
});
