/**
 * Tenant-parity tests for inventory router: Category + StockMovement surfaces.
 * Proves IDOR closure: cross-tenant reads/writes are rejected.
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { inventoryRouter } from "@/server/trpc/routers/inventory";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

vi.mock("@orqafy/db", () => ({
  prisma: {
    product: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    category: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    warehouse: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    warehouseStock: { findMany: vi.fn() },
    stockMovement: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
  },
}));

import type { NextRequest } from "next/server";
import { prisma as db } from "@orqafy/db";

const mockDb = db as unknown as {
  category: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  stockMovement: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
};

function makeReq(): NextRequest { return {} as NextRequest; }

function tenantACtx() {
  return { req: makeReq(), userId: "user-a", roles: ["Administrator"], tenantSlug: "alpha", tenantId: "tid-alpha", securityVersion: 1, isDemoTenant: false, session: null };
}
function tenantBCtx() {
  return { req: makeReq(), userId: "user-b", roles: ["Administrator"], tenantSlug: "bravo", tenantId: "tid-bravo", securityVersion: 1, isDemoTenant: false, session: null };
}

const testRouter = createTRPCRouter({ inventory: inventoryRouter });
const createCaller = createCallerFactory(testRouter);

// ── Category IDOR closure ───────────────────────────────────────────────────

describe("category tenant parity", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("categoryCreate injects ctx.tenantId into data", async () => {
    mockDb.category.create.mockResolvedValue({ id: "cat-new", tenantId: "tid-alpha" });
    const caller = createCaller(tenantACtx());
    await caller.inventory.categoryCreate({ name: "Tools", slug: "tools" });
    const call = mockDb.category.create.mock.calls[0] as [{ data: { tenantId: string } }];
    expect(call[0].data.tenantId).toBe("tid-alpha");
  });

  it("categoryUpdate rejects cross-tenant byId (IDOR closure)", async () => {
    mockDb.category.findFirst.mockResolvedValue(null);
    const caller = createCaller(tenantBCtx());
    await expect(caller.inventory.categoryUpdate({ id: "cat-owned-by-alpha", name: "Hacked" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const call = mockDb.category.findFirst.mock.calls[0] as [{ where: { id: string; tenantId: string } }];
    expect(call[0].where.tenantId).toBe("tid-bravo");
  });

  it("categoryToggleActive rejects cross-tenant byId (IDOR closure)", async () => {
    mockDb.category.findFirst.mockResolvedValue(null);
    const caller = createCaller(tenantBCtx());
    await expect(caller.inventory.categoryToggleActive({ id: "cat-owned-by-alpha" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const call = mockDb.category.findFirst.mock.calls[0] as [{ where: { id: string; tenantId: string } }];
    expect(call[0].where.tenantId).toBe("tid-bravo");
  });

  it("categoryList scopes by ctx.tenantId", async () => {
    mockDb.category.findMany.mockResolvedValue([]);
    const caller = createCaller(tenantACtx());
    await caller.inventory.categoryList({});
    const call = mockDb.category.findMany.mock.calls[0] as [{ where: { tenantId: string } }];
    expect(call[0].where.tenantId).toBe("tid-alpha");
  });
});

// ── StockMovement IDOR closure ──────────────────────────────────────────────

describe("stockMovement tenant parity", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("stockMovementCreate injects ctx.tenantId into data", async () => {
    mockDb.stockMovement.create.mockResolvedValue({ id: "sm-new", tenantId: "tid-alpha" });
    const caller = createCaller(tenantACtx());
    await caller.inventory.stockMovementCreate({ type: "in", productId: "p1", quantity: 5, toWarehouseId: "wh1" });
    const call = mockDb.stockMovement.create.mock.calls[0] as [{ data: { tenantId: string } }];
    expect(call[0].data.tenantId).toBe("tid-alpha");
  });

  it("stockMovementById rejects cross-tenant read (IDOR closure)", async () => {
    mockDb.stockMovement.findFirst.mockResolvedValue(null);
    const caller = createCaller(tenantBCtx());
    await expect(caller.inventory.stockMovementById({ id: "sm-owned-by-alpha" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const call = mockDb.stockMovement.findFirst.mock.calls[0] as [{ where: { id: string; tenantId: string } }];
    expect(call[0].where.tenantId).toBe("tid-bravo");
  });

  it("stockMovementList scopes by ctx.tenantId", async () => {
    mockDb.stockMovement.findMany.mockResolvedValue([]);
    mockDb.stockMovement.count.mockResolvedValue(0);
    const caller = createCaller(tenantACtx());
    await caller.inventory.stockMovementList({});
    const call = mockDb.stockMovement.findMany.mock.calls[0] as [{ where: { tenantId: string } }];
    expect(call[0].where.tenantId).toBe("tid-alpha");
  });

  it("stockTransfer injects ctx.tenantId into data", async () => {
    mockDb.stockMovement.create.mockResolvedValue({ id: "sm-xfer", tenantId: "tid-alpha" });
    const caller = createCaller(tenantACtx());
    await caller.inventory.stockTransfer({ productId: "p1", quantity: 3, fromWarehouseId: "wh1", toWarehouseId: "wh2" });
    const call = mockDb.stockMovement.create.mock.calls[0] as [{ data: { tenantId: string } }];
    expect(call[0].data.tenantId).toBe("tid-alpha");
  });

  it("stockAdjustment injects ctx.tenantId into data", async () => {
    mockDb.stockMovement.create.mockResolvedValue({ id: "sm-adj", tenantId: "tid-alpha" });
    const caller = createCaller(tenantACtx());
    await caller.inventory.stockAdjustment({ productId: "p1", quantity: -2, warehouseId: "wh1", notes: "damaged" });
    const call = mockDb.stockMovement.create.mock.calls[0] as [{ data: { tenantId: string } }];
    expect(call[0].data.tenantId).toBe("tid-alpha");
  });
});
