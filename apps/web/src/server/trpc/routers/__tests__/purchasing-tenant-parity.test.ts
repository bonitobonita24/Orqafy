/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Purchasing tenant parity (L3 RBAC + L5 AuditLog + tenant-scope isolation)
 *
 * Proves audit log is written for every purchasing mutation:
 *  1.  vendor.create   — injects tenantId + writes CREATE audit log
 *  2.  vendor.update   — throws NOT_FOUND for cross-tenant IDOR + writes UPDATE audit log
 *  3.  vendor.deactivate — throws NOT_FOUND for cross-tenant IDOR + writes UPDATE audit log
 *  4.  po.create       — injects tenantId + writes CREATE audit log
 *  5.  po.update       — throws NOT_FOUND for cross-tenant IDOR + writes UPDATE audit log
 *  6.  po.submit       — throws NOT_FOUND for cross-tenant IDOR + writes UPDATE audit log
 *  7.  po.approve      — throws FORBIDDEN when role missing + writes UPDATE audit log
 *  8.  po.markOrdered  — throws NOT_FOUND for cross-tenant IDOR + writes UPDATE audit log
 *  9.  po.cancel       — throws NOT_FOUND for cross-tenant IDOR + writes UPDATE audit log
 * 10.  goodsReceipt.create — injects tenantId + writes CREATE audit log
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const {
  mockVendorFindUnique,
  mockVendorCreate,
  mockVendorUpdate,
  mockPurchaseOrderFindUnique,
  mockPurchaseOrderFindFirst,
  mockPurchaseOrderCreate,
  mockPurchaseOrderUpdate,
  mockPurchaseOrderItemCreate,
  mockPurchaseOrderItemAllocationCreate,
  mockPurchaseOrderItemFindMany,
  mockGoodsReceiptFindFirst,
  mockGoodsReceiptCreate,
  mockGoodsReceiptFindUnique,
  mockGoodsReceiptFindMany,
  mockGoodsReceiptCount,
  mockGoodsReceiptItemCreate,
  mockAuditLogCreate,
  mockAccountingSettingsFindUnique,
  mockProductFindMany,
  mockProjectFindMany,
  mockWarehouseFindMany,
} = vi.hoisted(() => ({
  mockVendorFindUnique: vi.fn(),
  mockVendorCreate: vi.fn(),
  mockVendorUpdate: vi.fn(),
  mockPurchaseOrderFindUnique: vi.fn(),
  mockPurchaseOrderFindFirst: vi.fn(),
  mockPurchaseOrderCreate: vi.fn(),
  mockPurchaseOrderUpdate: vi.fn(),
  mockPurchaseOrderItemCreate: vi.fn(),
  mockPurchaseOrderItemAllocationCreate: vi.fn(),
  mockPurchaseOrderItemFindMany: vi.fn(),
  mockGoodsReceiptFindFirst: vi.fn(),
  mockGoodsReceiptCreate: vi.fn(),
  mockGoodsReceiptFindUnique: vi.fn(),
  mockGoodsReceiptFindMany: vi.fn(),
  mockGoodsReceiptCount: vi.fn(),
  mockGoodsReceiptItemCreate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockAccountingSettingsFindUnique: vi.fn(),
  mockProductFindMany: vi.fn(),
  mockProjectFindMany: vi.fn(),
  mockWarehouseFindMany: vi.fn(),
}));

vi.mock("@orqafy/db", () => {
  // mockDb is the object passed INTO the $transaction callback (represents the tx client).
  const mockDb = {
    vendor: {
      findUnique: mockVendorFindUnique,
      create: mockVendorCreate,
      update: mockVendorUpdate,
    },
    purchaseOrder: {
      findUnique: mockPurchaseOrderFindUnique,
      findFirst: mockPurchaseOrderFindFirst,
      create: mockPurchaseOrderCreate,
      update: mockPurchaseOrderUpdate,
    },
    purchaseOrderItem: {
      create: mockPurchaseOrderItemCreate,
      findMany: mockPurchaseOrderItemFindMany,
    },
    purchaseOrderItemAllocation: {
      create: mockPurchaseOrderItemAllocationCreate,
    },
    goodsReceipt: {
      findFirst: mockGoodsReceiptFindFirst,
      create: mockGoodsReceiptCreate,
      findUnique: mockGoodsReceiptFindUnique,
      findMany: mockGoodsReceiptFindMany,
      count: mockGoodsReceiptCount,
    },
    goodsReceiptItem: {
      create: mockGoodsReceiptItemCreate,
    },
    product: { findMany: mockProductFindMany },
    project: { findMany: mockProjectFindMany },
    warehouse: { findMany: mockWarehouseFindMany },
    auditLog: { create: mockAuditLogCreate },
    accountingSettings: { findUnique: mockAccountingSettingsFindUnique },
  };
  return {
    prisma: {
      ...mockDb,
      // $transaction passes mockDb as the "tx" argument so router tx.xxx calls
      // resolve to the same mocks as prisma.xxx calls.
      $transaction: vi.fn((fn: any) => fn(mockDb)),
    },
    writeAuditLog: async (tx: any, entry: any) => {
      await tx.auditLog.create({ data: entry });
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { vendorRouter, poRouter, goodsReceiptRouter } from "@/server/trpc/routers/purchasing";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({
  vendor: vendorRouter,
  po: poRouter,
  goodsReceipt: goodsReceiptRouter,
});
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(tenantId: string, opts: { isDemoTenant?: boolean; roles?: string[] } = {}) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: opts.roles ?? (["Administrator"] as string[]),
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: opts.isDemoTenant ?? false,
    session: null,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VENDOR_A = {
  id: "vendor-aaaaaaaaaaaaaaaaaaaaaaaa",
  tenantId: "tenant-A",
  type: "direct" as const,
  companyName: "Acme Supplies",
  contactName: "Bob",
  email: "bob@acme.com",
  phone: null,
  address: null,
  city: null,
  province: null,
  postalCode: null,
  country: "PH",
  taxId: null,
  platformUrl: null,
  platformName: null,
  paymentTerms: null,
  notes: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PO_DRAFT = {
  id: "po-aaaaaaaaaaaaaaaaaaaaaaaaaa",
  tenantId: "tenant-A",
  poNumber: "PO-2601-0001",
  vendorId: VENDOR_A.id,
  createdById: "user-1",
  approvedById: null,
  status: "draft",
  subtotal: 100,
  taxAmount: 0,
  totalAmount: 100,
  currency: "PHP",
  expectedDelivery: null,
  orderedAt: null,
  approvedAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PO_PENDING = { ...PO_DRAFT, status: "pending_approval" };
const PO_APPROVED = { ...PO_DRAFT, status: "approved" };

const GR_A = {
  id: "gr-aaaaaaaaaaaaaaaaaaaaaaaaaa",
  tenantId: "tenant-A",
  grNumber: "GR-2601-0001",
  purchaseOrderId: PO_APPROVED.id,
  receivedById: "user-1",
  status: "accepted",
  receivedAt: new Date(),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function rewireTransaction() {
  const { prisma } = await import("@orqafy/db");
  (prisma as any).$transaction.mockImplementation((fn: any) => {
    const mockDb = {
      vendor: {
        findUnique: mockVendorFindUnique,
        create: mockVendorCreate,
        update: mockVendorUpdate,
      },
      purchaseOrder: {
        findUnique: mockPurchaseOrderFindUnique,
        findFirst: mockPurchaseOrderFindFirst,
        create: mockPurchaseOrderCreate,
        update: mockPurchaseOrderUpdate,
      },
      purchaseOrderItem: {
        create: mockPurchaseOrderItemCreate,
        findMany: mockPurchaseOrderItemFindMany,
      },
      purchaseOrderItemAllocation: {
        create: mockPurchaseOrderItemAllocationCreate,
      },
      goodsReceipt: {
        findFirst: mockGoodsReceiptFindFirst,
        create: mockGoodsReceiptCreate,
        findUnique: mockGoodsReceiptFindUnique,
      },
      goodsReceiptItem: {
        create: mockGoodsReceiptItemCreate,
      },
      // JE auto-post (§B): unset mapping → auto-post skipped, original behavior preserved.
      accountingSettings: { findUnique: mockAccountingSettingsFindUnique },
      stockMovement: { create: vi.fn() },
      projectExpense: { create: vi.fn() },
      auditLog: { create: mockAuditLogCreate },
    };
    return fn(mockDb);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Purchasing tenant parity (L3 RBAC + L5 AuditLog + tenant-scope isolation)", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await rewireTransaction();
  });

  // ── vendor.create ─────────────────────────────────────────────────────────────
  describe("vendor.create", () => {
    it("injects tenantId from ctx into db.vendor.create", async () => {
      mockVendorCreate.mockResolvedValueOnce(VENDOR_A);
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.vendor.create({ companyName: "Acme Supplies" });

      expect(mockVendorCreate).toHaveBeenCalledOnce();
      const callArg = mockVendorCreate.mock.calls[0]![0];
      expect(callArg.data.tenantId).toBe("tenant-A");
    });

    it("writes audit log with action CREATE entity Vendor", async () => {
      mockVendorCreate.mockResolvedValueOnce(VENDOR_A);
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.vendor.create({ companyName: "Acme Supplies" });

      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("CREATE");
      expect(auditArg.data.entity).toBe("Vendor");
      expect(auditArg.data.entityId).toBe(VENDOR_A.id);
    });

    it("throws FORBIDDEN on demo tenant", async () => {
      const caller = createCaller(ctxForTenant("tenant-A", { isDemoTenant: true }));
      await expect(
        caller.vendor.create({ companyName: "Test" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  // ── vendor.update ─────────────────────────────────────────────────────────────
  describe("vendor.update", () => {
    it("throws NOT_FOUND for cross-tenant IDOR attempt", async () => {
      // loadVendorForTenant: findUnique returns vendor with wrong tenant
      mockVendorFindUnique.mockResolvedValueOnce({ ...VENDOR_A, tenantId: "tenant-B" });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.vendor.update({ id: VENDOR_A.id, companyName: "Evil" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(mockVendorUpdate).not.toHaveBeenCalled();
    });

    it("writes audit log with action UPDATE entity Vendor", async () => {
      mockVendorFindUnique.mockResolvedValueOnce(VENDOR_A);
      const updated = { ...VENDOR_A, companyName: "Acme Updated" };
      mockVendorUpdate.mockResolvedValueOnce(updated);
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.vendor.update({ id: VENDOR_A.id, companyName: "Acme Updated" });

      expect(mockVendorUpdate).toHaveBeenCalledOnce();
      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("UPDATE");
      expect(auditArg.data.entity).toBe("Vendor");
      expect(auditArg.data.entityId).toBe(VENDOR_A.id);
    });
  });

  // ── vendor.deactivate ─────────────────────────────────────────────────────────
  describe("vendor.deactivate", () => {
    it("throws NOT_FOUND for cross-tenant IDOR attempt", async () => {
      mockVendorFindUnique.mockResolvedValueOnce({ ...VENDOR_A, tenantId: "tenant-B" });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.vendor.deactivate({ id: VENDOR_A.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(mockVendorUpdate).not.toHaveBeenCalled();
    });

    it("writes audit log with action UPDATE entity Vendor isActive=false", async () => {
      mockVendorFindUnique.mockResolvedValueOnce(VENDOR_A);
      const deactivated = { ...VENDOR_A, isActive: false };
      mockVendorUpdate.mockResolvedValueOnce(deactivated);
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.vendor.deactivate({ id: VENDOR_A.id });

      expect(mockVendorUpdate).toHaveBeenCalledOnce();
      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("UPDATE");
      expect(auditArg.data.entity).toBe("Vendor");
      expect(auditArg.data.entityId).toBe(VENDOR_A.id);
      expect(auditArg.data.after).toMatchObject({ isActive: false });
    });
  });

  // ── po.create ────────────────────────────────────────────────────────────────
  describe("po.create", () => {
    it("injects tenantId from ctx into db.purchaseOrder.create", async () => {
      // vendor lookup (pre-transaction)
      mockVendorFindUnique.mockResolvedValueOnce(VENDOR_A);
      // poNumber generator
      mockPurchaseOrderFindFirst.mockResolvedValueOnce(null);
      mockPurchaseOrderCreate.mockResolvedValueOnce(PO_DRAFT);
      mockPurchaseOrderItemCreate.mockResolvedValueOnce({ id: "poi-1" });
      // final findUnique inside transaction
      mockPurchaseOrderFindUnique.mockResolvedValueOnce({ ...PO_DRAFT, items: [] });
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.po.create({
        vendorId: VENDOR_A.id,
        items: [{ description: "Widget", quantity: 1, unitPrice: 100 }],
      });

      expect(mockPurchaseOrderCreate).toHaveBeenCalledOnce();
      const callArg = mockPurchaseOrderCreate.mock.calls[0]![0];
      expect(callArg.data.tenantId).toBe("tenant-A");
    });

    it("writes audit log with action CREATE entity PurchaseOrder", async () => {
      mockVendorFindUnique.mockResolvedValueOnce(VENDOR_A);
      mockPurchaseOrderFindFirst.mockResolvedValueOnce(null);
      mockPurchaseOrderCreate.mockResolvedValueOnce(PO_DRAFT);
      mockPurchaseOrderItemCreate.mockResolvedValueOnce({ id: "poi-1" });
      mockPurchaseOrderFindUnique.mockResolvedValueOnce({ ...PO_DRAFT, items: [] });
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.po.create({
        vendorId: VENDOR_A.id,
        items: [{ description: "Widget", quantity: 1, unitPrice: 100 }],
      });

      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("CREATE");
      expect(auditArg.data.entity).toBe("PurchaseOrder");
      expect(auditArg.data.entityId).toBe(PO_DRAFT.id);
    });
  });

  // ── po.update ────────────────────────────────────────────────────────────────
  describe("po.update", () => {
    it("throws NOT_FOUND for cross-tenant IDOR attempt", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce({ ...PO_DRAFT, tenantId: "tenant-B" });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.update({ id: PO_DRAFT.id, notes: "evil" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(mockPurchaseOrderUpdate).not.toHaveBeenCalled();
    });

    it("throws BAD_REQUEST when PO is not in draft status", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce(PO_PENDING);

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.update({ id: PO_DRAFT.id, notes: "test" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("writes audit log with action UPDATE entity PurchaseOrder", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce(PO_DRAFT);
      const updated = { ...PO_DRAFT, notes: "Updated note" };
      mockPurchaseOrderUpdate.mockResolvedValueOnce(updated);
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.po.update({ id: PO_DRAFT.id, notes: "Updated note" });

      expect(mockPurchaseOrderUpdate).toHaveBeenCalledOnce();
      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("UPDATE");
      expect(auditArg.data.entity).toBe("PurchaseOrder");
      expect(auditArg.data.entityId).toBe(PO_DRAFT.id);
    });
  });

  // ── po.submit ────────────────────────────────────────────────────────────────
  describe("po.submit", () => {
    it("throws NOT_FOUND for cross-tenant IDOR attempt", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce({ ...PO_DRAFT, tenantId: "tenant-B" });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.submit({ id: PO_DRAFT.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(mockPurchaseOrderUpdate).not.toHaveBeenCalled();
    });

    it("writes audit log with action UPDATE (auto-approved: totalAmount ≤ threshold)", async () => {
      // PO_DRAFT.totalAmount=100 ≤ default threshold 10000 → auto-approve
      mockAccountingSettingsFindUnique.mockResolvedValueOnce(null);
      mockPurchaseOrderFindUnique.mockResolvedValueOnce(PO_DRAFT);
      const submitted = { ...PO_DRAFT, status: "approved", approvedById: "user-admin" };
      mockPurchaseOrderUpdate.mockResolvedValueOnce(submitted);
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.po.submit({ id: PO_DRAFT.id });

      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("UPDATE");
      expect(auditArg.data.entity).toBe("PurchaseOrder");
      expect(auditArg.data.after).toMatchObject({ status: "approved", autoApproved: true });
    });
  });

  // ── po.approve ───────────────────────────────────────────────────────────────
  describe("po.approve", () => {
    it("throws FORBIDDEN when caller lacks approver role", async () => {
      const caller = createCaller(ctxForTenant("tenant-A", { roles: ["Staff"] }));
      await expect(
        caller.po.approve({ id: PO_PENDING.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(mockPurchaseOrderUpdate).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND for cross-tenant IDOR attempt", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce({ ...PO_PENDING, tenantId: "tenant-B" });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.approve({ id: PO_PENDING.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(mockPurchaseOrderUpdate).not.toHaveBeenCalled();
    });

    it("writes audit log with action UPDATE status=approved", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce(PO_PENDING);
      const approved = { ...PO_PENDING, status: "approved", approvedById: "user-1" };
      mockPurchaseOrderUpdate.mockResolvedValueOnce(approved);
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.po.approve({ id: PO_PENDING.id });

      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("UPDATE");
      expect(auditArg.data.entity).toBe("PurchaseOrder");
      expect(auditArg.data.after).toMatchObject({ status: "approved" });
    });
  });

  // ── po.markOrdered ───────────────────────────────────────────────────────────
  describe("po.markOrdered", () => {
    it("throws NOT_FOUND for cross-tenant IDOR attempt", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce({ ...PO_APPROVED, tenantId: "tenant-B" });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.markOrdered({ id: PO_APPROVED.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(mockPurchaseOrderUpdate).not.toHaveBeenCalled();
    });

    it("writes audit log with action UPDATE status=ordered", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce(PO_APPROVED);
      const ordered = { ...PO_APPROVED, status: "ordered" };
      mockPurchaseOrderUpdate.mockResolvedValueOnce(ordered);
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.po.markOrdered({ id: PO_APPROVED.id });

      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("UPDATE");
      expect(auditArg.data.entity).toBe("PurchaseOrder");
      expect(auditArg.data.after).toMatchObject({ status: "ordered" });
    });
  });

  // ── po.cancel ────────────────────────────────────────────────────────────────
  describe("po.cancel", () => {
    it("throws NOT_FOUND for cross-tenant IDOR attempt", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce({ ...PO_DRAFT, tenantId: "tenant-B" });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.cancel({ id: PO_DRAFT.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(mockPurchaseOrderUpdate).not.toHaveBeenCalled();
    });

    it("throws BAD_REQUEST for non-cancellable status", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce({ ...PO_DRAFT, status: "received" });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.cancel({ id: PO_DRAFT.id }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("writes audit log with action UPDATE status=cancelled", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce(PO_DRAFT);
      const cancelled = { ...PO_DRAFT, status: "cancelled" };
      mockPurchaseOrderUpdate.mockResolvedValueOnce(cancelled);
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.po.cancel({ id: PO_DRAFT.id });

      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("UPDATE");
      expect(auditArg.data.entity).toBe("PurchaseOrder");
      expect(auditArg.data.after).toMatchObject({ status: "cancelled" });
    });
  });

  // ── goodsReceipt.create ──────────────────────────────────────────────────────
  describe("goodsReceipt.create", () => {
    it("injects tenantId from ctx into db.goodsReceipt.create", async () => {
      // loadPoForTenant
      mockPurchaseOrderFindUnique
        .mockResolvedValueOnce(PO_APPROVED) // loadPoForTenant
        .mockResolvedValueOnce({ ...PO_APPROVED, items: [] }); // full include fetch
      // grNumber generator
      mockGoodsReceiptFindFirst.mockResolvedValueOnce(null);
      mockGoodsReceiptCreate.mockResolvedValueOnce(GR_A);
      mockGoodsReceiptItemCreate.mockResolvedValueOnce({ id: "gri-1" });
      mockPurchaseOrderItemFindMany.mockResolvedValueOnce([]);
      mockPurchaseOrderUpdate.mockResolvedValueOnce(PO_APPROVED);
      mockGoodsReceiptFindUnique.mockResolvedValueOnce({ ...GR_A, items: [] });
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.goodsReceipt.create({
        purchaseOrderId: PO_APPROVED.id,
        items: [{ description: "Widget", quantityExpected: 1, quantityReceived: 1 }],
      });

      expect(mockGoodsReceiptCreate).toHaveBeenCalledOnce();
      const callArg = mockGoodsReceiptCreate.mock.calls[0]![0];
      expect(callArg.data.tenantId).toBe("tenant-A");
    });

    it("writes audit log with action CREATE entity GoodsReceipt", async () => {
      mockPurchaseOrderFindUnique
        .mockResolvedValueOnce(PO_APPROVED)
        .mockResolvedValueOnce({ ...PO_APPROVED, items: [] });
      mockGoodsReceiptFindFirst.mockResolvedValueOnce(null);
      mockGoodsReceiptCreate.mockResolvedValueOnce(GR_A);
      mockGoodsReceiptItemCreate.mockResolvedValueOnce({ id: "gri-1" });
      mockPurchaseOrderItemFindMany.mockResolvedValueOnce([]);
      mockPurchaseOrderUpdate.mockResolvedValueOnce(PO_APPROVED);
      mockGoodsReceiptFindUnique.mockResolvedValueOnce({ ...GR_A, items: [] });
      mockAuditLogCreate.mockResolvedValueOnce({});

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.goodsReceipt.create({
        purchaseOrderId: PO_APPROVED.id,
        items: [{ description: "Widget", quantityExpected: 1, quantityReceived: 1 }],
      });

      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditArg = mockAuditLogCreate.mock.calls[0]![0];
      expect(auditArg.data.action).toBe("CREATE");
      expect(auditArg.data.entity).toBe("GoodsReceipt");
      expect(auditArg.data.entityId).toBe(GR_A.id);
    });

    it("throws NOT_FOUND when PO belongs to different tenant", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce({ ...PO_APPROVED, tenantId: "tenant-B" });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.goodsReceipt.create({
          purchaseOrderId: PO_APPROVED.id,
          items: [{ description: "Widget", quantityExpected: 1, quantityReceived: 1 }],
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws BAD_REQUEST when an item.productId does not belong to this tenant (M7.2)", async () => {
      mockPurchaseOrderFindUnique
        .mockResolvedValueOnce(PO_APPROVED) // loadPoForTenant
        .mockResolvedValueOnce({ ...PO_APPROVED, items: [] }); // full include fetch
      mockProductFindMany.mockResolvedValueOnce([]); // cross-tenant productId — no match

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.goodsReceipt.create({
          purchaseOrderId: PO_APPROVED.id,
          items: [
            {
              productId: "product-belongs-to-tenant-B",
              description: "Widget",
              quantityExpected: 1,
              quantityReceived: 1,
            },
          ],
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(mockGoodsReceiptCreate).not.toHaveBeenCalled();
      const queryArg = mockProductFindMany.mock.calls[0]![0];
      expect(queryArg.where.tenantId).toBe("tenant-A");
    });
  });

  // ── goodsReceipt.list ────────────────────────────────────────────────────────
  describe("goodsReceipt.list", () => {
    it("scopes the where clause by ctx.tenantId (M7.2 — was an unscoped list-leak)", async () => {
      mockGoodsReceiptFindMany.mockResolvedValueOnce([]);
      mockGoodsReceiptCount.mockResolvedValueOnce(0);

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.goodsReceipt.list({});

      expect(mockGoodsReceiptFindMany).toHaveBeenCalledOnce();
      const findManyArg = mockGoodsReceiptFindMany.mock.calls[0]![0];
      expect(findManyArg.where.tenantId).toBe("tenant-A");

      expect(mockGoodsReceiptCount).toHaveBeenCalledOnce();
      const countArg = mockGoodsReceiptCount.mock.calls[0]![0];
      expect(countArg.where.tenantId).toBe("tenant-A");
    });
  });

  // ── po.create — nested FK injection guard (M7.2) ────────────────────────────
  describe("po.create — nested FK tenant validation (M7.2)", () => {
    it("throws BAD_REQUEST when an item.productId does not belong to this tenant", async () => {
      mockVendorFindUnique.mockResolvedValueOnce(VENDOR_A);
      mockProductFindMany.mockResolvedValueOnce([]); // cross-tenant productId — no match

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.create({
          vendorId: VENDOR_A.id,
          items: [
            {
              productId: "product-belongs-to-tenant-B",
              description: "Widget",
              quantity: 1,
              unitPrice: 100,
            },
          ],
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(mockPurchaseOrderCreate).not.toHaveBeenCalled();
      const queryArg = mockProductFindMany.mock.calls[0]![0];
      expect(queryArg.where.tenantId).toBe("tenant-A");
    });

    it("throws BAD_REQUEST when an allocation.projectId does not belong to this tenant", async () => {
      mockVendorFindUnique.mockResolvedValueOnce(VENDOR_A);
      mockProjectFindMany.mockResolvedValueOnce([]); // cross-tenant projectId — no match

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.create({
          vendorId: VENDOR_A.id,
          items: [
            {
              description: "Widget",
              quantity: 1,
              unitPrice: 100,
              allocations: [
                { type: "project_expense", quantity: 1, projectId: "project-belongs-to-tenant-B" },
              ],
            },
          ],
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(mockPurchaseOrderCreate).not.toHaveBeenCalled();
    });

    it("throws BAD_REQUEST when an allocation.warehouseId does not belong to this tenant", async () => {
      mockVendorFindUnique.mockResolvedValueOnce(VENDOR_A);
      mockWarehouseFindMany.mockResolvedValueOnce([]); // cross-tenant warehouseId — no match

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.create({
          vendorId: VENDOR_A.id,
          items: [
            {
              description: "Widget",
              quantity: 1,
              unitPrice: 100,
              allocations: [
                { type: "stock", quantity: 1, warehouseId: "warehouse-belongs-to-tenant-B" },
              ],
            },
          ],
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(mockPurchaseOrderCreate).not.toHaveBeenCalled();
    });
  });

  // ── po.update — vendor reassignment tenant validation (M7.2) ───────────────
  describe("po.update — vendorId tenant validation (M7.2)", () => {
    it("throws NOT_FOUND when reassigning to a vendorId from another tenant", async () => {
      mockPurchaseOrderFindUnique.mockResolvedValueOnce(PO_DRAFT); // loadPoForTenant
      mockVendorFindUnique.mockResolvedValueOnce({ ...VENDOR_A, tenantId: "tenant-B" }); // loadVendorForTenant

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.po.update({ id: PO_DRAFT.id, vendorId: "vendor-belongs-to-tenant-B" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(mockPurchaseOrderUpdate).not.toHaveBeenCalled();
    });
  });
});
