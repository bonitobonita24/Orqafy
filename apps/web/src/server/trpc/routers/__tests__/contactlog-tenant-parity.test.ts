/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime Extended — ContactLog tenant parity (IDOR closure)
 *
 * Proves:
 *  1. contactLogById throws NOT_FOUND when contactLog belongs to tenant-B but ctx is tenant-A
 *  2. contactLogById returns contactLog when tenantId matches ctx
 *  3. contactLogCreate throws NOT_FOUND ("Customer not found") when parent customerId belongs to tenant-B
 *  4. contactLogCreate injects tenantId + createdById from ctx into db.contactLog.create
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const { mockContactLogFindFirst, mockContactLogCreate, mockCustomerFindUnique } =
  vi.hoisted(() => ({
    mockContactLogFindFirst: vi.fn(),
    mockContactLogCreate: vi.fn(),
    mockCustomerFindUnique: vi.fn(),
  }));

vi.mock("@orqafy/db", () => ({
  prisma: {
    contactLog: {
      findFirst: mockContactLogFindFirst,
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: mockContactLogCreate,
      update: vi.fn(),
      count: vi.fn(),
    },
    customer: {
      findUnique: mockCustomerFindUnique,
    },
  },
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() } },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { crmRouter } from "@/server/trpc/routers/crm";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ crm: crmRouter });
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

describe("ContactLog tenant parity (K-prime Extended IDOR closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("contactLogById throws NOT_FOUND when contactLog belongs to a different tenant", async () => {
    // Composite where: { id, tenantId: ctx.tenantId } — returns null on tenant mismatch
    mockContactLogFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.crm.contactLogById({ id: "log-B" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("contactLogById returns contactLog when tenantId matches ctx", async () => {
    const row = {
      id: "log-1",
      tenantId: "tenant-A",
      customerId: "cust-1",
      type: "note",
      subject: "test",
      customer: {
        id: "cust-1",
        firstName: "X",
        lastName: "Y",
        companyName: null,
      },
      createdBy: {
        id: "user-1",
        firstName: "A",
        lastName: "B",
        displayName: null,
      },
    };
    mockContactLogFindFirst.mockResolvedValueOnce(row);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.crm.contactLogById({ id: "log-1" });

    expect(result).toEqual(row);
  });

  it("contactLogCreate throws NOT_FOUND when parent customer belongs to a different tenant", async () => {
    // loadCustomerForTenant sees tenant-B → throws NOT_FOUND "Customer not found"
    mockCustomerFindUnique.mockResolvedValueOnce({
      id: "cust-B",
      tenantId: "tenant-B",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.crm.contactLogCreate({
        customerId: "ck1234567890123456789012a",
        type: "note",
        subject: "test subject",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Customer not found",
    });

    expect(mockContactLogCreate).not.toHaveBeenCalled();
  });

  it("contactLogCreate injects tenantId + createdById from ctx into db.contactLog.create", async () => {
    mockCustomerFindUnique.mockResolvedValueOnce({
      id: "cust-1",
      tenantId: "tenant-A",
    });
    const created = {
      id: "log-new",
      tenantId: "tenant-A",
      customerId: "cust-1",
      createdById: "user-1",
      type: "note",
      subject: "test subject",
      body: null,
      occurredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockContactLogCreate.mockResolvedValueOnce(created);

    const caller = createCaller(ctxForTenant("tenant-A"));
    await caller.crm.contactLogCreate({
      customerId: "ck1234567890123456789012a",
      type: "note",
      subject: "test subject",
    });

    expect(mockContactLogCreate).toHaveBeenCalledOnce();
    const callArg = mockContactLogCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
    expect(callArg.data.createdById).toBe("user-1");
  });
});
