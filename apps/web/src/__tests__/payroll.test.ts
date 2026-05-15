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
  },
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
        expect.objectContaining({ where: { status: "approved" } })
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
        payrollNumber: "PAY-1",
        payslips: [],
      };
      mockDb.payroll.findUnique.mockResolvedValue(payroll);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.payroll.byId({ id: PAYROLL_CUID });
      expect(result).toEqual(payroll);
      const callArgs = mockDb.payroll.findUnique.mock.calls[0][0];
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
      mockDb.payroll.create.mockResolvedValue({ id: PAYROLL_CUID, status: "draft" });
      const caller = createCaller(authenticatedCtx());
      await caller.payroll.create({
        periodStart: new Date("2026-05-01"),
        periodEnd: new Date("2026-05-15"),
      });
      const callArgs = mockDb.payroll.create.mock.calls[0][0];
      expect(callArgs.data.status).toBe("draft");
      expect(callArgs.data.currency).toBe("PHP");
      expect(callArgs.data.payrollNumber).toMatch(/^PAY-\d+$/);
    });

    it("accepts custom currency", async () => {
      mockDb.payroll.create.mockResolvedValue({ id: PAYROLL_CUID });
      const caller = createCaller(authenticatedCtx());
      await caller.payroll.create({
        periodStart: new Date("2026-05-01"),
        periodEnd: new Date("2026-05-15"),
        currency: "USD",
      });
      expect(mockDb.payroll.create.mock.calls[0][0].data.currency).toBe("USD");
    });

    it("rejects currency that is not 3 chars", async () => {
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.payroll.create({
          periodStart: new Date("2026-05-01"),
          periodEnd: new Date("2026-05-15"),
          currency: "PESOS",
        })
      ).rejects.toThrow();
    });

    it("blocks creation in a demo tenant", async () => {
      const caller = createCaller(authenticatedCtx(["Administrator"], true));
      await expect(
        caller.payroll.create({
          periodStart: new Date("2026-05-01"),
          periodEnd: new Date("2026-05-15"),
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("state machine: process → approve → markPaid", () => {
    it("process: draft → processing succeeds and sets processedAt", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, status: "draft" });
      mockDb.payroll.update.mockResolvedValue({ id: PAYROLL_CUID, status: "processing" });
      const caller = createCaller(authenticatedCtx());
      await caller.payroll.process({ id: PAYROLL_CUID });
      const callArgs = mockDb.payroll.update.mock.calls[0][0];
      expect(callArgs.data.status).toBe("processing");
      expect(callArgs.data.processedAt).toBeInstanceOf(Date);
    });

    it("process: rejects when not in draft status", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, status: "approved" });
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
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, status: "processing" });
      mockDb.payroll.update.mockResolvedValue({ id: PAYROLL_CUID, status: "approved" });
      const caller = createCaller(authenticatedCtx());
      await caller.payroll.approve({ id: PAYROLL_CUID });
      expect(mockDb.payroll.update).toHaveBeenCalledWith({
        where: { id: PAYROLL_CUID },
        data: { status: "approved" },
      });
    });

    it("approve: rejects when not in processing status", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, status: "draft" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.approve({ id: PAYROLL_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("markPaid: approved → paid succeeds and sets paidAt", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, status: "approved" });
      mockDb.payroll.update.mockResolvedValue({ id: PAYROLL_CUID, status: "paid" });
      const caller = createCaller(authenticatedCtx());
      await caller.payroll.markPaid({ id: PAYROLL_CUID });
      const callArgs = mockDb.payroll.update.mock.calls[0][0];
      expect(callArgs.data.status).toBe("paid");
      expect(callArgs.data.paidAt).toBeInstanceOf(Date);
    });

    it("markPaid: rejects when not approved", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, status: "processing" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.markPaid({ id: PAYROLL_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("markPaid: uses provided paidAt when given", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, status: "approved" });
      mockDb.payroll.update.mockResolvedValue({ id: PAYROLL_CUID });
      const caller = createCaller(authenticatedCtx());
      const customDate = new Date("2026-06-01");
      await caller.payroll.markPaid({ id: PAYROLL_CUID, paidAt: customDate });
      expect(mockDb.payroll.update.mock.calls[0][0].data.paidAt).toEqual(customDate);
    });

    it("forbids skipping states: draft cannot go directly to approved", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, status: "draft" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.approve({ id: PAYROLL_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("forbids reversing states: paid cannot be processed again", async () => {
      mockDb.payroll.findUnique.mockResolvedValue({ id: PAYROLL_CUID, status: "paid" });
      const caller = createCaller(authenticatedCtx());
      await expect(caller.payroll.process({ id: PAYROLL_CUID })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });
});
