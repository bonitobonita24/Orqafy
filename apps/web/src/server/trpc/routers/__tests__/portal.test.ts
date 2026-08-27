/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
/**
 * W3a — customer portal data router (Invoices, Orders, Repairs, Dashboard).
 *
 * Proves the cardinal rule for every procedure: `where` is scoped by BOTH
 * ctx.tenantId AND ctx.customerId (never trusts a client-supplied
 * customerId — there is no such input anywhere in this router), and every
 * `byId` throws NOT_FOUND (never FORBIDDEN) for a row belonging to another
 * customer/tenant. Also proves every procedure rejects a staff/unauth ctx
 * (built from portalProcedure).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

const {
  mockInvoiceFindMany,
  mockInvoiceFindFirst,
  mockInvoiceCount,
  mockOrderFindMany,
  mockOrderFindFirst,
  mockOrderCount,
  mockJobOrderFindMany,
  mockJobOrderFindFirst,
  mockJobOrderCount,
} = vi.hoisted(() => ({
  mockInvoiceFindMany: vi.fn(),
  mockInvoiceFindFirst: vi.fn(),
  mockInvoiceCount: vi.fn(),
  mockOrderFindMany: vi.fn(),
  mockOrderFindFirst: vi.fn(),
  mockOrderCount: vi.fn(),
  mockJobOrderFindMany: vi.fn(),
  mockJobOrderFindFirst: vi.fn(),
  mockJobOrderCount: vi.fn(),
}));

import type * as OrqafyDb from "@orqafy/db";

vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  return {
    ...actual,
    prisma: {
      invoice: {
        findMany: mockInvoiceFindMany,
        findFirst: mockInvoiceFindFirst,
        count: mockInvoiceCount,
      },
      ecommerceOrder: {
        findMany: mockOrderFindMany,
        findFirst: mockOrderFindFirst,
        count: mockOrderCount,
      },
      jobOrder: {
        findMany: mockJobOrderFindMany,
        findFirst: mockJobOrderFindFirst,
        count: mockJobOrderCount,
      },
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    auth: { check: vi.fn() },
    upload: { check: vi.fn() },
    public: { check: vi.fn() },
  },
}));

import { portalRouter } from "@/server/trpc/routers/portal";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ portal: portalRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return { headers: { get: (_h: string): string | null => null } } as unknown as NextRequest;
}

function customerCtx(overrides: Partial<{ tenantId: string; customerId: string }> = {}) {
  return {
    req: makeReq(),
    userId: null,
    roles: [],
    roleId: null,
    tenantSlug: "acme",
    tenantId: overrides.tenantId ?? "tenant-A",
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
    principalType: "customer" as const,
    customerId: overrides.customerId ?? "customer-1",
  };
}

function staffCtx() {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: ["Administrator"],
    roleId: "role-1",
    tenantSlug: "acme",
    tenantId: "tenant-A",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
    principalType: "staff" as const,
    customerId: null,
  };
}

function unauthCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [],
    roleId: null,
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
    principalType: "staff" as const,
    customerId: null,
  };
}

const FOREIGN_ID = "clforeignxxxxxxxxxxxx01";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("portal router — deny-by-default (built on portalProcedure)", () => {
  it("invoices.list rejects a staff ctx", async () => {
    const caller = createCaller(staffCtx());
    await expect(caller.portal.invoices.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("orders.list rejects an unauthenticated ctx", async () => {
    const caller = createCaller(unauthCtx());
    await expect(caller.portal.orders.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("repairs.list rejects a staff ctx", async () => {
    const caller = createCaller(staffCtx());
    await expect(caller.portal.repairs.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("dashboard.summary rejects a staff ctx", async () => {
    const caller = createCaller(staffCtx());
    await expect(caller.portal.dashboard.summary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("portal.invoices", () => {
  it("list scopes findMany by BOTH ctx.tenantId AND ctx.customerId", async () => {
    mockInvoiceFindMany.mockResolvedValueOnce([]);
    const caller = createCaller(customerCtx());
    await caller.portal.invoices.list();

    expect(mockInvoiceFindMany).toHaveBeenCalledOnce();
    const arg = mockInvoiceFindMany.mock.calls[0]![0];
    expect(arg.where).toStrictEqual({ tenantId: "tenant-A", customerId: "customer-1" });
  });

  it("byId returns the invoice when it belongs to the caller", async () => {
    const invoice = { id: "clinvoicexxxxxxxxxxxx01", invoiceNumber: "INV-1" };
    mockInvoiceFindFirst.mockResolvedValueOnce(invoice);
    const caller = createCaller(customerCtx());
    const result = await caller.portal.invoices.byId({ id: "clinvoicexxxxxxxxxxxx01" });

    expect(result).toEqual(invoice);
    const arg = mockInvoiceFindFirst.mock.calls[0]![0];
    expect(arg.where).toStrictEqual({
      id: "clinvoicexxxxxxxxxxxx01",
      tenantId: "tenant-A",
      customerId: "customer-1",
    });
  });

  it("byId throws NOT_FOUND (not FORBIDDEN) when the invoice belongs to another customer/tenant", async () => {
    // The tenant+customer-scoped findFirst returns null — the caller can
    // never tell whether the row exists for another customer or not at all.
    mockInvoiceFindFirst.mockResolvedValue(null);
    const caller = createCaller(customerCtx());

    await expect(caller.portal.invoices.byId({ id: FOREIGN_ID })).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.portal.invoices.byId({ id: FOREIGN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("byId never accepts a customerId from input — no such input field exists", async () => {
    mockInvoiceFindFirst.mockResolvedValueOnce({ id: "clinvoicexxxxxxxxxxxx01" });
    const caller = createCaller(customerCtx());
    // @ts-expect-error — customerId is deliberately not part of the input schema
    await caller.portal.invoices.byId({ id: "clinvoicexxxxxxxxxxxx01", customerId: "customer-2" });

    const arg = mockInvoiceFindFirst.mock.calls[0]![0];
    // Even when a caller smuggles an extra field, only ctx.customerId is used.
    expect(arg.where.customerId).toBe("customer-1");
  });
});

describe("portal.orders", () => {
  it("list scopes findMany by BOTH ctx.tenantId AND ctx.customerId", async () => {
    mockOrderFindMany.mockResolvedValueOnce([]);
    const caller = createCaller(customerCtx({ tenantId: "tenant-B", customerId: "customer-2" }));
    await caller.portal.orders.list();

    const arg = mockOrderFindMany.mock.calls[0]![0];
    expect(arg.where).toStrictEqual({ tenantId: "tenant-B", customerId: "customer-2" });
  });

  it("byId throws NOT_FOUND when the order belongs to another tenant", async () => {
    mockOrderFindFirst.mockResolvedValueOnce(null);
    const caller = createCaller(customerCtx());

    await expect(caller.portal.orders.byId({ id: FOREIGN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const arg = mockOrderFindFirst.mock.calls[0]![0];
    expect(arg.where).toStrictEqual({ id: FOREIGN_ID, tenantId: "tenant-A", customerId: "customer-1" });
  });
});

describe("portal.repairs", () => {
  it("list scopes findMany by BOTH ctx.tenantId AND ctx.customerId", async () => {
    mockJobOrderFindMany.mockResolvedValueOnce([]);
    const caller = createCaller(customerCtx());
    await caller.portal.repairs.list();

    const arg = mockJobOrderFindMany.mock.calls[0]![0];
    expect(arg.where).toStrictEqual({ tenantId: "tenant-A", customerId: "customer-1" });
  });

  it("byId throws NOT_FOUND when the repair belongs to another customer", async () => {
    mockJobOrderFindFirst.mockResolvedValueOnce(null);
    const caller = createCaller(customerCtx());

    await expect(caller.portal.repairs.byId({ id: FOREIGN_ID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const arg = mockJobOrderFindFirst.mock.calls[0]![0];
    expect(arg.where).toStrictEqual({ id: FOREIGN_ID, tenantId: "tenant-A", customerId: "customer-1" });
  });
});

describe("portal.dashboard.summary", () => {
  it("derives counts from the same customer+tenant-scoped filters as the section lists", async () => {
    mockInvoiceCount.mockResolvedValueOnce(3);
    mockInvoiceFindMany.mockResolvedValueOnce([
      { balance: { toString: () => "150.50" } },
      { balance: { toString: () => "49.50" } },
    ]);
    mockOrderCount.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    mockJobOrderCount.mockResolvedValueOnce(4).mockResolvedValueOnce(1);

    const caller = createCaller(customerCtx());
    const result = await caller.portal.dashboard.summary();

    expect(result).toEqual({
      invoices: { count: 3, outstandingBalance: 200 },
      orders: { count: 5, activeCount: 2 },
      repairs: { count: 4, openCount: 1 },
    });

    // Every underlying query is scoped by BOTH tenantId AND customerId.
    for (const mock of [
      mockInvoiceCount,
      mockInvoiceFindMany,
      mockOrderCount,
      mockJobOrderCount,
    ] as const) {
      for (const call of mock.mock.calls) {
        expect(call[0].where).toMatchObject({ tenantId: "tenant-A", customerId: "customer-1" });
      }
    }
  });
});
