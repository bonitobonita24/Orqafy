/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Purchasing UI surface — tenant parity tests
 *
 * Covers the mutations wired by the Phase-8 purchasing UI scaffolding:
 *   vendor.update    — loadVendorForTenant guard
 *   vendor.deactivate — loadVendorForTenant guard
 *   po.update        — loadPoForTenant guard
 *   po.create        — tenantId injected from ctx, not input
 *   goodsReceipt.create — tenantId injected from ctx; loadPoForTenant cross-tenant guard
 *
 * Pattern mirrors vendor-tenant-parity.test.ts (Batch 32 Direction I close-out).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── DB mock ───────────────────────────────────────────────────────────────────
const {
  mockVendorFindUnique,
  mockVendorUpdate,
  mockPoFindUnique,
  mockPoFindFirst,
  mockPoCreate,
  mockPoItemCreate,
  mockPoItemAllocCreate,
  mockGrFindFirst,
  mockGrCreate,
  mockGrItemCreate,
  mockPoItemFindMany,
  mockPoUpdate,
  mockTransaction,
  mockProductFindMany,
} = vi.hoisted(() => ({
  mockVendorFindUnique: vi.fn(),
  mockVendorUpdate: vi.fn(),
  mockPoFindUnique: vi.fn(),
  mockPoFindFirst: vi.fn(),
  mockPoCreate: vi.fn(),
  mockPoItemCreate: vi.fn(),
  mockPoItemAllocCreate: vi.fn(),
  mockGrFindFirst: vi.fn(),
  mockGrCreate: vi.fn(),
  mockGrItemCreate: vi.fn(),
  mockPoItemFindMany: vi.fn(),
  mockPoUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockProductFindMany: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    vendor: { findMany: vi.fn(), findUnique: mockVendorFindUnique, create: vi.fn(), update: mockVendorUpdate, count: vi.fn() },
    purchaseOrder: { findMany: vi.fn(), findFirst: mockPoFindFirst, findUnique: mockPoFindUnique, create: mockPoCreate, update: mockPoUpdate, count: vi.fn() },
    purchaseOrderItem: { findMany: mockPoItemFindMany, create: mockPoItemCreate, update: vi.fn(), deleteMany: vi.fn() },
    purchaseOrderItemAllocation: { create: mockPoItemAllocCreate, update: vi.fn() },
    goodsReceipt: { findMany: vi.fn(), findFirst: mockGrFindFirst, findUnique: mockGrCreate, create: mockGrCreate, update: vi.fn(), count: vi.fn() },
    goodsReceiptItem: { create: mockGrItemCreate },
    stockMovement: { create: vi.fn() },
    projectExpense: { create: vi.fn() },
    // M7.2 — nested-FK tenant validation in po.create / goodsReceipt.create.
    product: { findMany: mockProductFindMany },
    project: { findMany: vi.fn() },
    warehouse: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: mockTransaction,
  },
  writeAuditLog: async (tx: any, entry: any) => {
    await tx.auditLog.create({ data: entry });
  },
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

import { purchasingRouter } from "@/server/trpc/routers/purchasing";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ purchasing: purchasingRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctx(tenantId: string) {
  return {
    req: makeReq(),
    userId: "user-1",
    // Real seeded admin role name (packages/db/src/seed/roles.ts). Was "Administrator",
    // which is NOT a seeded role — the D-2 R6 reactivate gate now checks real role names
    // (see purchasing.ts), so the actor must carry one a registered tenant actually has.
    roles: ["Tenant Super Admin"] as string[],
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const fakeVendorA = { id: "vendor-A", tenantId: "tenant-A", companyName: "Acme Co.", isActive: true, type: "direct" };
const fakeVendorB = { id: "vendor-B", tenantId: "tenant-B", companyName: "Other Corp", isActive: true, type: "direct" };
const fakePoA = { id: "po-A", tenantId: "tenant-A", poNumber: "PO-2401-0001", status: "draft", vendorId: "vendor-A" };
const fakePoB = { id: "po-B", tenantId: "tenant-B", poNumber: "PO-2401-0002", status: "draft", vendorId: "vendor-B" };

/**
 * Re-wire mockTransaction after vi.resetAllMocks() so it passes an appropriate
 * tx object to the callback. Each test that needs specific tx behaviour overrides
 * this with its own mockImplementation.
 */
function rewireDefaultTransaction() {
  mockTransaction.mockImplementation((fn: any) =>
    fn({
      vendor: { findUnique: mockVendorFindUnique, create: vi.fn(), update: mockVendorUpdate },
      purchaseOrder: { findUnique: mockPoFindUnique, create: mockPoCreate, update: mockPoUpdate },
      purchaseOrderItem: { findMany: mockPoItemFindMany, create: mockPoItemCreate },
      purchaseOrderItemAllocation: { create: mockPoItemAllocCreate },
      goodsReceipt: { create: mockGrCreate, findUnique: vi.fn().mockResolvedValue(null) },
      goodsReceiptItem: { create: mockGrItemCreate },
      stockMovement: { create: vi.fn() },
      projectExpense: { create: vi.fn() },
      accountingSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }),
  );
}

// ── vendor.update ─────────────────────────────────────────────────────────────
describe("vendor.update — tenant guard", () => {
  beforeEach(() => { vi.resetAllMocks(); rewireDefaultTransaction(); });

  it("allows update when vendor belongs to caller's tenant", async () => {
    mockVendorFindUnique.mockResolvedValueOnce(fakeVendorA);
    mockVendorUpdate.mockResolvedValueOnce({ ...fakeVendorA, companyName: "Acme Updated" });

    const result = await createCaller(ctx("tenant-A")).purchasing.vendor.update({
      id: "vendor-A",
      companyName: "Acme Updated",
    });

    expect(result.companyName).toBe("Acme Updated");
    expect(mockVendorUpdate).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when vendor belongs to a different tenant", async () => {
    mockVendorFindUnique.mockResolvedValueOnce(fakeVendorB); // tenant-B record

    await expect(
      createCaller(ctx("tenant-A")).purchasing.vendor.update({
        id: "vendor-B",
        companyName: "X",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockVendorUpdate).not.toHaveBeenCalled();
  });
});

// ── vendor.deactivate ─────────────────────────────────────────────────────────
describe("vendor.deactivate — tenant guard", () => {
  beforeEach(() => { vi.resetAllMocks(); rewireDefaultTransaction(); });

  it("deactivates when vendor belongs to caller's tenant", async () => {
    mockVendorFindUnique.mockResolvedValueOnce(fakeVendorA);
    mockVendorUpdate.mockResolvedValueOnce({ ...fakeVendorA, isActive: false });

    const result = await createCaller(ctx("tenant-A")).purchasing.vendor.deactivate({ id: "vendor-A" });

    expect(result.isActive).toBe(false);
    expect(mockVendorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it("throws NOT_FOUND when vendor belongs to a different tenant", async () => {
    mockVendorFindUnique.mockResolvedValueOnce(fakeVendorB);

    await expect(
      createCaller(ctx("tenant-A")).purchasing.vendor.deactivate({ id: "vendor-B" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockVendorUpdate).not.toHaveBeenCalled();
  });
});

// ── po.update ─────────────────────────────────────────────────────────────────
describe("po.update — tenant guard", () => {
  beforeEach(() => { vi.resetAllMocks(); rewireDefaultTransaction(); });

  it("allows update when PO belongs to caller's tenant (header only)", async () => {
    mockPoFindUnique.mockResolvedValueOnce(fakePoA); // loadPoForTenant — same tenant
    mockPoUpdate.mockResolvedValueOnce({ ...fakePoA, notes: "updated" });

    const result = await createCaller(ctx("tenant-A")).purchasing.po.update({
      id: "po-A",
      notes: "updated",
    });

    expect(result.notes).toBe("updated");
    expect(mockPoUpdate).toHaveBeenCalledOnce();
  });

  it("throws NOT_FOUND when PO belongs to a different tenant", async () => {
    // loadPoForTenant: returns a PO with tenantId=tenant-B while caller is tenant-A
    mockPoFindUnique.mockResolvedValueOnce({ ...fakePoB }); // tenantId: "tenant-B"

    await expect(
      createCaller(ctx("tenant-A")).purchasing.po.update({
        id: "po-B",
        notes: "hacked",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Update must not have been called
    expect(mockPoUpdate).not.toHaveBeenCalled();
  });
});

// ── po.create — tenantId from ctx ─────────────────────────────────────────────
describe("po.create — tenantId from ctx", () => {
  beforeEach(() => { vi.resetAllMocks(); rewireDefaultTransaction(); });

  it("injects ctx.tenantId (not from input) into purchaseOrder.create", async () => {
    mockVendorFindUnique.mockResolvedValueOnce({ id: "vendor-A", isActive: true, tenantId: "tenant-A" });
    mockPoFindFirst.mockResolvedValueOnce(null); // no existing PO for sequence
    const createdPo = { ...fakePoA };
    mockTransaction.mockImplementation((fn: any) =>
      fn({
        purchaseOrder: {
          create: mockPoCreate.mockResolvedValueOnce(createdPo),
          findUnique: vi.fn().mockResolvedValue({ ...createdPo, items: [], vendor: fakeVendorA }),
        },
        purchaseOrderItem: { create: mockPoItemCreate.mockResolvedValueOnce({ id: "poi-1" }) },
        purchaseOrderItemAllocation: { create: mockPoItemAllocCreate.mockResolvedValueOnce({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }),
    );

    await createCaller(ctx("tenant-A")).purchasing.po.create({
      vendorId: "vendor-A",
      items: [{ description: "Widget", quantity: 1, unitPrice: 10, allocations: [{ type: "company_expense", quantity: 1 }] }],
    });

    expect(mockPoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-A" }),
      }),
    );
  });
});

// ── goodsReceipt.create — cross-tenant PO guard ───────────────────────────────
describe("goodsReceipt.create — cross-tenant PO guard", () => {
  beforeEach(() => { vi.resetAllMocks(); rewireDefaultTransaction(); });

  it("throws NOT_FOUND when PO belongs to a different tenant", async () => {
    // loadPoForTenant is called first — returns a PO owned by tenant-B
    mockPoFindUnique.mockResolvedValueOnce({ ...fakePoB, status: "approved" });

    await expect(
      createCaller(ctx("tenant-A")).purchasing.goodsReceipt.create({
        purchaseOrderId: "po-B",
        items: [{ description: "Widget A", quantityExpected: 10, quantityReceived: 10 }],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("injects ctx.tenantId into goodsReceipt.create", async () => {
    // loadPoForTenant passes
    mockPoFindUnique
      .mockResolvedValueOnce({ ...fakePoA, status: "approved" }) // loadPoForTenant
      .mockResolvedValueOnce({                                     // full fetch for receipt creation
        ...fakePoA,
        status: "approved",
        items: [{ id: "poi-1", tenantId: "tenant-A", description: "Widget A", quantity: 10, unitPrice: 100, totalPrice: 1000, allocations: [] }],
      });
    mockGrFindFirst.mockResolvedValueOnce(null);
    const fakeGr = { id: "gr-1", tenantId: "tenant-A", grNumber: "GR-2401-0001", purchaseOrderId: "po-A", status: "pending", receivedAt: new Date() };
    mockTransaction.mockImplementation((fn: any) =>
      fn({
        goodsReceipt: { create: mockGrCreate.mockResolvedValueOnce(fakeGr), findUnique: vi.fn().mockResolvedValue({ ...fakeGr, items: [] }) },
        goodsReceiptItem: { create: mockGrItemCreate.mockResolvedValueOnce({}) },
        purchaseOrderItem: { findMany: mockPoItemFindMany.mockResolvedValueOnce([]) },
        purchaseOrder: { update: mockPoUpdate.mockResolvedValueOnce({}) },
        accountingSettings: { findUnique: vi.fn().mockResolvedValue(null) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }),
    );

    await createCaller(ctx("tenant-A")).purchasing.goodsReceipt.create({
      purchaseOrderId: "po-A",
      items: [{ description: "Widget A", quantityExpected: 10, quantityReceived: 10 }],
    });

    expect(mockGrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-A" }),
      }),
    );
  });

  it("auto-posts JE (DR inventory, CR AP) when default-account mapping is configured (§B)", async () => {
    mockPoFindUnique
      .mockResolvedValueOnce({ ...fakePoA, status: "approved" })
      .mockResolvedValueOnce({
        ...fakePoA,
        status: "approved",
        currency: "PHP",
        items: [
          {
            id: "poi-1",
            tenantId: "tenant-A",
            description: "Widget A",
            quantity: 10,
            quantityReceived: 0,
            unitPrice: 100,
            totalPrice: 1000,
            productId: "prod-1",
            allocations: [{ id: "alloc-1", type: "stock", quantity: 10, warehouseId: "wh-1", projectId: null }],
          },
        ],
      });
    mockGrFindFirst.mockResolvedValueOnce(null);
    mockProductFindMany.mockResolvedValueOnce([{ id: "prod-1" }]); // M7.2 — tenant-owned productId
    const fakeGr = { id: "gr-2", tenantId: "tenant-A", grNumber: "GR-2401-0002", purchaseOrderId: "po-A", status: "accepted" };
    const jeCreate = vi.fn().mockResolvedValue({ id: "je-1", entryNumber: "JE-0001" });
    mockTransaction.mockImplementation((fn: any) =>
      fn({
        goodsReceipt: { create: mockGrCreate.mockResolvedValueOnce(fakeGr), findUnique: vi.fn().mockResolvedValue({ ...fakeGr, items: [] }) },
        goodsReceiptItem: { create: mockGrItemCreate.mockResolvedValueOnce({}) },
        stockMovement: { create: vi.fn() },
        projectExpense: { create: vi.fn() },
        purchaseOrderItemAllocation: { update: vi.fn() },
        purchaseOrderItem: { findMany: mockPoItemFindMany.mockResolvedValueOnce([{ quantityReceived: 10, quantity: 10 }]), update: vi.fn() },
        purchaseOrder: { update: mockPoUpdate.mockResolvedValueOnce({}) },
        accountingSettings: {
          findUnique: vi.fn().mockResolvedValue({
            tenantId: "tenant-A",
            defaultInventoryAccountId: "acct-inv",
            defaultApAccountId: "acct-ap",
            defaultExpenseAccountId: "acct-exp",
            defaultFiscalYearId: "fy-1",
          }),
        },
        fiscalYear: { findUnique: vi.fn().mockResolvedValue({ id: "fy-1", tenantId: "tenant-A", isClosed: false }) },
        account: {
          findMany: vi.fn().mockResolvedValue([
            { id: "acct-inv", tenantId: "tenant-A", isActive: true, name: "Inventory" },
            { id: "acct-ap", tenantId: "tenant-A", isActive: true, name: "AP" },
          ]),
        },
        journalEntry: { count: vi.fn().mockResolvedValue(0), create: jeCreate },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }),
    );

    await createCaller(ctx("tenant-A")).purchasing.goodsReceipt.create({
      purchaseOrderId: "po-A",
      items: [{ description: "Widget A", productId: "prod-1", quantityExpected: 10, quantityReceived: 10 }],
    });

    // JE posted: DR Inventory 1000 / CR AP 1000, tenant-scoped.
    expect(jeCreate).toHaveBeenCalled();
    const jeArgs = jeCreate.mock.calls[0]?.[0] as { data: { tenantId: string; status: string; referenceType: string } };
    expect(jeArgs.data.tenantId).toBe("tenant-A");
    expect(jeArgs.data.status).toBe("posted");
    expect(jeArgs.data.referenceType).toBe("goods_receipt");
  });
});

// ── D-2 R6 — vendor.reactivate (role gate + tenant guard + audit) ──────────────
describe("vendor.reactivate — D-2 R6", () => {
  beforeEach(() => { vi.resetAllMocks(); rewireDefaultTransaction(); });

  it("reactivates a deactivated vendor for a tenant admin", async () => {
    mockVendorFindUnique.mockResolvedValueOnce({ ...fakeVendorA, isActive: false });
    mockVendorUpdate.mockResolvedValueOnce({ ...fakeVendorA, isActive: true });

    const result = await createCaller(ctx("tenant-A")).purchasing.vendor.reactivate({ id: "vendor-A" });

    expect(result.isActive).toBe(true);
    expect(mockVendorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } }),
    );
  });

  it("forbids reactivation for a non-privileged role", async () => {
    const lowCtx = { ...ctx("tenant-A"), roles: ["Sales"] as string[] };
    await expect(
      createCaller(lowCtx).purchasing.vendor.reactivate({ id: "vendor-A" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockVendorUpdate).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when vendor belongs to a different tenant", async () => {
    mockVendorFindUnique.mockResolvedValueOnce({ ...fakeVendorB, isActive: false });
    await expect(
      createCaller(ctx("tenant-A")).purchasing.vendor.reactivate({ id: "vendor-B" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockVendorUpdate).not.toHaveBeenCalled();
  });
});

// ── D-2 R1 — PO VAT compute + R6 deactivated-vendor block ──────────────────────
describe("po.create — D-2 R1 VAT compute + R6 vendor guard", () => {
  beforeEach(() => { vi.resetAllMocks(); rewireDefaultTransaction(); });

  function wirePoCreateTx() {
    mockTransaction.mockImplementation((fn: any) =>
      fn({
        purchaseOrder: {
          create: mockPoCreate.mockResolvedValueOnce({ id: "po-new", poNumber: "PO-2401-0009", vendorId: "vendor-A", status: "draft", totalAmount: 0 }),
          findUnique: vi.fn().mockResolvedValue({ id: "po-new", items: [] }),
        },
        purchaseOrderItem: { create: mockPoItemCreate.mockResolvedValue({ id: "poi-new" }) },
        purchaseOrderItemAllocation: { create: vi.fn() },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
  }

  it("auto-computes 12% exclusive VAT on a non-exempt PO", async () => {
    mockVendorFindUnique.mockResolvedValueOnce(fakeVendorA); // isActive true, tenant-A
    wirePoCreateTx();

    await createCaller(ctx("tenant-A")).purchasing.po.create({
      vendorId: "vendor-A",
      currency: "PHP",
      isVatExempt: false,
      items: [{ description: "Widget", quantity: 2, unitPrice: 500 }],
    });

    // subtotal 1000 → VAT 120 → total 1120.
    const data = mockPoCreate.mock.calls[0]?.[0]?.data as { subtotal: number; taxAmount: number; totalAmount: number; isVatExempt: boolean };
    expect(data.subtotal).toBe(1000);
    expect(data.taxAmount).toBe(120);
    expect(data.totalAmount).toBe(1120);
    expect(data.isVatExempt).toBe(false);
  });

  it("suppresses VAT on a VAT-exempt PO", async () => {
    mockVendorFindUnique.mockResolvedValueOnce(fakeVendorA);
    wirePoCreateTx();

    await createCaller(ctx("tenant-A")).purchasing.po.create({
      vendorId: "vendor-A",
      currency: "PHP",
      isVatExempt: true,
      items: [{ description: "Widget", quantity: 2, unitPrice: 500 }],
    });

    const data = mockPoCreate.mock.calls[0]?.[0]?.data as { taxAmount: number; totalAmount: number; isVatExempt: boolean };
    expect(data.taxAmount).toBe(0);
    expect(data.totalAmount).toBe(1000);
    expect(data.isVatExempt).toBe(true);
  });

  it("blocks creating a PO against a deactivated vendor (R6)", async () => {
    mockVendorFindUnique.mockResolvedValueOnce({ ...fakeVendorA, isActive: false });
    await expect(
      createCaller(ctx("tenant-A")).purchasing.po.create({
        vendorId: "vendor-A",
        currency: "PHP",
        items: [{ description: "Widget", quantity: 1, unitPrice: 100 }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockPoCreate).not.toHaveBeenCalled();
  });
});

// ── D-2 R3 — goodsReceipt over-receipt tolerance ──────────────────────────────
describe("goodsReceipt.create — D-2 R3 over-receipt tolerance", () => {
  beforeEach(() => { vi.resetAllMocks(); rewireDefaultTransaction(); });

  function wirePoForReceipt(quantityReceived = 0) {
    mockPoFindUnique
      .mockResolvedValueOnce({ ...fakePoA, status: "approved" }) // loadPoForTenant
      .mockResolvedValueOnce({
        ...fakePoA,
        status: "approved",
        currency: "PHP",
        isVatExempt: false,
        items: [{ id: "poi-1", tenantId: "tenant-A", description: "Widget A", quantity: 10, quantityReceived, unitPrice: 100, totalPrice: 1000, productId: null, allocations: [] }],
      });
    mockGrFindFirst.mockResolvedValueOnce(null);
    const fakeGr = { id: "gr-9", tenantId: "tenant-A", grNumber: "GR-2401-0009", purchaseOrderId: "po-A", status: "accepted" };
    mockTransaction.mockImplementation((fn: any) =>
      fn({
        goodsReceipt: { create: mockGrCreate.mockResolvedValueOnce(fakeGr), findUnique: vi.fn().mockResolvedValue({ ...fakeGr, items: [] }) },
        goodsReceiptItem: { create: mockGrItemCreate.mockResolvedValue({}) },
        stockMovement: { create: vi.fn() },
        projectExpense: { create: vi.fn() },
        purchaseOrderItemAllocation: { update: vi.fn() },
        purchaseOrderItem: { findMany: mockPoItemFindMany.mockResolvedValueOnce([{ quantityReceived: 0, quantity: 10 }]), update: vi.fn() },
        purchaseOrder: { update: mockPoUpdate.mockResolvedValueOnce({}) },
        accountingSettings: { findUnique: vi.fn().mockResolvedValue(null) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
  }

  it("rejects >10% over-receipt without a reason", async () => {
    wirePoForReceipt(0);
    await expect(
      createCaller(ctx("tenant-A")).purchasing.goodsReceipt.create({
        purchaseOrderId: "po-A",
        items: [{ description: "Widget A", quantityExpected: 10, quantityReceived: 12 }], // 12 > 10*1.1
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockGrCreate).not.toHaveBeenCalled();
  });

  it("allows >10% over-receipt when a reason is supplied", async () => {
    wirePoForReceipt(0);
    await createCaller(ctx("tenant-A")).purchasing.goodsReceipt.create({
      purchaseOrderId: "po-A",
      items: [{ description: "Widget A", quantityExpected: 10, quantityReceived: 12 }],
      overReceiptReason: "Vendor shipped a full carton.",
    });
    expect(mockGrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ overReceiptReason: "Vendor shipped a full carton." }),
      }),
    );
  });

  it("allows within-tolerance over-receipt (≤10%) without a reason", async () => {
    wirePoForReceipt(0);
    await createCaller(ctx("tenant-A")).purchasing.goodsReceipt.create({
      purchaseOrderId: "po-A",
      items: [{ description: "Widget A", quantityExpected: 10, quantityReceived: 11 }], // exactly 10% over
    });
    expect(mockGrCreate).toHaveBeenCalled();
  });
});
