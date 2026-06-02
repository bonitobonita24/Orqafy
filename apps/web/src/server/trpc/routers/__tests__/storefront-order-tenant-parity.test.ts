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
} = vi.hoisted(() => ({
  mockOrderFindUnique: vi.fn(),
  mockOrderFindFirst: vi.fn(),
  mockOrderFindMany: vi.fn(),
  mockOrderCount: vi.fn(),
  mockOrderUpdate: vi.fn(),
  mockCustomerFindFirst: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
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
    tenant: { findUnique: vi.fn() },
    warehouse: { findFirst: vi.fn() },
    warehouseStock: { findMany: vi.fn(), update: vi.fn() },
    product: { findMany: vi.fn(), findUnique: vi.fn() },
    stockMovement: { findMany: vi.fn(), create: vi.fn() },
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
