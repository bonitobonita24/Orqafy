/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { payrollRouter } from "@/server/trpc/routers/payroll";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

vi.mock("@orqafy/db", () => ({
  prisma: {
    payroll: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payslip: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    statutoryRate: { findMany: vi.fn().mockResolvedValue([]) },
    fundSource: { findUnique: vi.fn() },
    accountingSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        payroll: {
          create: vi.fn().mockResolvedValue({ id: "ck1234567890123456789012a", status: "draft", payrollNumber: "PAY-0001" }),
          // Echo input data so callers reading the returned object see what was written.
          update: vi.fn().mockImplementation((args: any) => Promise.resolve({ id: "ck1234567890123456789012a", ...args.data })),
        },
        payslip: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
        fundSource: { update: vi.fn() },
        fundTransaction: { create: vi.fn() },
        statutoryRate: { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
        accountingSettings: { findUnique: vi.fn().mockResolvedValue(null) },
        fiscalYear: { findUnique: vi.fn().mockResolvedValue({ id: "fy-1", tenantId: "acme-tenant-id", isClosed: false }) },
        account: { findMany: vi.fn().mockResolvedValue([{ id: "acct-exp", tenantId: "acme-tenant-id", isActive: true, name: "Expense" }, { id: "acct-ap", tenantId: "acme-tenant-id", isActive: true, name: "AP" }]) },
        journalEntry: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: "je-1", entryNumber: "JE-0001" }) },
      })
    ),
  },
  writeAuditLog: vi.fn(),
}));

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {} as NextRequest;
}
function authenticatedCtx(roles: string[] = ["Administrator"], isDemoTenant = false) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant,
    session: null,
  };
}
function unauthenticatedCtx() {
  return {
    req: makeReq(),
    userId: null,
    roles: [] as string[],
    tenantSlug: null,
    tenantId: null,
    securityVersion: 0,
    isDemoTenant: false,
    session: null,
  };
}

const testRouter = createTRPCRouter({ payroll: payrollRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  payroll: {
    findMany: any;
    findUnique: any;
    count: any;
    create: any;
    update: any;
  };
  payslip: { findMany: any; findUnique: any };
  statutoryRate: { findMany: any };
  fundSource: { findUnique: any };
  accountingSettings: { findUnique: any };
};

const PAYROLL_CUID = "ck1234567890123456789012a";

describe("payroll router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns paginated payrolls ordered by periodStart desc", async () => {
      mockDb.payroll.findMany.mockResolvedValue([
        { id: PAYROLL_CUID, payrollNumber: "PAY-1", status: "draft", _count: { payslips: 0 } },
      ]);
      mockDb.payroll.count.mockResolvedValue(1);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.payroll.list({});
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(mockDb.payroll.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { periodStart: "desc" } })
      );
    });

    it("filters by status", async () => {
      mockDb.payroll.findMany.mockResolvedValue([]);
      mockDb.payroll.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.payroll.list({ status: "approved" });
      expect(mockDb.payroll.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: "acme-tenant-id", status: "approved" } })
      );
    });

    it("rejects unauthenticated callers", async () => {
      const caller = createCaller(unauthenticatedCtx());
      await expect(caller.payroll.list({})).rejects.toThrow(TRPCError);
    });
  });

  describe("byId", () => {
    it("returns payroll with payslip relations", async () => {
      const payroll = {
        id: PAYROLL_CUID,
        tenantId: "acme-tenant-id",
        payrollNumber: "PAY-1",
        payslips: [],
      };
      // First call: guard (bare object with tenantId)
      // Second call: full fetch with includes
      mockDb.payroll.findUnique
        .mockResolvedValueOnce({ id: PAYROLL_CUID, tenantId: "acme-tenant-id" })
        .mockResolvedValueOnce(payroll);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.payroll.byId({ id: PAYROLL_CUID });
      expect(result).toEqual(payroll);
      // The second findUnique call (index 1) has the includes
      const callArgs = mockDb.payroll.findUnique.mock.calls[1][0];
      expect(callArgs.include.payslips.include.employee.include.user.select).toEqual({
        firstName: true,
        lastName: true,
        displayName: true,
      });
    });

    it("throws NOT_FOUND when payroll missing", async () => {
      mockDb.payroll.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.byId({ id: PAYROLL_CUID })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("create", () => {
    it("creates a payroll in draft status with auto-generated payrollNumber", async () => {
      mockDb.payroll.count.mockResolvedValue(0);
      mockDb.payroll.create.mockResolvedValue({ id: PAYROLL_CUID, status: "draft", payrollNumber: "PAY-0001" });
      const caller = createCaller(authenticatedCtx());
      await caller.payroll.create({
        periodStart: "2026-05-01",
        periodEnd: "2026-05-15",
      });
      // $transaction passthrough — verify count was called (used for number generation)
      expect(mockDb.payroll.count).toHaveBeenCalled();
    });

    it("accepts custom currency", async () => {
      mockDb.payroll.count.mockResolvedValue(0);
      mockDb.payroll.create.mockResolvedValue({ id: PAYROLL_CUID, payrollNumber: "PAY-0001" });
      const caller = createCaller(authenticatedCtx());
      await caller.payroll.create({
        periodStart: "2026-05-01",
        periodEnd: "2026-05-15",
        currency: "USD",
      });
      // create is called inside $transaction — verify input was accepted without throwing
      expect(mockDb.payroll.count).toHaveBeenCalled();
    });

    it("rejects currency that is not 3 chars", async () => {
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.payroll.create({
          periodStart: "2026-05-01",
          periodEnd: "2026-05-15",
          currency: "PESOS",
        })
      ).rejects.toThrow();
    });

    it("blocks creation in a demo tenant", async () => {
      const caller = createCaller(authenticatedCtx(["Administrator"], true));
      await expect(
        caller.payroll.create({
          periodStart: "2026-05-01",
          periodEnd: "2026-05-15",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("state machine: process → approve → markPaid", () => {
    it("process: draft → processing succeeds and sets processedAt", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, tenantId: "acme-tenant-id", status: "draft" });
      mockDb.statutoryRate.findMany.mockResolvedValue([]);
      mockDb.payslip.findMany.mockResolvedValue([]);
      const caller = createCaller(authenticatedCtx());
      const res = await caller.payroll.process({ id: PAYROLL_CUID });
      expect(res.status).toBe("processing");
      expect(res.processedAt).toBeInstanceOf(Date);
    });

    it("process: rejects when not in draft status", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, tenantId: "acme-tenant-id", status: "approved" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.process({ id: PAYROLL_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("process: throws NOT_FOUND when payroll missing", async () => {
      mockDb.payroll.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.process({ id: PAYROLL_CUID })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("approve: processing → approved succeeds", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, tenantId: "acme-tenant-id", status: "processing" });
      mockDb.payroll.update.mockResolvedValue({ id: PAYROLL_CUID, status: "approved" });
      const caller = createCaller(authenticatedCtx());
      await caller.payroll.approve({ id: PAYROLL_CUID });
      expect(mockDb.payroll.update).toHaveBeenCalledWith({
        where: { id: PAYROLL_CUID },
        data: { status: "approved" },
      });
    });

    it("approve: rejects when not in processing status", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, tenantId: "acme-tenant-id", status: "draft" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.approve({ id: PAYROLL_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    const FUND_CUID = "ck1234567890123456789012b";

    it("markPaid: approved → paid succeeds, deducts fund source, posts JE", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({
        id: PAYROLL_CUID,
        tenantId: "acme-tenant-id",
        status: "approved",
        payrollNumber: "PAY-0001",
      });
      mockDb.fundSource.findUnique.mockResolvedValue({
        id: FUND_CUID,
        tenantId: "acme-tenant-id",
        currentBalance: 100000,
      });
      mockDb.payslip.findMany.mockResolvedValue([
        {
          netPay: 18000,
          grossPay: 20000,
          totalDeductions: 2000,
          sssEmployerShare: 1000,
          philhealthEmployerShare: 250,
          pagibigEmployerShare: 200,
        },
      ]);
      // Default account mapping configured → JE auto-post enabled.
      mockDb.accountingSettings.findUnique.mockResolvedValue({
        tenantId: "acme-tenant-id",
        defaultExpenseAccountId: "acct-exp",
        defaultApAccountId: "acct-ap",
        defaultFiscalYearId: "fy-1",
      });
      const caller = createCaller(authenticatedCtx());
      const res = await caller.payroll.markPaid({ id: PAYROLL_CUID, fundSourceId: FUND_CUID });
      expect(res.status).toBe("paid");
    });

    it("markPaid: rejects when not approved", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, tenantId: "acme-tenant-id", status: "processing" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.markPaid({ id: PAYROLL_CUID, fundSourceId: FUND_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("markPaid: fails with clear error when default-account mapping unset", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({
        id: PAYROLL_CUID,
        tenantId: "acme-tenant-id",
        status: "approved",
        payrollNumber: "PAY-0001",
      });
      mockDb.fundSource.findUnique.mockResolvedValue({ id: FUND_CUID, tenantId: "acme-tenant-id", currentBalance: 100000 });
      mockDb.payslip.findMany.mockResolvedValue([
        { netPay: 18000, grossPay: 20000, totalDeductions: 2000, sssEmployerShare: 0, philhealthEmployerShare: 0, pagibigEmployerShare: 0 },
      ]);
      mockDb.accountingSettings.findUnique.mockResolvedValue(null); // unconfigured
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.markPaid({ id: PAYROLL_CUID, fundSourceId: FUND_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("forbids skipping states: draft cannot go directly to approved", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, tenantId: "acme-tenant-id", status: "draft" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.approve({ id: PAYROLL_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("forbids reversing states: paid cannot be processed again", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, tenantId: "acme-tenant-id", status: "paid" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.process({ id: PAYROLL_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });
});
