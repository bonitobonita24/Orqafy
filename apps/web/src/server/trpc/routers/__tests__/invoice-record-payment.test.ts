/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * F2 (Phase 7): invoice.recordPayment — partial-payment lifecycle + D1 Banking auto-post.
 *
 * Proves:
 *  1. partial payment (< balance) sets status `partially_paid` and decrements balance
 *  2. full payment (== balance) sets status `paid`
 *  3. over-payment (> balance) is rejected with BAD_REQUEST
 *  4. D1 — when a fundSourceId is supplied, an `income` FundTransaction is auto-posted
 *  5. tenant parity — a fund source from another tenant is rejected
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OrqafyDb from "@orqafy/db";

// ── DB mock (hoisted) ─────────────────────────────────────────────────────────
const {
  mockInvoiceFindUnique,
  mockInvoiceUpdate,
  mockPaymentCreate,
  mockFundSourceFindUnique,
  mockFundSourceUpdate,
  mockFundTransactionCreate,
  mockAuditCreate,
  mockRoleFindFirst,
  mockRolePermissionFindUnique,
} = vi.hoisted(() => ({
  mockInvoiceFindUnique: vi.fn(),
  mockInvoiceUpdate: vi.fn(),
  mockPaymentCreate: vi.fn(),
  mockFundSourceFindUnique: vi.fn(),
  mockFundSourceUpdate: vi.fn(),
  mockFundTransactionCreate: vi.fn(),
  mockAuditCreate: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockRolePermissionFindUnique: vi.fn(),
}));

// D7 — recordPayment emits a notification to the invoice creator as a side
// effect; stub it (createNotification is unit-tested separately).
vi.mock("@/server/notifications/create", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-test" }),
}));

// recordPayment/markPaid are now gated by the "invoices"/"update" RBAC matrix
// (writeProcedure.use(matrixMiddleware(...))) — mock role/rolePermission
// alongside the existing invoice/fundSource/tx mocks so hasPermission()
// resolves. Default (see beforeEach) is a Platform Owner bypass so the
// original business-logic assertions are unaffected.
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  const tx = {
    payment: { create: mockPaymentCreate },
    invoice: { update: mockInvoiceUpdate },
    fundSource: { update: mockFundSourceUpdate },
    fundTransaction: { create: mockFundTransactionCreate },
    auditLog: { create: mockAuditCreate },
  };
  return {
    ...actual,
    prisma: {
      invoice: { findUnique: mockInvoiceFindUnique, update: mockInvoiceUpdate },
      fundSource: { findUnique: mockFundSourceFindUnique },
      role: { findFirst: mockRoleFindFirst },
      rolePermission: { findUnique: mockRolePermissionFindUnique },
      $transaction: (fn: any) => Promise.resolve(fn(tx)),
    },
    writeAuditLog: async (txArg: any, entry: any) => {
      await txArg.auditLog.create({ data: entry });
    },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: { api: { check: vi.fn() }, public: { check: vi.fn() }, public_invoice: { check: vi.fn() } },
}));

vi.mock("@/server/lib/sanitize", () => ({ sanitizePlainText: (s: string) => s }));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { invoiceRouter } from "@/server/trpc/routers/invoice";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import type { NextRequest } from "next/server";

const testRouter = createTRPCRouter({ invoice: invoiceRouter });
const createCaller = createCallerFactory(testRouter);

const INVOICE_CUID = "clinvoicexxxxxxxxxxxx01";
const FUND_CUID = "clfundsourcexxxxxxxx001";

function ctxForTenant(tenantId: string) {
  return {
    req: {} as NextRequest,
    userId: "user-1",
    roles: ["Administrator"] as string[],
    roleId: "role-1",
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

function sentInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_CUID,
    tenantId: "tenant-A",
    invoiceNumber: "INV-1",
    status: "sent",
    currency: "PHP",
    totalAmount: { toString: () => "1000" },
    amountPaid: { toString: () => "0" },
    ...overrides,
  };
}

describe("invoice.recordPayment (F2 — partial payments + D1 auto-post)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPaymentCreate.mockResolvedValue({ id: "clpaymentxxxxxxxxxxx001" });
    mockInvoiceUpdate.mockImplementation(({ data }: any) => Promise.resolve({ id: INVOICE_CUID, ...data }));
    // Default: Platform Owner bypasses the "invoices"/"update" matrix check
    // entirely, preserving the original business-logic assertions below.
    mockRoleFindFirst.mockResolvedValue({ id: "role-1", tenantId: "tenant-A", name: "Platform Owner" });
  });

  it("partial payment sets status partially_paid and decrements balance", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(sentInvoice());
    const caller = createCaller(ctxForTenant("tenant-A"));

    const result: any = await caller.invoice.recordPayment({
      id: INVOICE_CUID,
      amount: 400,
      method: "cash",
    });

    expect(result.invoice.status).toBe("partially_paid");
    expect(result.invoice.amountPaid).toBe(400);
    expect(result.invoice.balance).toBe(600);
    expect(mockFundTransactionCreate).not.toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledOnce();
  });

  it("full payment (== balance) sets status paid", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(sentInvoice({ amountPaid: { toString: () => "400" } }));
    const caller = createCaller(ctxForTenant("tenant-A"));

    const result: any = await caller.invoice.recordPayment({
      id: INVOICE_CUID,
      amount: 600,
      method: "cash",
    });

    expect(result.invoice.status).toBe("paid");
    expect(result.invoice.balance).toBe(0);
    expect(result.invoice.paidAt).toBeInstanceOf(Date);
  });

  it("over-payment is rejected with BAD_REQUEST", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(sentInvoice());
    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.invoice.recordPayment({ id: INVOICE_CUID, amount: 1500, method: "cash" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  it("D1 — auto-posts an income FundTransaction when a fund source is supplied", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(sentInvoice());
    mockFundSourceFindUnique.mockResolvedValueOnce({
      id: FUND_CUID,
      tenantId: "tenant-A",
      currentBalance: { toString: () => "5000" },
    });
    const caller = createCaller(ctxForTenant("tenant-A"));

    await caller.invoice.recordPayment({
      id: INVOICE_CUID,
      amount: 400,
      method: "bank_transfer",
      fundSourceId: FUND_CUID,
    });

    expect(mockFundTransactionCreate).toHaveBeenCalledOnce();
    const ftArg = mockFundTransactionCreate.mock.calls[0]![0];
    expect(ftArg.data.type).toBe("income");
    expect(ftArg.data.amount).toBe(400);
    expect(ftArg.data.runningBalance).toBe(5400);
    expect(ftArg.data.referenceType).toBe("invoice_payment");
    expect(mockFundSourceUpdate).toHaveBeenCalledWith({
      where: { id: FUND_CUID },
      data: { currentBalance: 5400 },
    });
  });

  it("tenant parity — rejects a fund source from another tenant", async () => {
    mockInvoiceFindUnique.mockResolvedValueOnce(sentInvoice());
    mockFundSourceFindUnique.mockResolvedValueOnce({
      id: FUND_CUID,
      tenantId: "tenant-B",
      currentBalance: { toString: () => "5000" },
    });
    const caller = createCaller(ctxForTenant("tenant-A"));

    await expect(
      caller.invoice.recordPayment({
        id: INVOICE_CUID,
        amount: 400,
        method: "cash",
        fundSourceId: FUND_CUID,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Fund source not found." });
  });
});
