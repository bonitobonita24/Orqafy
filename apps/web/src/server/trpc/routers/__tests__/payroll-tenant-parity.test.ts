/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * Payroll tenant-parity tests
 *
 * Covers every NEW mutation added in the Phase-7 payroll scaffolding:
 *   payroll.create         — tenantId from ctx; $transaction + writeAuditLog
 *   payroll.update         — cross-tenant guard; draft-only guard; writeAuditLog
 *   payroll.payslip.add    — payroll + employee cross-tenant guards; draft-only; writeAuditLog
 *   payroll.payslip.update — payslip + parent payroll cross-tenant guards; draft-only; writeAuditLog
 *   payroll.payslip.remove — payslip + parent payroll cross-tenant guards; draft-only; writeAuditLog
 *
 * Pattern mirrors accounting-ui-tenant-parity.test.ts: vi.mock factory uses only
 * vi.fn() inline so hoisting works correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── DB mock (all vi.fn() inline — no external refs, hoisting-safe) ────────────
const {
  mockPayrollFindUnique,
  mockPayrollCreate,
  mockPayrollUpdate,
  mockPayrollCount,
  mockPayslipFindUnique,
  mockPayslipCreate,
  mockPayslipUpdate,
  mockPayslipDelete,
  mockEmployeeFindUnique,
  mockWriteAuditLog,
  mockTransaction,
} = vi.hoisted(() => ({
  mockPayrollFindUnique: vi.fn(),
  mockPayrollCreate: vi.fn(),
  mockPayrollUpdate: vi.fn(),
  mockPayrollCount: vi.fn(),
  mockPayslipFindUnique: vi.fn(),
  mockPayslipCreate: vi.fn(),
  mockPayslipUpdate: vi.fn(),
  mockPayslipDelete: vi.fn(),
  mockEmployeeFindUnique: vi.fn(),
  mockWriteAuditLog: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@orqafy/db", () => ({
  prisma: {
    payroll: {
      findUnique: mockPayrollFindUnique,
      create: mockPayrollCreate,
      update: mockPayrollUpdate,
      count: mockPayrollCount,
    },
    payslip: {
      findUnique: mockPayslipFindUnique,
      create: mockPayslipCreate,
      update: mockPayslipUpdate,
      delete: mockPayslipDelete,
    },
    employee: {
      findUnique: mockEmployeeFindUnique,
    },
    $transaction: mockTransaction,
  },
  writeAuditLog: mockWriteAuditLog,
}));

import { payrollRouter } from "@/server/trpc/routers/payroll";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function adminCtx(tenantId = "tenant-acme") {
  return {
    req: makeReq(),
    userId: "user-admin",
    roles: ["Administrator"],
    tenantSlug: "acme",
    tenantId,
    securityVersion: 1,
    isDemoTenant: false,
    session: null,
  };
}

function unauthCtx() {
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

const PAYROLL_CUID = "ck1111111111111111111111a";
const PAYSLIP_CUID = "ck2222222222222222222222b";
const EMP_CUID = "ck3333333333333333333333c";

const fakeDraftPayroll = {
  id: PAYROLL_CUID,
  tenantId: "tenant-acme",
  payrollNumber: "PAY-0001",
  periodStart: new Date("2026-01-01"),
  periodEnd: new Date("2026-01-15"),
  status: "draft",
  currency: "PHP",
  totalGross: 0,
  totalDeductions: 0,
  totalNet: 0,
  notes: null,
  processedAt: null,
  paidAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakePayslip = {
  id: PAYSLIP_CUID,
  tenantId: "tenant-acme",
  payrollId: PAYROLL_CUID,
  employeeId: EMP_CUID,
  basicPay: 15000,
  overtimePay: 0,
  allowances: 0,
  grossPay: 15000,
  sssDeduction: 0,
  philhealthDeduction: 0,
  pagibigDeduction: 0,
  taxDeduction: 0,
  cashAdvanceDeduction: 0,
  otherDeductions: 0,
  totalDeductions: 0,
  netPay: 15000,
  deductionDetails: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeEmployee = {
  id: EMP_CUID,
  tenantId: "tenant-acme",
  employeeNumber: "EMP-001",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default $transaction passthrough
  mockTransaction.mockImplementation((fn: (tx: any) => Promise<unknown>): unknown =>
    fn({
      payroll: { create: mockPayrollCreate, update: mockPayrollUpdate },
      payslip: {
        create: mockPayslipCreate,
        update: mockPayslipUpdate,
        delete: mockPayslipDelete,
      },
    }),
  );
});

// ── payroll.create ────────────────────────────────────────────────────────────

describe("payroll.create — tenant isolation", () => {
  it("injects tenantId from ctx, not from input", async () => {
    mockPayrollCount.mockResolvedValue(0);
    mockPayrollCreate.mockResolvedValue({ ...fakeDraftPayroll });

    await createCaller(adminCtx()).payroll.create({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-15",
    });

    expect(mockPayrollCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-acme" }),
      }),
    );
  });

  it("calls writeAuditLog inside $transaction", async () => {
    mockPayrollCount.mockResolvedValue(0);
    mockPayrollCreate.mockResolvedValue(fakeDraftPayroll);

    await createCaller(adminCtx()).payroll.create({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-15",
    });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "CREATE", entity: "Payroll" }),
    );
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      createCaller(unauthCtx()).payroll.create({
        periodStart: "2026-01-01",
        periodEnd: "2026-01-15",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ── payroll.update ────────────────────────────────────────────────────────────

describe("payroll.update — tenant isolation", () => {
  it("throws NOT_FOUND when payroll.tenantId !== ctx.tenantId", async () => {
    mockPayrollFindUnique.mockResolvedValue({
      ...fakeDraftPayroll,
      tenantId: "tenant-other",
    });

    await expect(
      createCaller(adminCtx()).payroll.update({ id: PAYROLL_CUID, currency: "USD" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when payroll is not draft", async () => {
    mockPayrollFindUnique.mockResolvedValue({
      ...fakeDraftPayroll,
      status: "approved",
    });

    await expect(
      createCaller(adminCtx()).payroll.update({ id: PAYROLL_CUID, currency: "USD" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("calls writeAuditLog on successful update", async () => {
    mockPayrollFindUnique.mockResolvedValue(fakeDraftPayroll);
    mockPayrollUpdate.mockResolvedValue({ ...fakeDraftPayroll, currency: "USD" });

    await createCaller(adminCtx()).payroll.update({ id: PAYROLL_CUID, currency: "USD" });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "UPDATE", entity: "Payroll", entityId: PAYROLL_CUID }),
    );
  });
});

// ── payroll.payslip.add ───────────────────────────────────────────────────────

describe("payroll.payslip.add — tenant isolation", () => {
  it("injects tenantId from ctx on payslip create", async () => {
    mockPayrollFindUnique.mockResolvedValue(fakeDraftPayroll);
    mockEmployeeFindUnique.mockResolvedValue(fakeEmployee);
    mockPayslipCreate.mockResolvedValue(fakePayslip);

    await createCaller(adminCtx()).payroll.payslip.add({
      payrollId: PAYROLL_CUID,
      employeeId: EMP_CUID,
      basicPay: 15000,
    });

    expect(mockPayslipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-acme" }),
      }),
    );
  });

  it("throws NOT_FOUND when payroll.tenantId !== ctx.tenantId", async () => {
    mockPayrollFindUnique.mockResolvedValue({
      ...fakeDraftPayroll,
      tenantId: "tenant-other",
    });

    await expect(
      createCaller(adminCtx()).payroll.payslip.add({
        payrollId: PAYROLL_CUID,
        employeeId: EMP_CUID,
        basicPay: 15000,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when employee.tenantId !== ctx.tenantId", async () => {
    mockPayrollFindUnique.mockResolvedValue(fakeDraftPayroll);
    mockEmployeeFindUnique.mockResolvedValue({ ...fakeEmployee, tenantId: "tenant-other" });

    await expect(
      createCaller(adminCtx()).payroll.payslip.add({
        payrollId: PAYROLL_CUID,
        employeeId: EMP_CUID,
        basicPay: 15000,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when payroll is not draft", async () => {
    mockPayrollFindUnique.mockResolvedValue({
      ...fakeDraftPayroll,
      status: "approved",
    });

    await expect(
      createCaller(adminCtx()).payroll.payslip.add({
        payrollId: PAYROLL_CUID,
        employeeId: EMP_CUID,
        basicPay: 15000,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("calls writeAuditLog inside $transaction", async () => {
    mockPayrollFindUnique.mockResolvedValue(fakeDraftPayroll);
    mockEmployeeFindUnique.mockResolvedValue(fakeEmployee);
    mockPayslipCreate.mockResolvedValue(fakePayslip);

    await createCaller(adminCtx()).payroll.payslip.add({
      payrollId: PAYROLL_CUID,
      employeeId: EMP_CUID,
      basicPay: 15000,
    });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "CREATE", entity: "Payslip" }),
    );
  });
});

// ── payroll.payslip.update ────────────────────────────────────────────────────

describe("payroll.payslip.update — tenant isolation", () => {
  it("throws NOT_FOUND when payslip.tenantId !== ctx.tenantId", async () => {
    mockPayslipFindUnique.mockResolvedValue({
      ...fakePayslip,
      tenantId: "tenant-other",
    });

    await expect(
      createCaller(adminCtx()).payroll.payslip.update({ id: PAYSLIP_CUID, basicPay: 20000 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when parent payroll is not draft", async () => {
    mockPayslipFindUnique.mockResolvedValue(fakePayslip);
    mockPayrollFindUnique.mockResolvedValue({ ...fakeDraftPayroll, status: "approved" });

    await expect(
      createCaller(adminCtx()).payroll.payslip.update({ id: PAYSLIP_CUID, basicPay: 20000 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("calls writeAuditLog on successful update", async () => {
    mockPayslipFindUnique.mockResolvedValue(fakePayslip);
    mockPayrollFindUnique.mockResolvedValue(fakeDraftPayroll);
    mockPayslipUpdate.mockResolvedValue({
      ...fakePayslip,
      basicPay: 20000,
      grossPay: 20000,
      netPay: 20000,
    });

    await createCaller(adminCtx()).payroll.payslip.update({ id: PAYSLIP_CUID, basicPay: 20000 });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "UPDATE", entity: "Payslip", entityId: PAYSLIP_CUID }),
    );
  });
});

// ── payroll.payslip.remove ────────────────────────────────────────────────────

describe("payroll.payslip.remove — tenant isolation", () => {
  it("throws NOT_FOUND when payslip.tenantId !== ctx.tenantId", async () => {
    mockPayslipFindUnique.mockResolvedValue({
      ...fakePayslip,
      tenantId: "tenant-other",
    });

    await expect(
      createCaller(adminCtx()).payroll.payslip.remove({ id: PAYSLIP_CUID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when parent payroll is not draft", async () => {
    mockPayslipFindUnique.mockResolvedValue(fakePayslip);
    mockPayrollFindUnique.mockResolvedValue({ ...fakeDraftPayroll, status: "approved" });

    await expect(
      createCaller(adminCtx()).payroll.payslip.remove({ id: PAYSLIP_CUID }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("calls writeAuditLog on successful remove", async () => {
    mockPayslipFindUnique.mockResolvedValue(fakePayslip);
    mockPayrollFindUnique.mockResolvedValue(fakeDraftPayroll);
    mockPayslipDelete.mockResolvedValue(fakePayslip);

    await createCaller(adminCtx()).payroll.payslip.remove({ id: PAYSLIP_CUID });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "DELETE", entity: "Payslip", entityId: PAYSLIP_CUID }),
    );
  });
});
