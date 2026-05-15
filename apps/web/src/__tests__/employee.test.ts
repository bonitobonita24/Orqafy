/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { employeeRouter } from "@/server/trpc/routers/employee";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

vi.mock("@orqafy/db", () => ({
  prisma: {
    employee: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
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

const testRouter = createTRPCRouter({ employee: employeeRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  employee: {
    findMany: any;
    findUnique: any;
    count: any;
    create: any;
    update: any;
  };
  user: { findUnique: any };
  department: { findMany: any };
};

const VALID_CUID = "ck1234567890123456789012a";
const USER_CUID = "ck1234567890123456789012b";
const DEPT_CUID = "ck1234567890123456789012c";

describe("employee router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns paginated employees with default page=1 limit=50", async () => {
      mockDb.employee.findMany.mockResolvedValue([
        { id: VALID_CUID, employeeNumber: "EMP-1", user: { firstName: "Alice", lastName: "Cruz", displayName: null, email: "a@example.com" }, department: null },
      ]);
      mockDb.employee.count.mockResolvedValue(1);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.employee.list({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(mockDb.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50, orderBy: { createdAt: "desc" } })
      );
    });

    it("filters by departmentId when provided", async () => {
      mockDb.employee.findMany.mockResolvedValue([]);
      mockDb.employee.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.employee.list({ departmentId: DEPT_CUID });
      expect(mockDb.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ departmentId: DEPT_CUID }) })
      );
    });

    it("filters by employmentType when provided", async () => {
      mockDb.employee.findMany.mockResolvedValue([]);
      mockDb.employee.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.employee.list({ employmentType: "contract" });
      expect(mockDb.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ employmentType: "contract" }) })
      );
    });

    it("applies search across firstName, lastName, and email", async () => {
      mockDb.employee.findMany.mockResolvedValue([]);
      mockDb.employee.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.employee.list({ search: "alice" });
      const callArgs = mockDb.employee.findMany.mock.calls[0][0];
      expect(callArgs.where.user.OR).toEqual([
        { firstName: { contains: "alice", mode: "insensitive" } },
        { lastName: { contains: "alice", mode: "insensitive" } },
        { email: { contains: "alice", mode: "insensitive" } },
      ]);
    });

    it("respects pagination params (page=3 limit=10)", async () => {
      mockDb.employee.findMany.mockResolvedValue([]);
      mockDb.employee.count.mockResolvedValue(0);
      const caller = createCaller(authenticatedCtx());
      await caller.employee.list({ page: 3, limit: 10 });
      expect(mockDb.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });

    it("rejects unauthenticated callers", async () => {
      const caller = createCaller(unauthenticatedCtx());
      await expect(caller.employee.list({})).rejects.toThrow(TRPCError);
    });
  });

  describe("byId", () => {
    it("returns employee when found", async () => {
      const employee = {
        id: VALID_CUID,
        employeeNumber: "EMP-1",
        user: { firstName: "Alice", lastName: "Cruz", displayName: null, email: "a@example.com", isActive: true },
        department: null,
      };
      mockDb.employee.findUnique.mockResolvedValue(employee);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.employee.byId({ id: VALID_CUID });
      expect(result).toEqual(employee);
    });

    it("throws NOT_FOUND when employee is missing", async () => {
      mockDb.employee.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(caller.employee.byId({ id: VALID_CUID })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("create", () => {
    it("creates an employee with auto-generated employeeNumber", async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: USER_CUID });
      mockDb.employee.create.mockResolvedValue({ id: VALID_CUID, employeeNumber: "EMP-123" });
      const caller = createCaller(authenticatedCtx());
      const result = await caller.employee.create({
        userId: USER_CUID,
        dateHired: new Date("2026-01-01"),
        employmentType: "full_time",
      });
      expect(result.id).toBe(VALID_CUID);
      const callArgs = mockDb.employee.create.mock.calls[0][0];
      expect(callArgs.data.userId).toBe(USER_CUID);
      expect(callArgs.data.employmentType).toBe("full_time");
      expect(callArgs.data.employeeNumber).toMatch(/^EMP-\d+$/);
    });

    it("throws BAD_REQUEST when user does not exist", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.employee.create({
          userId: USER_CUID,
          dateHired: new Date("2026-01-01"),
          employmentType: "full_time",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects negative baseSalary via Zod validation", async () => {
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.employee.create({
          userId: USER_CUID,
          dateHired: new Date("2026-01-01"),
          employmentType: "full_time",
          baseSalary: -1000,
        })
      ).rejects.toThrow();
    });

    it("persists optional government IDs when provided", async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: USER_CUID });
      mockDb.employee.create.mockResolvedValue({ id: VALID_CUID });
      const caller = createCaller(authenticatedCtx());
      await caller.employee.create({
        userId: USER_CUID,
        dateHired: new Date("2026-01-01"),
        employmentType: "full_time",
        sssNumber: "12-3456789-0",
        philhealthNumber: "PH-001",
        pagibigNumber: "PG-001",
        tinNumber: "TIN-001",
      });
      const callArgs = mockDb.employee.create.mock.calls[0][0];
      expect(callArgs.data.sssNumber).toBe("12-3456789-0");
      expect(callArgs.data.philhealthNumber).toBe("PH-001");
      expect(callArgs.data.pagibigNumber).toBe("PG-001");
      expect(callArgs.data.tinNumber).toBe("TIN-001");
    });

    it("blocks writes when caller is in a demo tenant", async () => {
      const caller = createCaller(authenticatedCtx(["Administrator"], true));
      await expect(
        caller.employee.create({
          userId: USER_CUID,
          dateHired: new Date("2026-01-01"),
          employmentType: "full_time",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("update", () => {
    it("updates allowed fields and ignores userId", async () => {
      mockDb.employee.findUnique.mockResolvedValue({ id: VALID_CUID });
      mockDb.employee.update.mockResolvedValue({ id: VALID_CUID, position: "Manager" });
      const caller = createCaller(authenticatedCtx());
      await caller.employee.update({ id: VALID_CUID, position: "Manager" });
      const callArgs = mockDb.employee.update.mock.calls[0][0];
      expect(callArgs.where).toEqual({ id: VALID_CUID });
      expect(callArgs.data.position).toBe("Manager");
      expect(callArgs.data).not.toHaveProperty("userId");
    });

    it("throws NOT_FOUND when employee missing", async () => {
      mockDb.employee.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(caller.employee.update({ id: VALID_CUID, position: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("terminate", () => {
    it("sets dateTerminated", async () => {
      mockDb.employee.findUnique.mockResolvedValue({ id: VALID_CUID });
      const terminationDate = new Date("2026-06-01");
      mockDb.employee.update.mockResolvedValue({ id: VALID_CUID, dateTerminated: terminationDate });
      const caller = createCaller(authenticatedCtx());
      await caller.employee.terminate({ id: VALID_CUID, dateTerminated: terminationDate });
      expect(mockDb.employee.update).toHaveBeenCalledWith({
        where: { id: VALID_CUID },
        data: { dateTerminated: terminationDate },
      });
    });

    it("throws NOT_FOUND when employee missing", async () => {
      mockDb.employee.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.employee.terminate({ id: VALID_CUID, dateTerminated: new Date() })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("blocks termination in a demo tenant", async () => {
      const caller = createCaller(authenticatedCtx(["Administrator"], true));
      await expect(
        caller.employee.terminate({ id: VALID_CUID, dateTerminated: new Date() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("departments", () => {
    it("returns active departments ordered by name", async () => {
      const depts = [{ id: DEPT_CUID, name: "Engineering", isActive: true }];
      mockDb.department.findMany.mockResolvedValue(depts);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.employee.departments();
      expect(result).toEqual(depts);
      expect(mockDb.department.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });
    });
  });
});
