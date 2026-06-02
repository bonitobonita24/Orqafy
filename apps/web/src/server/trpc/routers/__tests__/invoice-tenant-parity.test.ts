/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * K-prime closure: Invoice tenant parity (IDOR guards)
 *
 * Proves:
 *  1. invoice.byId throws NOT_FOUND when invoice belongs to tenant-B but ctx is tenant-A
 *  2. invoice.byId returns invoice when tenantId matches ctx
 *  3. invoice.create throws BAD_REQUEST when customer belongs to tenant-B but ctx is tenant-A
 *  4. invoice.create injects tenantId from ctx into db.invoice.create data when customer matches
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const { mockInvoiceCreate, mockInvoiceFindUnique, mockCustomerFindUnique } = vi.hoisted(() => ({
  mockInvoiceCreate: vi.fn(),
  mockInvoiceFindUnique: vi.fn(),
  mockCustomerFindUnique: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    invoice: {
      findMany: vi.fn(),
      findUnique: mockInvoiceFindUnique,
      create: mockInvoiceCreate,
      update: vi.fn(),
      count: vi.fn(),
    },
    customer: {
      findUnique: mockCustomerFindUnique,
    },
  },
}));

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    public: { check: vi.fn() },
    public_invoice: { check: vi.fn() },
  },
}));

vi.mock("@/server/lib/sanitize", () => ({
  sanitizePlainText: (s: string) => s,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { invoiceRouter } from "@/server/trpc/routers/invoice";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ invoice: invoiceRouter });
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

describe("Invoice tenant parity (K-prime closure)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invoice.byId throws NOT_FOUND when invoice belongs to a different tenant", async () => {
    // loadInvoiceForTenant calls findUnique — returns tenant-B invoice → guard fires
    mockInvoiceFindUnique.mockResolvedValueOnce({
      id: "clxxxxxxxxxxxxxxxxxxxxxx",
      tenantId: "tenant-B",
      status: "draft",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.invoice.byId({ id: "clxxxxxxxxxxxxxxxxxxxxxx" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Invoice not found",
    });
  });

  it("invoice.byId returns invoice when tenantId matches ctx", async () => {
    const invoiceRow = {
      id: "clxxxxxxxxxxxxxxxxxxxxxx",
      tenantId: "tenant-A",
      status: "draft",
      invoiceNumber: "INV-1",
    };

    // byId calls findUnique twice: once in loadInvoiceForTenant, once with include
    mockInvoiceFindUnique
      .mockResolvedValueOnce(invoiceRow) // loadInvoiceForTenant
      .mockResolvedValueOnce({           // main byId query with include
        ...invoiceRow,
        customer: { firstName: "Jane", lastName: "Doe", companyName: null, email: null, phone: null },
        project: null,
        createdBy: { firstName: "Admin", lastName: "User" },
      });

    const caller = createCaller(ctxForTenant("tenant-A"));
    const result = await caller.invoice.byId({ id: "clxxxxxxxxxxxxxxxxxxxxxx" });

    expect(result).toMatchObject({ id: "clxxxxxxxxxxxxxxxxxxxxxx", tenantId: "tenant-A" });
  });

  it("invoice.create throws BAD_REQUEST when customer belongs to a different tenant", async () => {
    // Customer exists but belongs to tenant-B
    mockCustomerFindUnique.mockResolvedValueOnce({
      id: "clcustomerxxxxxxxxxx00",
      tenantId: "tenant-B",
    });

    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.invoice.create({
        customerId: "clcustomerxxxxxxxxxx00",
        dueDate: new Date("2026-12-31"),
        lineItems: [{ description: "x", quantity: 1, unitPrice: 100 }],
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Customer not found.",
    });
  });

  it("invoice.create injects tenantId from ctx into db.invoice.create", async () => {
    // Customer belongs to tenant-A — passes guard
    mockCustomerFindUnique.mockResolvedValueOnce({
      id: "clcustomerxxxxxxxxxx00",
      tenantId: "tenant-A",
    });

    const createdInvoice = {
      id: "clinvoicexxxxxxxxxx0000",
      tenantId: "tenant-A",
      customerId: "clcustomerxxxxxxxxxx00",
      invoiceNumber: "INV-TEST",
      status: "draft",
    };
    mockInvoiceCreate.mockResolvedValueOnce(createdInvoice);

    const caller = createCaller(ctxForTenant("tenant-A"));

    const result = await caller.invoice.create({
      customerId: "clcustomerxxxxxxxxxx00",
      dueDate: new Date("2026-12-31"),
      lineItems: [{ description: "x", quantity: 1, unitPrice: 100 }],
    });

    expect(result).toMatchObject({ tenantId: "tenant-A" });
    expect(mockInvoiceCreate).toHaveBeenCalledOnce();
    const callArg = mockInvoiceCreate.mock.calls[0]![0];
    expect(callArg.data.tenantId).toBe("tenant-A");
  });
});
