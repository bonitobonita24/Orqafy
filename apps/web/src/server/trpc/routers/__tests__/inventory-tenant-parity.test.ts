/**
 * Tenant-parity tests for inventory router: Category + StockMovement surfaces.
 * Proves IDOR closure: cross-tenant reads/writes are rejected.
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { inventoryRouter } from "@/server/trpc/routers/inventory";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

// vi.hoisted runs before vi.mock factories, making _prismaMock available inside the factory.
// $transaction passes _prismaMock as `tx` so tx.<model>.<op>() hits the SAME vi.fn()
// instances that existing assertions already reference via mockDb.
const { _prismaMock } = vi.hoisted(() => {
  const mock = {
    product: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    category: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    warehouse: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    warehouseStock: { findMany: vi.fn() },
    stockMovement: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  // $transaction invokes its callback with the same mock object so tx === prisma
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) => fn(mock));
  return { _prismaMock: mock };
});

vi.mock("@orqafy/db", () => ({
  prisma: _prismaMock,
  writeAuditLog: async (tx: { auditLog: { create: (args: unknown) => Promise<unknown> } }, entry: unknown) => {
    await tx.auditLog.create({ data: entry });
  },
}));

import type { NextRequest } from "next/server";

// Use _prismaMock directly — it IS the mock object, no cast needed.
const mockDb = _prismaMock;

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

// ── Product IDOR closure (M7.2) ─────────────────────────────────────────────

describe("product tenant parity (M7.2 IDOR guards)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("productById rejects cross-tenant id (read-IDOR closure)", async () => {
    mockDb.product.findFirst.mockResolvedValue(null);
    const caller = createCaller(tenantBCtx());
    await expect(caller.inventory.productById({ id: "prod-owned-by-alpha" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const call = mockDb.product.findFirst.mock.calls[0] as [{ where: { id: string; tenantId: string } }];
    expect(call[0].where).toMatchObject({ id: "prod-owned-by-alpha", tenantId: "tid-bravo" });
  });

  it("productToggleActive rejects cross-tenant id (write-IDOR closure)", async () => {
    mockDb.product.findFirst.mockResolvedValue(null);
    const caller = createCaller(tenantBCtx());
    await expect(caller.inventory.productToggleActive({ id: "prod-owned-by-alpha" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const call = mockDb.product.findFirst.mock.calls[0] as [{ where: { id: string; tenantId: string } }];
    expect(call[0].where).toMatchObject({ id: "prod-owned-by-alpha", tenantId: "tid-bravo" });
    expect(mockDb.product.update).not.toHaveBeenCalled();
  });

  it("productUpdate rejects cross-tenant id (IDOR closure)", async () => {
    mockDb.product.findFirst.mockResolvedValue(null);
    const caller = createCaller(tenantBCtx());
    await expect(caller.inventory.productUpdate({ id: "prod-owned-by-alpha", name: "Hacked" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const call = mockDb.product.findFirst.mock.calls[0] as [{ where: { id: string; tenantId: string } }];
    expect(call[0].where).toMatchObject({ id: "prod-owned-by-alpha", tenantId: "tid-bravo" });
  });

  it("productUpdate rejects a cross-tenant categoryId even when the product itself is owned", async () => {
    mockDb.product.findFirst.mockResolvedValue({ id: "prod-owned-by-bravo", tenantId: "tid-bravo" });
    mockDb.category.findFirst.mockResolvedValue(null); // categoryId belongs to another tenant
    const caller = createCaller(tenantBCtx());
    await expect(
      caller.inventory.productUpdate({ id: "prod-owned-by-bravo", categoryId: "cat-owned-by-alpha" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const call = mockDb.category.findFirst.mock.calls[0] as [{ where: { id: string; tenantId: string } }];
    expect(call[0].where).toMatchObject({ id: "cat-owned-by-alpha", tenantId: "tid-bravo" });
  });

  it("productCreate rejects a cross-tenant categoryId", async () => {
    mockDb.category.findFirst.mockResolvedValue(null); // categoryId belongs to another tenant
    const caller = createCaller(tenantBCtx());
    await expect(
      caller.inventory.productCreate({ name: "New Widget", categoryId: "cat-owned-by-alpha" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.product.create).not.toHaveBeenCalled();
  });
});

// ── StockMovement IDOR closure ──────────────────────────────────────────────

describe("stockMovement tenant parity", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("stockMovementCreate injects ctx.tenantId into data", async () => {
    mockDb.product.findFirst.mockResolvedValue({ id: "p1", tenantId: "tid-alpha" });
    mockDb.warehouse.findFirst.mockResolvedValue({ id: "wh1", tenantId: "tid-alpha" });
    mockDb.stockMovement.create.mockResolvedValue({ id: "sm-new", tenantId: "tid-alpha" });
    const caller = createCaller(tenantACtx());
    await caller.inventory.stockMovementCreate({ type: "in", productId: "p1", quantity: 5, toWarehouseId: "wh1" });
    const call = mockDb.stockMovement.create.mock.calls[0] as [{ data: { tenantId: string } }];
    expect(call[0].data.tenantId).toBe("tid-alpha");
  });

  it("stockMovementCreate rejects a cross-tenant productId (IDOR closure)", async () => {
    mockDb.product.findFirst.mockResolvedValue(null); // productId belongs to another tenant
    const caller = createCaller(tenantBCtx());
    await expect(
      caller.inventory.stockMovementCreate({ type: "in", productId: "p1-owned-by-alpha", quantity: 5, toWarehouseId: "wh1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.stockMovement.create).not.toHaveBeenCalled();
  });

  it("stockMovementCreate rejects a cross-tenant toWarehouseId (IDOR closure)", async () => {
    mockDb.product.findFirst.mockResolvedValue({ id: "p1", tenantId: "tid-bravo" });
    mockDb.warehouse.findFirst.mockResolvedValue(null); // warehouseId belongs to another tenant
    const caller = createCaller(tenantBCtx());
    await expect(
      caller.inventory.stockMovementCreate({ type: "in", productId: "p1", quantity: 5, toWarehouseId: "wh-owned-by-alpha" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.stockMovement.create).not.toHaveBeenCalled();
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
    mockDb.product.findFirst.mockResolvedValue({ id: "p1", tenantId: "tid-alpha" });
    mockDb.warehouse.findFirst.mockResolvedValue({ id: "wh", tenantId: "tid-alpha" });
    mockDb.stockMovement.create.mockResolvedValue({ id: "sm-xfer", tenantId: "tid-alpha" });
    const caller = createCaller(tenantACtx());
    await caller.inventory.stockTransfer({ productId: "p1", quantity: 3, fromWarehouseId: "wh1", toWarehouseId: "wh2" });
    const call = mockDb.stockMovement.create.mock.calls[0] as [{ data: { tenantId: string } }];
    expect(call[0].data.tenantId).toBe("tid-alpha");
  });

  it("stockAdjustment injects ctx.tenantId into data", async () => {
    mockDb.product.findFirst.mockResolvedValue({ id: "p1", tenantId: "tid-alpha" });
    mockDb.warehouse.findFirst.mockResolvedValue({ id: "wh1", tenantId: "tid-alpha" });
    mockDb.stockMovement.create.mockResolvedValue({ id: "sm-adj", tenantId: "tid-alpha" });
    const caller = createCaller(tenantACtx());
    await caller.inventory.stockAdjustment({ productId: "p1", quantity: -2, warehouseId: "wh1", notes: "damaged" });
    const call = mockDb.stockMovement.create.mock.calls[0] as [{ data: { tenantId: string } }];
    expect(call[0].data.tenantId).toBe("tid-alpha");
  });
});

// ── Audit log assertions ────────────────────────────────────────────────────

describe("audit log written for inventory mutations", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("categoryCreate writes an audit row with action CREATE entity Category", async () => {
    mockDb.category.create.mockResolvedValue({ id: "cat-audit", tenantId: "tid-alpha", name: "Audit Cat", slug: "audit-cat", isActive: true });
    const caller = createCaller(tenantACtx());
    await caller.inventory.categoryCreate({ name: "Audit Cat", slug: "audit-cat" });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", entity: "Category" }),
      }),
    );
  });

  it("stockMovementCreate writes an audit row with action CREATE entity StockMovement", async () => {
    mockDb.product.findFirst.mockResolvedValue({ id: "p1", tenantId: "tid-alpha" });
    mockDb.warehouse.findFirst.mockResolvedValue({ id: "wh1", tenantId: "tid-alpha" });
    mockDb.stockMovement.create.mockResolvedValue({ id: "sm-audit", tenantId: "tid-alpha", type: "in", productId: "p1", quantity: 5, fromWarehouseId: null, toWarehouseId: "wh1" });
    const caller = createCaller(tenantACtx());
    await caller.inventory.stockMovementCreate({ type: "in", productId: "p1", quantity: 5, toWarehouseId: "wh1" });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", entity: "StockMovement" }),
      }),
    );
  });
});
