/**
 * Phase 8 Batch 2 Item 3: Module 5 Inventory Phase 1 — Product catalog + Warehouse CRUD
 *
 * Covers:
 *  1. inventory.productList — paginated list with category/search/isActive filters
 *  2. inventory.productById — returns single product or NOT_FOUND
 *  3. inventory.productCreate — creates product with required fields
 *  4. inventory.productUpdate — partial update of product
 *  5. inventory.productToggleActive — flips isActive boolean
 *  6. inventory.categoryList — returns active categories
 *  7. inventory.categoryCreate — creates a category
 *  8. inventory.warehouseList — returns active warehouses
 *  9. inventory.warehouseCreate — creates a warehouse
 * 10. inventory.warehouseUpdate — partial update of warehouse
 * 11. inventory.warehouseToggleActive — flips warehouse isActive
 * 12. inventory.stockList — returns warehouse stock levels
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { inventoryRouter } from "@/server/trpc/routers/inventory";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

vi.mock("@orqafy/db", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    warehouse: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    warehouseStock: {
      findMany: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import type { NextRequest } from "next/server";

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function authenticatedCtx() {
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

const testRouter = createTRPCRouter({ inventory: inventoryRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  product: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  category: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  warehouse: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  warehouseStock: {
    findMany: ReturnType<typeof vi.fn>;
  };
  stockMovement: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const sampleCategory = {
  id: "cat-1",
  name: "Electronics",
  slug: "electronics",
  description: null,
  parentId: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sampleWarehouse = {
  id: "wh-1",
  name: "Main Warehouse",
  code: "MAIN",
  address: "123 Main St",
  isDefault: true,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sampleProduct = {
  id: "prod-1",
  sku: "SKU-001",
  barcode: null,
  name: "Test Product",
  description: null,
  categoryId: "cat-1",
  unit: "pcs",
  baseCost: "100.00",
  tier1Price: null,
  tier1Percentage: null,
  tier1UseCeiling: false,
  tier2Price: null,
  tier2Percentage: null,
  tier2UseCeiling: false,
  tier3Price: null,
  tier3Percentage: null,
  tier3UseCeiling: false,
  reorderLevel: null,
  reorderQuantity: null,
  isActive: true,
  isSerialTracked: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sampleStock = {
  id: "stock-1",
  warehouseId: "wh-1",
  productId: "prod-1",
  quantity: "50.0000",
  reservedQuantity: "0.0000",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  warehouse: sampleWarehouse,
  product: sampleProduct,
};

const sampleStockMovement = {
  id: "sm-1",
  type: "in",
  productId: "prod-1",
  quantity: "10.0000",
  fromWarehouseId: null,
  toWarehouseId: "wh-1",
  notes: null,
  referenceType: null,
  referenceId: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  product: sampleProduct,
  fromWarehouse: null,
  toWarehouse: sampleWarehouse,
};

// ---------------------------------------------------------------------------
// 1. inventory.productList
// ---------------------------------------------------------------------------
describe("inventory.productList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns paginated products for authenticated user", async () => {
    mockDb.product.findMany.mockResolvedValue([sampleProduct]);
    mockDb.product.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.productList({ page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(mockDb.product.findMany).toHaveBeenCalledOnce();
  });

  it("filters by isActive when provided", async () => {
    mockDb.product.findMany.mockResolvedValue([sampleProduct]);
    mockDb.product.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.inventory.productList({ page: 1, limit: 50, isActive: true });

    const call = mockDb.product.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ isActive: true });
  });

  it("filters by categoryId when provided", async () => {
    mockDb.product.findMany.mockResolvedValue([sampleProduct]);
    mockDb.product.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.inventory.productList({ page: 1, limit: 50, categoryId: "cat-1" });

    const call = mockDb.product.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ categoryId: "cat-1" });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.inventory.productList({ page: 1, limit: 50 })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. inventory.productById
// ---------------------------------------------------------------------------
describe("inventory.productById", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns a product by id", async () => {
    mockDb.product.findUnique.mockResolvedValue(sampleProduct);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.productById({ id: "prod-1" });

    expect(result.id).toBe("prod-1");
    expect(result.name).toBe("Test Product");
  });

  it("throws NOT_FOUND when product does not exist", async () => {
    mockDb.product.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(caller.inventory.productById({ id: "nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// 3. inventory.productCreate
// ---------------------------------------------------------------------------
describe("inventory.productCreate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a product with required fields", async () => {
    const created = { ...sampleProduct, id: "prod-new" };
    mockDb.product.create.mockResolvedValue(created);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.productCreate({ name: "New Product" });

    expect(result.id).toBe("prod-new");
    expect(mockDb.product.create).toHaveBeenCalledOnce();
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({ ...authenticatedCtx(), isDemoTenant: true });
    await expect(
      demoCaller.inventory.productCreate({ name: "Demo Product" })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. inventory.productUpdate
// ---------------------------------------------------------------------------
describe("inventory.productUpdate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates product name", async () => {
    const updated = { ...sampleProduct, name: "Updated Product" };
    mockDb.product.findUnique.mockResolvedValue(sampleProduct);
    mockDb.product.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.productUpdate({ id: "prod-1", name: "Updated Product" });

    expect(result.name).toBe("Updated Product");
    expect(mockDb.product.update).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND for nonexistent product", async () => {
    mockDb.product.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.productUpdate({ id: "nonexistent", name: "X" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 5. inventory.productToggleActive
// ---------------------------------------------------------------------------
describe("inventory.productToggleActive", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("flips isActive from true to false", async () => {
    const existing = { ...sampleProduct, isActive: true };
    const updated = { ...existing, isActive: false };
    mockDb.product.findUnique.mockResolvedValue(existing);
    mockDb.product.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.productToggleActive({ id: "prod-1" });

    expect(result.isActive).toBe(false);
    const call = mockDb.product.update.mock.calls[0] as [{ data: { isActive: boolean } }];
    expect(call[0].data.isActive).toBe(false);
  });

  it("flips isActive from false to true", async () => {
    const existing = { ...sampleProduct, isActive: false };
    const updated = { ...existing, isActive: true };
    mockDb.product.findUnique.mockResolvedValue(existing);
    mockDb.product.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.productToggleActive({ id: "prod-1" });

    expect(result.isActive).toBe(true);
  });

  it("throws NOT_FOUND for nonexistent product", async () => {
    mockDb.product.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.productToggleActive({ id: "nonexistent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 6. inventory.categoryList
// ---------------------------------------------------------------------------
describe("inventory.categoryList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns active categories for authenticated user", async () => {
    mockDb.category.findMany.mockResolvedValue([sampleCategory]);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.categoryList();

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Electronics");
    expect(mockDb.category.findMany).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.inventory.categoryList()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7. inventory.categoryCreate
// ---------------------------------------------------------------------------
describe("inventory.categoryCreate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a category with name and slug", async () => {
    mockDb.category.create.mockResolvedValue(sampleCategory);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.categoryCreate({
      name: "Electronics",
      slug: "electronics",
    });

    expect(result.id).toBe("cat-1");
    expect(mockDb.category.create).toHaveBeenCalledOnce();
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({ ...authenticatedCtx(), isDemoTenant: true });
    await expect(
      demoCaller.inventory.categoryCreate({ name: "Demo", slug: "demo" })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7b. inventory.categoryUpdate
// ---------------------------------------------------------------------------
describe("inventory.categoryUpdate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates category name", async () => {
    mockDb.category.findUnique.mockResolvedValue(sampleCategory);
    mockDb.category.update.mockResolvedValue({ ...sampleCategory, name: "Gadgets" });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.categoryUpdate({ id: "cat-1", name: "Gadgets" });

    expect(result.name).toBe("Gadgets");
    expect(mockDb.category.update).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND for nonexistent category", async () => {
    mockDb.category.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.categoryUpdate({ id: "nope", name: "X" })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7c. inventory.categoryToggleActive
// ---------------------------------------------------------------------------
describe("inventory.categoryToggleActive", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("toggles active → inactive", async () => {
    mockDb.category.findUnique.mockResolvedValue({ ...sampleCategory, isActive: true });
    mockDb.category.update.mockResolvedValue({ ...sampleCategory, isActive: false });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.categoryToggleActive({ id: "cat-1" });

    expect(result.isActive).toBe(false);
    expect(mockDb.category.update).toHaveBeenCalledWith({
      where: { id: "cat-1" },
      data: { isActive: false },
    });
  });

  it("toggles inactive → active", async () => {
    mockDb.category.findUnique.mockResolvedValue({ ...sampleCategory, isActive: false });
    mockDb.category.update.mockResolvedValue({ ...sampleCategory, isActive: true });

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.categoryToggleActive({ id: "cat-1" });

    expect(result.isActive).toBe(true);
  });

  it("throws NOT_FOUND for nonexistent category", async () => {
    mockDb.category.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.categoryToggleActive({ id: "nope" })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 8. inventory.warehouseList
// ---------------------------------------------------------------------------
describe("inventory.warehouseList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns active warehouses for authenticated user", async () => {
    mockDb.warehouse.findMany.mockResolvedValue([sampleWarehouse]);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.warehouseList();

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Main Warehouse");
    expect(mockDb.warehouse.findMany).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.inventory.warehouseList()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 9. inventory.warehouseCreate
// ---------------------------------------------------------------------------
describe("inventory.warehouseCreate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a warehouse with required fields", async () => {
    mockDb.warehouse.create.mockResolvedValue(sampleWarehouse);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.warehouseCreate({
      name: "Main Warehouse",
      code: "MAIN",
    });

    expect(result.id).toBe("wh-1");
    expect(mockDb.warehouse.create).toHaveBeenCalledOnce();
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({ ...authenticatedCtx(), isDemoTenant: true });
    await expect(
      demoCaller.inventory.warehouseCreate({ name: "Demo WH", code: "DEMO" })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 10. inventory.warehouseUpdate
// ---------------------------------------------------------------------------
describe("inventory.warehouseUpdate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates warehouse name", async () => {
    const updated = { ...sampleWarehouse, name: "Updated Warehouse" };
    mockDb.warehouse.findUnique.mockResolvedValue(sampleWarehouse);
    mockDb.warehouse.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.warehouseUpdate({ id: "wh-1", name: "Updated Warehouse" });

    expect(result.name).toBe("Updated Warehouse");
    expect(mockDb.warehouse.update).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND for nonexistent warehouse", async () => {
    mockDb.warehouse.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.warehouseUpdate({ id: "nonexistent", name: "X" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 11. inventory.warehouseToggleActive
// ---------------------------------------------------------------------------
describe("inventory.warehouseToggleActive", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("flips isActive from true to false", async () => {
    const existing = { ...sampleWarehouse, isActive: true };
    const updated = { ...existing, isActive: false };
    mockDb.warehouse.findUnique.mockResolvedValue(existing);
    mockDb.warehouse.update.mockResolvedValue(updated);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.warehouseToggleActive({ id: "wh-1" });

    expect(result.isActive).toBe(false);
    const call = mockDb.warehouse.update.mock.calls[0] as [{ data: { isActive: boolean } }];
    expect(call[0].data.isActive).toBe(false);
  });

  it("throws NOT_FOUND for nonexistent warehouse", async () => {
    mockDb.warehouse.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.warehouseToggleActive({ id: "nonexistent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// 12. inventory.stockList
// ---------------------------------------------------------------------------
describe("inventory.stockList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns stock levels for authenticated user", async () => {
    mockDb.warehouseStock.findMany.mockResolvedValue([sampleStock]);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.stockList({});

    expect(result).toHaveLength(1);
    expect(result[0]!.productId).toBe("prod-1");
    expect(mockDb.warehouseStock.findMany).toHaveBeenCalledOnce();
  });

  it("filters by warehouseId when provided", async () => {
    mockDb.warehouseStock.findMany.mockResolvedValue([sampleStock]);

    const caller = createCaller(authenticatedCtx());
    await caller.inventory.stockList({ warehouseId: "wh-1" });

    const call = mockDb.warehouseStock.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ warehouseId: "wh-1" });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.inventory.stockList({})).rejects.toThrow();
  });
});

// 14. inventory.stockMovementList
describe("inventory.stockMovementList", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns paginated stock movements for authenticated user", async () => {
    mockDb.stockMovement.findMany.mockResolvedValue([sampleStockMovement]);
    mockDb.stockMovement.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.stockMovementList({});

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.items[0]!.id).toBe("sm-1");
    expect(mockDb.stockMovement.findMany).toHaveBeenCalledOnce();
    expect(mockDb.stockMovement.count).toHaveBeenCalledOnce();
  });

  it("filters by productId when provided", async () => {
    mockDb.stockMovement.findMany.mockResolvedValue([sampleStockMovement]);
    mockDb.stockMovement.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.inventory.stockMovementList({ productId: "prod-1" });

    const call = mockDb.stockMovement.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ productId: "prod-1" });
  });

  it("filters by warehouseId when provided", async () => {
    mockDb.stockMovement.findMany.mockResolvedValue([sampleStockMovement]);
    mockDb.stockMovement.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.inventory.stockMovementList({ warehouseId: "wh-1" });

    const call = mockDb.stockMovement.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({
      OR: [{ fromWarehouseId: "wh-1" }, { toWarehouseId: "wh-1" }],
    });
  });

  it("filters by type when provided", async () => {
    mockDb.stockMovement.findMany.mockResolvedValue([sampleStockMovement]);
    mockDb.stockMovement.count.mockResolvedValue(1);

    const caller = createCaller(authenticatedCtx());
    await caller.inventory.stockMovementList({ type: "in" });

    const call = mockDb.stockMovement.findMany.mock.calls[0] as [{ where: unknown }];
    expect(call[0].where).toMatchObject({ type: "in" });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.inventory.stockMovementList({})).rejects.toThrow();
  });
});

// 15. inventory.stockMovementById
describe("inventory.stockMovementById", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns a single stock movement by id", async () => {
    mockDb.stockMovement.findUnique.mockResolvedValue(sampleStockMovement);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.stockMovementById({ id: "sm-1" });

    expect(result.id).toBe("sm-1");
    expect(mockDb.stockMovement.findUnique).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when movement does not exist", async () => {
    mockDb.stockMovement.findUnique.mockResolvedValue(null);

    const caller = createCaller(authenticatedCtx());
    await expect(caller.inventory.stockMovementById({ id: "no-such" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(caller.inventory.stockMovementById({ id: "sm-1" })).rejects.toThrow();
  });
});

// 16. inventory.stockMovementCreate
describe("inventory.stockMovementCreate", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates an inbound movement (type=in) with toWarehouseId", async () => {
    mockDb.stockMovement.create.mockResolvedValue(sampleStockMovement);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.stockMovementCreate({
      type: "in",
      productId: "prod-1",
      quantity: 10,
      toWarehouseId: "wh-1",
    });

    expect(result.id).toBe("sm-1");
    expect(mockDb.stockMovement.create).toHaveBeenCalledOnce();
  });

  it("rejects type=in without toWarehouseId", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.stockMovementCreate({
        type: "in",
        productId: "prod-1",
        quantity: 10,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects type=out without fromWarehouseId", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.stockMovementCreate({
        type: "out",
        productId: "prod-1",
        quantity: 5,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({ ...authenticatedCtx(), isDemoTenant: true });
    await expect(
      demoCaller.inventory.stockMovementCreate({
        type: "in",
        productId: "prod-1",
        quantity: 10,
        toWarehouseId: "wh-1",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(
      caller.inventory.stockMovementCreate({
        type: "in",
        productId: "prod-1",
        quantity: 10,
        toWarehouseId: "wh-1",
      })
    ).rejects.toThrow();
  });
});

// 17. inventory.stockTransfer
describe("inventory.stockTransfer", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a transfer movement between two different warehouses", async () => {
    const transferMovement = { ...sampleStockMovement, type: "transfer", fromWarehouseId: "wh-2", toWarehouseId: "wh-1" };
    mockDb.stockMovement.create.mockResolvedValue(transferMovement);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.stockTransfer({
      productId: "prod-1",
      quantity: 5,
      fromWarehouseId: "wh-2",
      toWarehouseId: "wh-1",
    });

    expect(result.type).toBe("transfer");
    expect(mockDb.stockMovement.create).toHaveBeenCalledOnce();
  });

  it("rejects transfer when fromWarehouseId equals toWarehouseId", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.stockTransfer({
        productId: "prod-1",
        quantity: 5,
        fromWarehouseId: "wh-1",
        toWarehouseId: "wh-1",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({ ...authenticatedCtx(), isDemoTenant: true });
    await expect(
      demoCaller.inventory.stockTransfer({
        productId: "prod-1",
        quantity: 5,
        fromWarehouseId: "wh-2",
        toWarehouseId: "wh-1",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(
      caller.inventory.stockTransfer({
        productId: "prod-1",
        quantity: 5,
        fromWarehouseId: "wh-2",
        toWarehouseId: "wh-1",
      })
    ).rejects.toThrow();
  });
});

// 18. inventory.stockAdjustment
describe("inventory.stockAdjustment", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates an adjustment movement with notes", async () => {
    const adjustmentMovement = { ...sampleStockMovement, type: "adjustment", toWarehouseId: "wh-1", notes: "Cycle count correction" };
    mockDb.stockMovement.create.mockResolvedValue(adjustmentMovement);

    const caller = createCaller(authenticatedCtx());
    const result = await caller.inventory.stockAdjustment({
      productId: "prod-1",
      quantity: 2,
      warehouseId: "wh-1",
      notes: "Cycle count correction",
    });

    expect(result.type).toBe("adjustment");
    expect(mockDb.stockMovement.create).toHaveBeenCalledOnce();
  });

  it("rejects adjustment without notes", async () => {
    const caller = createCaller(authenticatedCtx());
    await expect(
      caller.inventory.stockAdjustment({
        productId: "prod-1",
        quantity: 2,
        warehouseId: "wh-1",
        notes: "",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects demo tenant mutations", async () => {
    const demoCaller = createCaller({ ...authenticatedCtx(), isDemoTenant: true });
    await expect(
      demoCaller.inventory.stockAdjustment({
        productId: "prod-1",
        quantity: 2,
        warehouseId: "wh-1",
        notes: "Correction",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(unauthenticatedCtx());
    await expect(
      caller.inventory.stockAdjustment({
        productId: "prod-1",
        quantity: 2,
        warehouseId: "wh-1",
        notes: "Correction",
      })
    ).rejects.toThrow();
  });
});
