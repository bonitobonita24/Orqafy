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
const { mockVendorCreate, mockVendorFindUnique } = vi.hoisted(() => ({
  mockVendorCreate: vi.fn(),
  mockVendorFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
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
    $transaction: vi.fn(),
  },
}));

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
