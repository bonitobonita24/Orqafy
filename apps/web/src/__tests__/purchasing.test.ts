/**
 * Phase 8 Batch 4 Item 3 — Module 4 Purchasing Phase 1
 *
 * vendorRouter:    list / byId / create / update / deactivate
 * poRouter:        list / byId / create / update / submit / approve / markOrdered / cancel
 * goodsReceiptRouter: list / byId / create (atomic w/ stock + project_expense allocation routing)
 *
 * Schema-adapted from spec (Item 3 reconciled vs actual Prisma):
 *  - Vendor.companyName (not "name"); no "code" field
 *  - PurchaseOrder.taxAmount (not "tax"); no paymentStatus/paymentFundSourceId
 *  - PurchaseOrder.status: draft|pending_approval|approved|ordered|partially_received|received|cancelled
 *  - GoodsReceiptItem keyed by productId (not allocationId); allocation routing computed proportionally
 *  - PurchaseOrderItem uses unitPrice/totalPrice (not unitCost/lineTotal)
 *  - PurchaseOrderItemAllocation.itemId (not poLineId); processedAt? marks routed allocations
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { purchasingRouter } from "@/server/trpc/routers/purchasing";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

vi.mock("@orqafy/db", () => ({
  prisma: {
    vendor: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    purchaseOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    purchaseOrderItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    purchaseOrderItemAllocation: {
      create: vi.fn(),
      update: vi.fn(),
    },
    goodsReceipt: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    goodsReceiptItem: {
      create: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
    },
    projectExpense: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const testRouter = createTRPCRouter({ purchasing: purchasingRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
type MockFn = ReturnType<typeof vi.fn>;
const mockDb = db as unknown as {
  vendor: { findMany: MockFn; findUnique: MockFn; create: MockFn; update: MockFn; count: MockFn };
  purchaseOrder: { findMany: MockFn; findFirst: MockFn; findUnique: MockFn; create: MockFn; update: MockFn; count: MockFn };
  purchaseOrderItem: { findMany: MockFn; create: MockFn; update: MockFn; deleteMany: MockFn };
  purchaseOrderItemAllocation: { create: MockFn; update: MockFn };
  goodsReceipt: { findMany: MockFn; findFirst: MockFn; findUnique: MockFn; create: MockFn; update: MockFn; count: MockFn };
  goodsReceiptItem: { create: MockFn };
  stockMovement: { create: MockFn };
  projectExpense: { create: MockFn };
  $transaction: MockFn;
};

// ── Context factories ─────────────────────────────────────────────────────────

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {} as NextRequest;
}
function adminCtx() {
  return {
    req: makeReq(),
    userId: "user-admin",
    roles: ["Administrator"] as string[],
    tenantSlug: "acme",
    tenantId: "tenant-acme",
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}
function staffCtx() {
  return { ...adminCtx(), userId: "user-staff", roles: ["Staff"] as string[] };
}
function purchasingMgrCtx() {
  return { ...adminCtx(), userId: "user-pm", roles: ["Purchasing Manager"] as string[] };
}

// ── Fake fixtures ─────────────────────────────────────────────────────────────

const fakeVendor = {
  id: "vendor-1",
  tenantId: "tenant-acme",
  type: "direct",
  companyName: "Acme Supplies Co.",
  contactName: "John Doe",
  email: "john@acme.com",
  phone: "555-1234",
  address: "123 Main",
  city: null,
  province: null,
  postalCode: null,
  country: "PH",
  taxId: null,
  platformUrl: null,
  platformName: null,
  paymentTerms: "NET30",
  notes: null,
  isActive: true,
  metadata: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const fakePoBase = {
  id: "po-1",
  tenantId: "tenant-acme",
  poNumber: "PO-2401-0001",
  vendorId: "vendor-1",
  createdById: "user-admin",
  approvedById: null,
  status: "draft",
  subtotal: 250,
  taxAmount: 0,
  totalAmount: 250,
  currency: "PHP",
  expectedDelivery: null,
  approvedAt: null,
  orderedAt: null,
  notes: null,
  metadata: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// VENDOR
// ═════════════════════════════════════════════════════════════════════════════

describe("purchasing.vendor.list", () => {
  it("returns paginated vendors", async () => {
    mockDb.vendor.findMany.mockResolvedValue([fakeVendor]);
    mockDb.vendor.count.mockResolvedValue(1);
    const result = await createCaller(adminCtx()).purchasing.vendor.list({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe("vendor-1");
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it("filters by isActive", async () => {
    mockDb.vendor.findMany.mockResolvedValue([]);
    mockDb.vendor.count.mockResolvedValue(0);
    await createCaller(adminCtx()).purchasing.vendor.list({ isActive: false });
    expect(mockDb.vendor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: false }) }),
    );
  });
});

describe("purchasing.vendor.byId", () => {
  it("returns vendor when found", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(fakeVendor);
    const result = await createCaller(adminCtx()).purchasing.vendor.byId({ id: "vendor-1" });
    expect(result.companyName).toBe("Acme Supplies Co.");
  });

  it("throws NOT_FOUND when vendor missing", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(null);
    await expect(
      createCaller(adminCtx()).purchasing.vendor.byId({ id: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("purchasing.vendor.create", () => {
  it("creates vendor with required companyName", async () => {
    mockDb.vendor.create.mockResolvedValue(fakeVendor);
    const result = await createCaller(adminCtx()).purchasing.vendor.create({
      companyName: "Acme Supplies Co.",
    });
    expect(result.companyName).toBe("Acme Supplies Co.");
    expect(mockDb.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyName: "Acme Supplies Co.", type: "direct" }),
      }),
    );
  });

  it("rejects with optional invalid email", async () => {
    await expect(
      createCaller(adminCtx()).purchasing.vendor.create({
        companyName: "X",
        email: "not-an-email",
      }),
    ).rejects.toThrow();
  });
});

describe("purchasing.vendor.update", () => {
  it("updates partial fields", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(fakeVendor);
    mockDb.vendor.update.mockResolvedValue({ ...fakeVendor, companyName: "New Name" });
    const result = await createCaller(adminCtx()).purchasing.vendor.update({
      id: "vendor-1",
      companyName: "New Name",
    });
    expect(result.companyName).toBe("New Name");
  });

  it("throws NOT_FOUND when missing", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(null);
    await expect(
      createCaller(adminCtx()).purchasing.vendor.update({ id: "missing", companyName: "X" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("purchasing.vendor.deactivate", () => {
  it("sets isActive=false", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(fakeVendor);
    mockDb.vendor.update.mockResolvedValue({ ...fakeVendor, isActive: false });
    const result = await createCaller(adminCtx()).purchasing.vendor.deactivate({ id: "vendor-1" });
    expect(result.isActive).toBe(false);
    expect(mockDb.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER
// ═════════════════════════════════════════════════════════════════════════════

describe("purchasing.po.list", () => {
  it("returns paginated POs with vendor included", async () => {
    mockDb.purchaseOrder.findMany.mockResolvedValue([{ ...fakePoBase, vendor: fakeVendor }]);
    mockDb.purchaseOrder.count.mockResolvedValue(1);
    const result = await createCaller(adminCtx()).purchasing.po.list({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe("po-1");
  });

  it("filters by status", async () => {
    mockDb.purchaseOrder.findMany.mockResolvedValue([]);
    mockDb.purchaseOrder.count.mockResolvedValue(0);
    await createCaller(adminCtx()).purchasing.po.list({ status: "draft" });
    expect(mockDb.purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "draft" }) }),
    );
  });
});

describe("purchasing.po.byId", () => {
  it("throws NOT_FOUND when missing", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(null);
    await expect(
      createCaller(adminCtx()).purchasing.po.byId({ id: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("purchasing.po.create", () => {
  const validInput = {
    vendorId: "vendor-1",
    items: [
      {
        productId: "prod-1",
        description: "Widget A",
        quantity: 10,
        unitPrice: 25,
        allocations: [
          { type: "stock" as const, quantity: 7, warehouseId: "wh-1" },
          { type: "project_expense" as const, quantity: 3, projectId: "proj-1" },
        ],
      },
    ],
  };

  function txMock(): void {
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb));
  }

  it("creates PO with computed totals + auto-generates poNumber", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(fakeVendor);
    mockDb.purchaseOrder.findFirst.mockResolvedValue(null);
    mockDb.purchaseOrder.create.mockResolvedValue(fakePoBase);
    mockDb.purchaseOrderItem.create.mockResolvedValue({ id: "poi-1" });
    mockDb.purchaseOrderItemAllocation.create.mockResolvedValue({});
    mockDb.purchaseOrder.findUnique.mockResolvedValue({
      ...fakePoBase,
      vendor: fakeVendor,
      items: [],
    });
    txMock();
    const result = await createCaller(adminCtx()).purchasing.po.create(validInput);
    expect(result).not.toBeNull();
    expect(mockDb.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorId: "vendor-1",
          createdById: "user-admin",
          status: "draft",
          subtotal: 250,
          totalAmount: 250,
          poNumber: expect.stringMatching(/^PO-\d{4}-\d{4}$/),
        }),
      }),
    );
    expect(mockDb.purchaseOrderItem.create).toHaveBeenCalledTimes(1);
    expect(mockDb.purchaseOrderItemAllocation.create).toHaveBeenCalledTimes(2);
  });

  it("rejects when allocations don't sum to item quantity", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(fakeVendor);
    await expect(
      createCaller(adminCtx()).purchasing.po.create({
        ...validInput,
        items: [
          {
            ...validInput.items[0]!,
            allocations: [{ type: "stock", quantity: 5, warehouseId: "wh-1" }], // sum=5, item.qty=10
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects stock allocation missing warehouseId", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(fakeVendor);
    await expect(
      createCaller(adminCtx()).purchasing.po.create({
        ...validInput,
        items: [
          {
            ...validInput.items[0]!,
            allocations: [{ type: "stock", quantity: 10 }], // missing warehouseId
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects project_expense allocation missing projectId", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(fakeVendor);
    await expect(
      createCaller(adminCtx()).purchasing.po.create({
        ...validInput,
        items: [
          {
            ...validInput.items[0]!,
            allocations: [{ type: "project_expense", quantity: 10 }], // missing projectId
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when vendor missing", async () => {
    mockDb.vendor.findUnique.mockResolvedValue(null);
    await expect(
      createCaller(adminCtx()).purchasing.po.create(validInput),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("purchasing.po.update", () => {
  it("rejects when status !== draft", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({ ...fakePoBase, status: "approved" });
    await expect(
      createCaller(adminCtx()).purchasing.po.update({ id: "po-1", notes: "X" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("purchasing.po.submit", () => {
  it("transitions draft → pending_approval", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(fakePoBase);
    mockDb.purchaseOrder.update.mockResolvedValue({ ...fakePoBase, status: "pending_approval" });
    const result = await createCaller(adminCtx()).purchasing.po.submit({ id: "po-1" });
    expect(result.status).toBe("pending_approval");
  });

  it("rejects when not in draft", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({ ...fakePoBase, status: "approved" });
    await expect(
      createCaller(adminCtx()).purchasing.po.submit({ id: "po-1" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("purchasing.po.approve", () => {
  it("Administrator can approve pending_approval PO", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({ ...fakePoBase, status: "pending_approval" });
    mockDb.purchaseOrder.update.mockResolvedValue({
      ...fakePoBase,
      status: "approved",
      approvedById: "user-admin",
      approvedAt: new Date(),
    });
    const result = await createCaller(adminCtx()).purchasing.po.approve({ id: "po-1" });
    expect(result.status).toBe("approved");
    expect(result.approvedById).toBe("user-admin");
  });

  it("Purchasing Manager can approve", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({ ...fakePoBase, status: "pending_approval" });
    mockDb.purchaseOrder.update.mockResolvedValue({ ...fakePoBase, status: "approved" });
    const result = await createCaller(purchasingMgrCtx()).purchasing.po.approve({ id: "po-1" });
    expect(result.status).toBe("approved");
  });

  it("Staff role denied (FORBIDDEN)", async () => {
    await expect(
      createCaller(staffCtx()).purchasing.po.approve({ id: "po-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects when not in pending_approval", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(fakePoBase); // status=draft
    await expect(
      createCaller(adminCtx()).purchasing.po.approve({ id: "po-1" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("purchasing.po.cancel", () => {
  it("cancels draft PO", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(fakePoBase);
    mockDb.purchaseOrder.update.mockResolvedValue({ ...fakePoBase, status: "cancelled" });
    const result = await createCaller(adminCtx()).purchasing.po.cancel({ id: "po-1" });
    expect(result.status).toBe("cancelled");
  });

  it("rejects cancel of received PO (not cancellable)", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({ ...fakePoBase, status: "received" });
    await expect(
      createCaller(adminCtx()).purchasing.po.cancel({ id: "po-1" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GOODS RECEIPT — atomic allocation routing
// ═════════════════════════════════════════════════════════════════════════════

const approvedPoWithItem = {
  ...fakePoBase,
  status: "approved",
  items: [
    {
      id: "poi-1",
      purchaseOrderId: "po-1",
      productId: "prod-1",
      description: "Widget A",
      unit: "pcs",
      quantity: 10,
      unitPrice: 25,
      totalPrice: 250,
      quantityReceived: 0,
      sortOrder: 0,
      allocations: [
        {
          id: "alloc-stock",
          itemId: "poi-1",
          type: "stock",
          quantity: 7,
          projectId: null,
          warehouseId: "wh-1",
          processedAt: null,
        },
        {
          id: "alloc-proj",
          itemId: "poi-1",
          type: "project_expense",
          quantity: 3,
          projectId: "proj-1",
          warehouseId: null,
          processedAt: null,
        },
      ],
    },
  ],
};

function txPassthrough(): void {
  mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb));
}

describe("purchasing.goodsReceipt.list", () => {
  it("returns paginated receipts filtered by PO", async () => {
    mockDb.goodsReceipt.findMany.mockResolvedValue([]);
    mockDb.goodsReceipt.count.mockResolvedValue(0);
    const result = await createCaller(adminCtx()).purchasing.goodsReceipt.list({
      purchaseOrderId: "po-1",
    });
    expect(result.items).toHaveLength(0);
    expect(mockDb.goodsReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ purchaseOrderId: "po-1" }) }),
    );
  });
});

describe("purchasing.goodsReceipt.byId", () => {
  it("throws NOT_FOUND when missing", async () => {
    mockDb.goodsReceipt.findUnique.mockResolvedValue(null);
    await expect(
      createCaller(adminCtx()).purchasing.goodsReceipt.byId({ id: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("purchasing.goodsReceipt.create — full receipt", () => {
  it("matches by productId → routes stock + project_expense allocations atomically", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(approvedPoWithItem);
    mockDb.goodsReceipt.findFirst.mockResolvedValue(null);
    mockDb.goodsReceipt.create.mockResolvedValue({
      id: "gr-1",
      grNumber: "GR-2401-0001",
      purchaseOrderId: "po-1",
      receivedById: "user-admin",
      status: "accepted",
      receivedAt: new Date(),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDb.goodsReceiptItem.create.mockResolvedValue({});
    mockDb.purchaseOrderItem.update.mockResolvedValue({});
    mockDb.stockMovement.create.mockResolvedValue({});
    mockDb.projectExpense.create.mockResolvedValue({});
    mockDb.purchaseOrderItemAllocation.update.mockResolvedValue({});
    mockDb.purchaseOrderItem.findMany.mockResolvedValue([
      { id: "poi-1", purchaseOrderId: "po-1", quantity: 10, quantityReceived: 10 },
    ]);
    mockDb.purchaseOrder.update.mockResolvedValue({ ...approvedPoWithItem, status: "received" });
    mockDb.goodsReceipt.findUnique.mockResolvedValue({
      id: "gr-1",
      grNumber: "GR-2401-0001",
      status: "accepted",
      items: [],
    });
    txPassthrough();

    const result = await createCaller(adminCtx()).purchasing.goodsReceipt.create({
      purchaseOrderId: "po-1",
      items: [
        {
          productId: "prod-1",
          description: "Widget A",
          quantityExpected: 10,
          quantityReceived: 10,
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(mockDb.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "in",
          productId: "prod-1",
          toWarehouseId: "wh-1",
          referenceType: "goods_receipt",
          createdById: "user-admin",
        }),
      }),
    );
    expect(mockDb.projectExpense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "proj-1",
          type: "inventory_consumed",
          referenceType: "goods_receipt",
        }),
      }),
    );
    expect(mockDb.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "received" }) }),
    );
  });
});

describe("purchasing.goodsReceipt.create — partial receipt", () => {
  it("receives 5 of 10 → PO.status = partially_received", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(approvedPoWithItem);
    mockDb.goodsReceipt.findFirst.mockResolvedValue(null);
    mockDb.goodsReceipt.create.mockResolvedValue({
      id: "gr-1",
      grNumber: "GR-2401-0001",
      purchaseOrderId: "po-1",
      receivedById: "user-admin",
      status: "accepted",
      receivedAt: new Date(),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDb.goodsReceiptItem.create.mockResolvedValue({});
    mockDb.purchaseOrderItem.update.mockResolvedValue({});
    mockDb.stockMovement.create.mockResolvedValue({});
    mockDb.projectExpense.create.mockResolvedValue({});
    mockDb.purchaseOrderItemAllocation.update.mockResolvedValue({});
    mockDb.purchaseOrderItem.findMany.mockResolvedValue([
      { id: "poi-1", purchaseOrderId: "po-1", quantity: 10, quantityReceived: 5 },
    ]);
    mockDb.purchaseOrder.update.mockResolvedValue({});
    mockDb.goodsReceipt.findUnique.mockResolvedValue({
      id: "gr-1",
      grNumber: "GR-2401-0001",
      status: "accepted",
      items: [],
    });
    txPassthrough();

    await createCaller(adminCtx()).purchasing.goodsReceipt.create({
      purchaseOrderId: "po-1",
      items: [
        {
          productId: "prod-1",
          description: "Widget A",
          quantityExpected: 10,
          quantityReceived: 5,
        },
      ],
    });

    expect(mockDb.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "partially_received" }),
      }),
    );
  });
});

describe("purchasing.goodsReceipt.create — validation", () => {
  it("rejects when PO status is draft", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({ ...approvedPoWithItem, status: "draft" });
    await expect(
      createCaller(adminCtx()).purchasing.goodsReceipt.create({
        purchaseOrderId: "po-1",
        items: [
          {
            productId: "prod-1",
            description: "Widget A",
            quantityExpected: 10,
            quantityReceived: 5,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND when PO missing", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(null);
    await expect(
      createCaller(adminCtx()).purchasing.goodsReceipt.create({
        purchaseOrderId: "missing",
        items: [
          {
            productId: "prod-1",
            description: "Widget A",
            quantityExpected: 10,
            quantityReceived: 5,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("purchasing.goodsReceipt.create — atomic rollback", () => {
  it("rolls back when $transaction throws", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(approvedPoWithItem);
    mockDb.goodsReceipt.findFirst.mockResolvedValue(null);
    mockDb.$transaction.mockRejectedValueOnce(new Error("simulated rollback"));
    await expect(
      createCaller(adminCtx()).purchasing.goodsReceipt.create({
        purchaseOrderId: "po-1",
        items: [
          {
            productId: "prod-1",
            description: "Widget A",
            quantityExpected: 10,
            quantityReceived: 10,
          },
        ],
      }),
    ).rejects.toThrow(/simulated rollback/);
    // Outer mocks (those called outside $transaction) are not invoked
    expect(mockDb.stockMovement.create).not.toHaveBeenCalled();
    expect(mockDb.projectExpense.create).not.toHaveBeenCalled();
    expect(mockDb.goodsReceiptItem.create).not.toHaveBeenCalled();
  });
});

// ─── Batch 26 Direction I — PurchaseOrder.tenantId parity ─────────────────────
describe("purchasing.po — Direction I tenantId scoping (RED)", () => {
  it("scopes list findMany WHERE by ctx.tenantId", async () => {
    mockDb.purchaseOrder.findMany.mockResolvedValue([]);
    mockDb.purchaseOrder.count.mockResolvedValue(0);
    await createCaller(adminCtx()).purchasing.po.list({});
    expect(mockDb.purchaseOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-acme" }),
      }),
    );
  });

  it("passes ctx.tenantId on purchaseOrder.create", async () => {
    mockDb.vendor.findUnique.mockResolvedValue({ id: "vendor-1", isActive: true });
    mockDb.purchaseOrder.findFirst.mockResolvedValue(null);
    mockDb.purchaseOrder.create.mockResolvedValue({ ...fakePoBase });
    mockDb.purchaseOrderItem.create.mockResolvedValue({ id: "poi-1" });
    mockDb.purchaseOrder.findUnique.mockResolvedValue({
      ...fakePoBase,
      items: [],
      vendor: fakeVendor,
    });
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));

    await createCaller(adminCtx()).purchasing.po.create({
      vendorId: "vendor-1",
      items: [
        {
          description: "Widget A",
          quantity: 10,
          unitPrice: 100,
          allocations: [{ type: "company_expense", quantity: 10 }],
        },
      ],
    });
    expect(mockDb.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-acme" }),
      }),
    );
  });

  it("byId throws NOT_FOUND when PO tenantId mismatches ctx.tenantId", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({
      ...fakePoBase,
      tenantId: "tenant-other",
      items: [],
      vendor: fakeVendor,
    });
    await expect(
      createCaller(adminCtx()).purchasing.po.byId({ id: "po-1" }),
    ).rejects.toThrow();
  });
});

describe("purchasing.po — Direction I-2 PurchaseOrderItem tenantId scoping (RED)", () => {
  it("passes ctx.tenantId on purchaseOrderItem.create inside po.create transaction", async () => {
    mockDb.vendor.findUnique.mockResolvedValue({ id: "vendor-1", isActive: true });
    mockDb.purchaseOrder.findFirst.mockResolvedValue(null);
    mockDb.purchaseOrder.create.mockResolvedValue({ ...fakePoBase });
    mockDb.purchaseOrderItem.create.mockResolvedValue({ id: "poi-1" });
    mockDb.purchaseOrderItemAllocation.create.mockResolvedValue({});
    mockDb.purchaseOrder.findUnique.mockResolvedValue({
      ...fakePoBase,
      items: [],
      vendor: fakeVendor,
    });
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));

    await createCaller(adminCtx()).purchasing.po.create({
      vendorId: "vendor-1",
      items: [
        {
          description: "Widget A",
          quantity: 10,
          unitPrice: 100,
          allocations: [{ type: "company_expense", quantity: 10 }],
        },
      ],
    });
    expect(mockDb.purchaseOrderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-acme" }),
      }),
    );
  });
});

describe("purchasing.po — Direction I-3 PurchaseOrderItemAllocation tenantId scoping (RED)", () => {
  it("passes ctx.tenantId on purchaseOrderItemAllocation.create inside po.create transaction", async () => {
    mockDb.vendor.findUnique.mockResolvedValue({ id: "vendor-1", isActive: true });
    mockDb.purchaseOrder.findFirst.mockResolvedValue(null);
    mockDb.purchaseOrder.create.mockResolvedValue({ ...fakePoBase });
    mockDb.purchaseOrderItem.create.mockResolvedValue({ id: "poi-1" });
    mockDb.purchaseOrderItemAllocation.create.mockResolvedValue({});
    mockDb.purchaseOrder.findUnique.mockResolvedValue({
      ...fakePoBase,
      items: [],
      vendor: fakeVendor,
    });
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));

    await createCaller(adminCtx()).purchasing.po.create({
      vendorId: "vendor-1",
      items: [
        {
          description: "Widget A",
          quantity: 10,
          unitPrice: 100,
          allocations: [{ type: "company_expense", quantity: 10 }],
        },
      ],
    });
    expect(mockDb.purchaseOrderItemAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-acme" }),
      }),
    );
  });
});

describe("purchasing.po — Direction I-4 PurchaseOrder tenant-scoped status guards (RED)", () => {
  const otherTenantPo = {
    id: "po-cross",
    tenantId: "tenant-other",
    status: "draft" as const,
    poNumber: "PO-CROSS-0001",
    vendorId: "vendor-1",
    createdById: "user-admin",
    approvedById: null,
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    currency: "PHP",
    expectedDelivery: null,
    approvedAt: null,
    orderedAt: null,
    notes: null,
    metadata: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  it("update throws NOT_FOUND when po.tenantId !== ctx.tenantId", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(otherTenantPo);
    await expect(
      createCaller(adminCtx()).purchasing.po.update({ id: "po-cross", notes: "hijack" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("submit throws NOT_FOUND when po.tenantId !== ctx.tenantId", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(otherTenantPo);
    await expect(
      createCaller(adminCtx()).purchasing.po.submit({ id: "po-cross" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("approve throws NOT_FOUND when po.tenantId !== ctx.tenantId", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({ ...otherTenantPo, status: "pending_approval" as const });
    await expect(
      createCaller(adminCtx()).purchasing.po.approve({ id: "po-cross" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("markOrdered throws NOT_FOUND when po.tenantId !== ctx.tenantId", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({ ...otherTenantPo, status: "approved" as const });
    await expect(
      createCaller(adminCtx()).purchasing.po.markOrdered({ id: "po-cross" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cancel throws NOT_FOUND when po.tenantId !== ctx.tenantId", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue(otherTenantPo);
    await expect(
      createCaller(adminCtx()).purchasing.po.cancel({ id: "po-cross" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("purchasing.goodsReceipt — Direction I-5a tenant guards (RED)", () => {
  const fakeGrBase = {
    id: "gr-1",
    tenantId: "tenant-acme",
    grNumber: "GR-2401-0001",
    purchaseOrderId: "po-1",
    receivedById: "user-admin",
    status: "pending" as const,
    receivedAt: new Date(),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("create throws NOT_FOUND when PO belongs to another tenant", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({
      ...fakePoBase,
      tenantId: "tenant-other",
      status: "approved" as const,
      items: [],
    });
    await expect(
      createCaller(adminCtx()).purchasing.goodsReceipt.create({
        purchaseOrderId: "po-cross",
        items: [{ description: "Widget A", quantityExpected: 10, quantityReceived: 10 }],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("create passes ctx.tenantId on tx.goodsReceipt.create", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({
      ...fakePoBase,
      status: "approved" as const,
      items: [
        {
          id: "poi-1",
          tenantId: "tenant-acme",
          description: "Widget A",
          quantity: 10,
          unitPrice: 100,
          totalPrice: 1000,
          allocations: [],
        },
      ],
    });
    mockDb.goodsReceipt.findFirst.mockResolvedValue(null);
    mockDb.goodsReceipt.create.mockResolvedValue({ ...fakeGrBase });
    mockDb.goodsReceiptItem.create.mockResolvedValue({});
    mockDb.goodsReceipt.findUnique.mockResolvedValue({ ...fakeGrBase, items: [] });
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));

    await createCaller(adminCtx()).purchasing.goodsReceipt.create({
      purchaseOrderId: "po-1",
      items: [{ description: "Widget A", quantityExpected: 10, quantityReceived: 10 }],
    });
    expect(mockDb.goodsReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-acme" }),
      }),
    );
  });

  it("byId throws NOT_FOUND when gr belongs to another tenant", async () => {
    mockDb.goodsReceipt.findUnique.mockResolvedValue({ ...fakeGrBase, tenantId: "tenant-other" });
    await expect(
      createCaller(adminCtx()).purchasing.goodsReceipt.byId({ id: "gr-cross" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("purchasing.goodsReceipt — Direction I-5b GoodsReceiptItem tenantId scoping (RED)", () => {
  const fakeGrBase = {
    id: "gr-1",
    tenantId: "tenant-acme",
    grNumber: "GR-2401-0001",
    purchaseOrderId: "po-1",
    receivedById: "user-admin",
    status: "pending" as const,
    receivedAt: new Date(),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("create passes ctx.tenantId on tx.goodsReceiptItem.create", async () => {
    mockDb.purchaseOrder.findUnique.mockResolvedValue({
      ...fakePoBase,
      status: "approved" as const,
      items: [
        {
          id: "poi-1",
          tenantId: "tenant-acme",
          description: "Widget A",
          quantity: 10,
          unitPrice: 100,
          totalPrice: 1000,
          allocations: [],
        },
      ],
    });
    mockDb.goodsReceipt.findFirst.mockResolvedValue(null);
    mockDb.goodsReceipt.create.mockResolvedValue({ ...fakeGrBase });
    mockDb.goodsReceiptItem.create.mockResolvedValue({});
    mockDb.goodsReceipt.findUnique.mockResolvedValue({ ...fakeGrBase, items: [] });
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));

    await createCaller(adminCtx()).purchasing.goodsReceipt.create({
      purchaseOrderId: "po-1",
      items: [{ description: "Widget A", quantityExpected: 10, quantityReceived: 10 }],
    });
    expect(mockDb.goodsReceiptItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-acme" }),
      }),
    );
  });
});

