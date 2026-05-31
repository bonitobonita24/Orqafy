/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime Extended closure — Quotation tenant parity
 *
 * Proves:
 *  1. quotationById throws NOT_FOUND when quotation belongs to tenant-B, ctx is tenant-A
 *     (composite findFirst { id, tenantId } returns null → guard fires)
 *  2. quotationById returns quotation when tenantId matches ctx
 *  3. quotationCreate throws NOT_FOUND ("Customer not found") when customerId belongs
 *     to tenant-B — loadCustomerForTenant short-circuits before any quotation.create call
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const { mockQuotationFindFirst, mockCustomerFindUnique, mockQuotationCreate } =
  vi.hoisted(() => ({
    mockQuotationFindFirst: vi.fn(),
    mockCustomerFindUnique: vi.fn(),
    mockQuotationCreate: vi.fn(),
  }));

vi.mock("@orqafy/db", () => ({
  prisma: {
    quotation: {
      findFirst: mockQuotationFindFirst,
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: mockQuotationCreate,
      count: vi.fn(),
    },
    customer: {
      findUnique: mockCustomerFindUnique,
    },
    $transaction: vi.fn(),
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

describe("Quotation tenant parity (K-prime Extended closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("quotationById throws NOT_FOUND when quotation belongs to a different tenant", async () => {
    // composite findFirst({ id, tenantId }) filters out cross-tenant row → returns null
    mockQuotationFindFirst.mockResolvedValueOnce(null);

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.crm.quotationById({ id: "ck1234567890123456789012a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("quotationById returns quotation when tenantId matches ctx", async () => {
    const quotation = {
      id: "ck1234567890123456789012a",
      tenantId: "tenant-A",
      customer: { id: "cust-1" },
      createdBy: null,
      markupColumns: [],
      sections: [],
      revisions: [],
    };
    mockQuotationFindFirst.mockResolvedValueOnce(quotation);

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.crm.quotationById({
      id: "ck1234567890123456789012a",
    });

    expect(result).toEqual(quotation);
  });

  it("quotationCreate throws NOT_FOUND when customerId belongs to a different tenant", async () => {
    // loadCustomerForTenant: db.customer.findUnique returns tenant-B row → guard fires
    mockCustomerFindUnique.mockResolvedValueOnce({
      id: "cust-B",
      tenantId: "tenant-B",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.crm.quotationCreate({
        customerId: "cust-B",
        title: "Test Quotation",
        sections: [
          {
            name: "Section 1",
            sortOrder: 0,
            lineItems: [
              {
                description: "Item 1",
                quantity: 1,
                baseCost: 100,
                sortOrder: 0,
              },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Customer not found",
    });

    // guard short-circuits — quotation.create must NOT be reached
    expect(mockQuotationCreate).not.toHaveBeenCalled();
  });
});
