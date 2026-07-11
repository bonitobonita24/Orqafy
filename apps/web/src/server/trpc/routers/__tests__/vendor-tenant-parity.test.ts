/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Batch 32 — Direction I close-out: Vendor tenant parity
 *
 * Proves:
 *  1. vendor.create injects tenantId from ctx (not from input)
 *  2. vendor.byId for a vendor in tenant-B throws NOT_FOUND when called with ctx.tenantId = tenant-A
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const { mockVendorCreate, mockVendorFindUnique, mockRoleFindFirst, mockRolePermissionFindUnique } = vi.hoisted(() => ({
  mockVendorCreate: vi.fn(),
  mockVendorFindUnique: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRolePermissionFindUnique: vi.fn(),
}));

import type * as OrqafyDb from "@orqafy/db";

// Keep the real `hasPermission` resolver (it takes prisma as an argument) —
// only mock the prisma client calls it makes. purchasing.ts procedures now
// run through matrixMiddleware (tenant-rbac-standard.md §4), which calls
// hasPermission -> prisma.role.findFirst + prisma.rolePermission.findUnique.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  const mockAuditLogCreate = vi.fn();
  const mockDb = {
    vendor: {
      findMany: vi.fn(),
      findUnique: mockVendorFindUnique,
      create: mockVendorCreate,
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
    auditLog: { create: mockAuditLogCreate },
    // RBAC matrix resolver mocks (tenant-rbac-standard.md §4) — purchasing.ts
    // procedures now run through matrixMiddleware. Default to a Platform
    // Owner role (matrix bypass) in beforeEach so the cross-tenant IDOR
    // assertions below are unaffected by the RBAC layer.
    role: { findFirst: mockRoleFindFirst },
    rolePermission: { findUnique: mockRolePermissionFindUnique },
  };
  return {
    ...actual,
    prisma: {
      ...mockDb,
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
import { vendorRouter } from "@/server/trpc/routers/purchasing";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ vendor: vendorRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Vendor tenant parity (Batch 32 / Direction I close-out)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // RBAC matrix bypass (tenant-rbac-standard.md §4) — Platform Owner
    // bypasses the matrix entirely, so every test below is unaffected by
    // the RBAC layer (these tests focus purely on tenant-scope IDOR).
    mockRoleFindFirst.mockResolvedValue({ id: "role-x", tenantId: "tenant-A", name: "Platform Owner" });
  });

  it("vendor.create injects tenantId from ctx into db.vendor.create", async () => {
    const createdVendor = {
      id: "vendor-1",
      tenantId: "tenant-A",
      type: "direct",
      companyName: "Acme Co.",
      contactName: null,
      email: null,
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
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockVendorCreate.mockResolvedValueOnce(createdVendor);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.vendor.create({ companyName: "Acme Co." });

    expect(mockVendorCreate).toHaveBeenCalledOnce();
    const callArg = mockVendorCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });

  it("vendor.byId throws NOT_FOUND when vendor belongs to a different tenant", async () => {
    // Vendor in tenant-B — ctx is tenant-A
    mockVendorFindUnique.mockResolvedValueOnce({
      id: "vendor-B",
      tenantId: "tenant-B",
      companyName: "Other Corp",
      isActive: true,
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(caller.vendor.byId({ id: "vendor-B" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Vendor not found",
    });
  });

  it("vendor.byId returns vendor when tenantId matches ctx", async () => {
    const vendor = {
      id: "vendor-1",
      tenantId: "tenant-A",
      companyName: "Acme Co.",
      isActive: true,
    };
    mockVendorFindUnique.mockResolvedValueOnce(vendor);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.vendor.byId({ id: "vendor-1" });

    expect(result).toEqual(vendor);
  });
});
