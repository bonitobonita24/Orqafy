/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime closure — Job Order tenant parity
 *
 * Proves:
 *  1. jobOrder.create injects tenantId from ctx (never from input)
 *  2. jobOrder.byId throws NOT_FOUND when job order belongs to tenant-B but ctx is tenant-A (IDOR guard)
 *  3. jobOrder.updateStatus throws NOT_FOUND for cross-tenant access
 *  4. jobOrder.assignTechnician throws NOT_FOUND for cross-tenant job order
 *  5. jobOrder.assignTechnician throws BAD_REQUEST when technician belongs to a different tenant
 *  6. jobOrder.addPart throws NOT_FOUND for cross-tenant job order
 *  7. jobOrder.addServiceLine throws NOT_FOUND for cross-tenant job order
 *  8. jobOrder.removePart throws NOT_FOUND for cross-tenant part
 *  9. jobOrder.removeServiceLine throws NOT_FOUND for cross-tenant service line
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const {
  mockJobOrderFindUnique,
  mockJobOrderCreate,
  mockJobOrderUpdate,
  mockJobOrderFindMany,
  mockJobOrderCount,
  mockJobOrderPartFindUnique,
  mockJobOrderPartCreate,
  mockJobOrderPartDelete,
  mockJobOrderServiceLineFindUnique,
  mockJobOrderServiceLineCreate,
  mockJobOrderServiceLineDelete,
  mockCustomerFindUnique,
  mockUserFindUnique,
  mockProductFindUnique,
} = vi.hoisted(() => ({
  mockJobOrderFindUnique: vi.fn(),
  mockJobOrderCreate: vi.fn(),
  mockJobOrderUpdate: vi.fn(),
  mockJobOrderFindMany: vi.fn().mockResolvedValue([]),
  mockJobOrderCount: vi.fn().mockResolvedValue(0),
  mockJobOrderPartFindUnique: vi.fn(),
  mockJobOrderPartCreate: vi.fn(),
  mockJobOrderPartDelete: vi.fn(),
  mockJobOrderServiceLineFindUnique: vi.fn(),
  mockJobOrderServiceLineCreate: vi.fn(),
  mockJobOrderServiceLineDelete: vi.fn(),
  mockCustomerFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockProductFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    jobOrder: {
      findUnique: mockJobOrderFindUnique,
      findMany: mockJobOrderFindMany,
      count: mockJobOrderCount,
      create: mockJobOrderCreate,
      update: mockJobOrderUpdate,
    },
    jobOrderPart: {
      findUnique: mockJobOrderPartFindUnique,
      create: mockJobOrderPartCreate,
      delete: mockJobOrderPartDelete,
    },
    jobOrderServiceLine: {
      findUnique: mockJobOrderServiceLineFindUnique,
      create: mockJobOrderServiceLineCreate,
      delete: mockJobOrderServiceLineDelete,
    },
    customer: { findUnique: mockCustomerFindUnique },
    user: { findUnique: mockUserFindUnique },
    product: { findUnique: mockProductFindUnique },
  },
}));

vi.mock("@/server/notifications/create", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-test" }),
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    public_invoice: { check: vi.fn() },
  },
}));

vi.mock("@/server/lib/sanitize", () => ({
  sanitizePlainText: (s: string): string => s.trim(),
}));

import { jobOrderRouter } from "@/server/trpc/routers/job-order";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ jobOrder: jobOrderRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return { headers: { get: (_h: string): string | null => null } } as unknown as NextRequest;
}

function ctxForTenant(tenantId: string, roles: string[] = ["Administrator"]) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const JO_CUID = "clexample00000000000joborder1";
const PART_CUID = "clexample00000000000part00001";
const LINE_CUID = "clexample00000000000line00001";
const TECH_CUID = "clexample00000000000tech00001";

/** A job order that belongs to tenant-B */
const jobOrderOnTenantB = {
  id: JO_CUID,
  tenantId: "tenant-B",
  jobOrderNumber: "JO-TENANT-B",
  title: "Cross-tenant repair",
  status: "received",
  priority: "medium",
  reportedIssue: "Device broken",
  description: "",
  customerId: "cust-b1",
  createdById: "user-b1",
  technicianId: null,
  deviceType: null,
  deviceBrand: null,
  deviceModel: null,
  serialNumber: null,
  estimatedCost: null,
  actualCost: null,
  laborCost: null,
  warranty: null,
  diagnosis: null,
  currency: "PHP",
  completedAt: null,
  releasedAt: null,
  signedAt: null,
  customerSignatureUrl: null,
  technicianSignatureUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Job Order tenant parity (K-prime closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. create: tenantId from ctx ────────────────────────────────────────────
  it("jobOrder.create injects tenantId from ctx, not from input", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({ id: "cust-1" });
    mockJobOrderCreate.mockResolvedValueOnce({
      ...jobOrderOnTenantB,
      tenantId: "tenant-A",
      id: "jo-a1",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.jobOrder.create({
      customerId: "clexample00000000000cust00001",
      title: "Screen replacement",
      description: "Customer dropped the phone",
      reportedIssue: "Screen cracked, backlight failing",
      priority: "high",
    });

    expect(mockJobOrderCreate).toHaveBeenCalledOnce();
    const callArg = mockJobOrderCreate.mock.calls[0]![0] as any;
    expect(callArg.data.tenantId).toBe("tenant-A");
    // Input cannot supply tenantId — it is not in jobOrderInput schema
    expect(callArg.data.createdById).toBe("user-1");
  });

  // ── 2. byId: IDOR guard ─────────────────────────────────────────────────────
  it("jobOrder.byId throws NOT_FOUND when job order belongs to tenant-B but ctx is tenant-A", async () => {
    // loadJobOrderForTenant calls findUnique; returns a record owned by tenant-B.
    mockJobOrderFindUnique.mockResolvedValueOnce(jobOrderOnTenantB);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.jobOrder.byId({ id: JO_CUID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ── 3. updateStatus: IDOR guard ─────────────────────────────────────────────
  it("jobOrder.updateStatus throws NOT_FOUND for cross-tenant access", async () => {
    mockJobOrderFindUnique.mockResolvedValueOnce(jobOrderOnTenantB);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.jobOrder.updateStatus({ id: JO_CUID, status: "diagnosing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ── 4. assignTechnician: IDOR guard on job order ────────────────────────────
  it("jobOrder.assignTechnician throws NOT_FOUND when job order belongs to different tenant", async () => {
    mockJobOrderFindUnique.mockResolvedValueOnce(jobOrderOnTenantB);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.jobOrder.assignTechnician({ id: JO_CUID, technicianId: TECH_CUID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ── 5. assignTechnician: cross-tenant technician ────────────────────────────
  it("jobOrder.assignTechnician throws BAD_REQUEST when technician belongs to a different tenant", async () => {
    // Job order is correctly on tenant-A
    mockJobOrderFindUnique.mockResolvedValueOnce({
      ...jobOrderOnTenantB,
      tenantId: "tenant-A",
    });
    // Technician is on tenant-B
    mockUserFindUnique.mockResolvedValueOnce({
      id: TECH_CUID,
      tenantId: "tenant-B",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.jobOrder.assignTechnician({ id: JO_CUID, technicianId: TECH_CUID }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  // ── 6. addPart: IDOR guard ──────────────────────────────────────────────────
  it("jobOrder.addPart throws NOT_FOUND for cross-tenant job order", async () => {
    mockJobOrderFindUnique.mockResolvedValueOnce(jobOrderOnTenantB);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.jobOrder.addPart({
        jobOrderId: JO_CUID,
        description: "Replacement screen",
        quantity: 1,
        unitPrice: 1500,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ── 7. addServiceLine: IDOR guard ───────────────────────────────────────────
  it("jobOrder.addServiceLine throws NOT_FOUND for cross-tenant job order", async () => {
    mockJobOrderFindUnique.mockResolvedValueOnce(jobOrderOnTenantB);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.jobOrder.addServiceLine({
        jobOrderId: JO_CUID,
        description: "Labor: screen swap",
        amount: 500,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ── 8. removePart: IDOR guard via parent tenantId ──────────────────────────
  it("jobOrder.removePart throws NOT_FOUND when part's parent job order belongs to different tenant", async () => {
    mockJobOrderPartFindUnique.mockResolvedValueOnce({
      id: PART_CUID,
      jobOrder: { status: "diagnosing", tenantId: "tenant-B" },
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.jobOrder.removePart({ id: PART_CUID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ── 9. removeServiceLine: IDOR guard via parent tenantId ───────────────────
  it("jobOrder.removeServiceLine throws NOT_FOUND when line's parent job order belongs to different tenant", async () => {
    mockJobOrderServiceLineFindUnique.mockResolvedValueOnce({
      id: LINE_CUID,
      jobOrder: { status: "diagnosing", tenantId: "tenant-B" },
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.jobOrder.removeServiceLine({ id: LINE_CUID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
