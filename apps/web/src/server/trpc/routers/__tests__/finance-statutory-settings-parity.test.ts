/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
/**
 * Tenant-parity tests for the F3 finance additions (DECISIONS_LOG §B/§C):
 *   payroll.statutoryRate.list/upsert/seedDefaults — tenant-scoped, audited
 *   payroll.process                                — computes statutory deductions, tenant-scoped
 *   accounting.settings.get/update                 — default-account mapping, tenant-scoped, audited
 *
 * Mirrors the inline-vi.fn() hoisting pattern of payroll-tenant-parity.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const {
  mockStatutoryFindMany,
  mockStatutoryCreate,
  mockStatutoryCreateMany,
  mockPayrollFindUnique,
  mockPayrollUpdate,
  mockPayslipFindMany,
  mockSettingsFindUnique,
  mockSettingsUpsert,
  mockAccountFindUnique,
  mockFiscalYearFindUnique,
  mockWriteAuditLog,
  mockTransaction,
} = vi.hoisted(() => ({
  mockStatutoryFindMany: vi.fn(),
  mockStatutoryCreate: vi.fn(),
  mockStatutoryCreateMany: vi.fn(),
  mockPayrollFindUnique: vi.fn(),
  mockPayrollUpdate: vi.fn(),
  mockPayslipFindMany: vi.fn(),
  mockSettingsFindUnique: vi.fn(),
  mockSettingsUpsert: vi.fn(),
  mockAccountFindUnique: vi.fn(),
  mockFiscalYearFindUnique: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    statutoryRate: { findMany: mockStatutoryFindMany, create: mockStatutoryCreate, createMany: mockStatutoryCreateMany },
    payroll: { findUnique: mockPayrollFindUnique, update: mockPayrollUpdate },
    payslip: { findMany: mockPayslipFindMany },
    accountingSettings: { findUnique: mockSettingsFindUnique, upsert: mockSettingsUpsert },
    account: { findUnique: mockAccountFindUnique },
    fiscalYear: { findUnique: mockFiscalYearFindUnique },
    $transaction: mockTransaction,
  },
  writeAuditLog: mockWriteAuditLog,
}));

import { payrollRouter } from "@/server/trpc/routers/payroll";
import { accountingRouter } from "@/server/trpc/routers/accounting";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

function makeReq(): NextRequest {
  return {} as NextRequest;
}
function ctx(tenantId = "tenant-acme", roles: string[] = ["Administrator", "Accountant"]) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles,
    tenantSlug: "acme",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

const router = createTRPCRouter({ payroll: payrollRouter, accounting: accountingRouter });
const createCaller = createCallerFactory(router);

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      statutoryRate: { create: mockStatutoryCreate, createMany: mockStatutoryCreateMany },
      payslip: { update: vi.fn() },
      payroll: { update: mockPayrollUpdate },
      accountingSettings: { findUnique: mockSettingsFindUnique, upsert: mockSettingsUpsert },
    }),
  );
});

describe("payroll.statutoryRate", () => {
  it("list is scoped to ctx.tenantId", async () => {
    mockStatutoryFindMany.mockResolvedValue([]);
    await createCaller(ctx("tenant-acme")).payroll.statutoryRate.list();
    expect(mockStatutoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-acme" } }),
    );
  });

  it("upsert injects tenantId from ctx and writes an audit log", async () => {
    mockStatutoryCreate.mockResolvedValue({ id: "sr-1", type: "sss", source: "x", effectiveFrom: new Date() });
    await createCaller(ctx("tenant-acme")).payroll.statutoryRate.upsert({
      type: "sss",
      config: { totalRate: 0.15, employeeRate: 0.05, employerRate: 0.1, mscFloor: 5000, mscCeiling: 35000 },
      source: "SSS Circular 2024-006",
      effectiveFrom: "2025-01-01",
      isActive: true,
    });
    expect(mockStatutoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-acme", type: "sss" }) }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalled();
  });

  it("seedDefaults only creates types not already present, scoped to tenant", async () => {
    mockStatutoryFindMany.mockResolvedValue([{ type: "sss" }]);
    const res = await createCaller(ctx("tenant-acme")).payroll.statutoryRate.seedDefaults();
    expect(res.created).toBe(3); // philhealth, pagibig, withholding
    expect(mockStatutoryCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ tenantId: "tenant-acme" })]) }),
    );
  });
});

describe("payroll.process (statutory computation)", () => {
  it("rejects non-draft runs", async () => {
    mockPayrollFindUnique.mockResolvedValue({ id: "p-1", tenantId: "tenant-acme", status: "approved" });
    await expect(
      createCaller(ctx("tenant-acme")).payroll.process({ id: "ck1234567890123456789012a" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("computes deductions for draft run scoped to tenant", async () => {
    mockPayrollFindUnique.mockResolvedValue({ id: "p-1", tenantId: "tenant-acme", status: "draft" });
    mockStatutoryFindMany.mockResolvedValue([]);
    mockPayslipFindMany.mockResolvedValue([
      { id: "ps-1", basicPay: 30000, overtimePay: 0, allowances: 0, cashAdvanceDeduction: 0, otherDeductions: 0 },
    ]);
    mockPayrollUpdate.mockResolvedValue({ id: "p-1", status: "processing", totalNet: 27550 });
    await createCaller(ctx("tenant-acme")).payroll.process({ id: "ck1234567890123456789012a" });
    expect(mockPayslipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { payrollId: "ck1234567890123456789012a", tenantId: "tenant-acme" } }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalled();
  });
});

describe("accounting.settings", () => {
  it("get returns default-shaped object scoped to tenant when none stored", async () => {
    mockSettingsFindUnique.mockResolvedValue(null);
    const res = await createCaller(ctx("tenant-acme")).accounting.settings.get();
    expect(res.tenantId).toBe("tenant-acme");
    expect(res.defaultApAccountId).toBeNull();
  });

  it("update validates referenced account belongs to tenant", async () => {
    mockAccountFindUnique.mockResolvedValue({ id: "acct-x", tenantId: "tenant-OTHER" });
    await expect(
      createCaller(ctx("tenant-acme")).accounting.settings.update({ defaultApAccountId: "acct-x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("update upserts mapping scoped to tenant and audits", async () => {
    mockAccountFindUnique.mockResolvedValue({ id: "acct-ap", tenantId: "tenant-acme", isActive: true });
    mockSettingsFindUnique.mockResolvedValue(null);
    mockSettingsUpsert.mockResolvedValue({ id: "s-1", defaultApAccountId: "acct-ap" });
    await createCaller(ctx("tenant-acme")).accounting.settings.update({ defaultApAccountId: "acct-ap" });
    expect(mockSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-acme" } }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalled();
  });
});
