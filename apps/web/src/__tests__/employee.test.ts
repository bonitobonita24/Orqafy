/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { employeeRouter } from "@/server/trpc/routers/employee";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import type * as OrqafyDb from "@orqafy/db";

// Router migrated to the data-driven `role_permissions` matrix (feature key
// "employees") — matrixMiddleware imports the real `hasPermission` resolver
// from "@orqafy/db" directly, so this mock spreads the actual module (via
// vi.importActual) and only overrides the `prisma` client it reads from.
// This suite defaults every ctx to a "Platform Owner" role, which bypasses
// the matrix entirely (see employee-matrix.test.ts for grant/deny coverage).
vi.mock("@orqafy/db", async () => {
  const actual = await vi.importActual<typeof OrqafyDb>("@orqafy/db");
  const mockPrisma = {
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
      findUnique: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    role: { findFirst: vi.fn() },
    rolePermission: { findUnique: vi.fn() },
  };
  return {
    ...actual,
    prisma: {
      ...mockPrisma,
      $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
    },
    writeAuditLog: async (tx: any, entry: any) => { await tx.auditLog.create({ data: entry }); },
  };
});

vi.mock("@/server/lib/rate-limit", () => ({
  rateLimiters: {
    api: { check: vi.fn() },
    auth: { check: vi.fn() },
    upload: { check: vi.fn() },
    public: { check: vi.fn() },
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
    roleId: "role-1",
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
    roleId: null,
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
  department: { findMany: any; findUnique: any };
  auditLog: { create: any };
  role: { findFirst: any };
  rolePermission: { findUnique: any };
};

const VALID_CUID = "ck1234567890123456789012a";
const USER_CUID = "ck1234567890123456789012b";
const DEPT_CUID = "ck1234567890123456789012c";

describe("employee router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every test's caller resolves to a "Platform Owner" role by default,
    // which bypasses the "employees" matrix entirely (tenant-rbac-standard.md
    // §4) — this suite exercises router business logic, not matrix
    // grant/deny behaviour (see employee-matrix.test.ts for that coverage).
    mockDb.role.findFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "acme-tenant-id",
      name: "Platform Owner",
    });
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
        tenantId: "acme-tenant-id",
        employeeNumber: "EMP-1",
        user: { firstName: "Alice", lastName: "Cruz", displayName: null, email: "a@example.com", isActive: true },
        department: null,
      };
      // First call: guard (returns bare object with tenantId)
      // Second call: full fetch with includes
      mockDb.employee.findUnique
        .mockResolvedValueOnce({ id: VALID_CUID, tenantId: "acme-tenant-id" })
        .mockResolvedValueOnce(employee);
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
      mockDb.user.findUnique.mockResolvedValue({ id: USER_CUID, tenantId: "acme-tenant-id" });
      mockDb.employee.create.mockResolvedValue({ id: VALID_CUID, employeeNumber: "EMP-123", dateHired: new Date("2026-01-01"), position: null, employmentType: "full_time" });
      const caller = createCaller(authenticatedCtx());
      const result = await caller.employee.create({
        userId: USER_CUID,
        dateHired: new Date("2026-01-01"),
        employmentType: "full_time",
      });
      expect(result.id).toBe(VALID_CUID);
      const callArgs = mockDb.employee.create.mock.calls[0][0];
      expect(callArgs.data.tenantId).toBe("acme-tenant-id");
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
      mockDb.user.findUnique.mockResolvedValue({ id: USER_CUID, tenantId: "acme-tenant-id" });
      mockDb.employee.create.mockResolvedValue({ id: VALID_CUID, dateHired: new Date("2026-01-01"), position: null, employmentType: "full_time" });
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

    it("rejects a cross-tenant userId (BAD_REQUEST)", async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: USER_CUID, tenantId: "other-tenant-id" });
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.employee.create({
          userId: USER_CUID,
          dateHired: new Date("2026-01-01"),
          employmentType: "full_time",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockDb.employee.create).not.toHaveBeenCalled();
    });

    it("rejects a cross-tenant departmentId (BAD_REQUEST)", async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: USER_CUID, tenantId: "acme-tenant-id" });
      mockDb.department.findUnique.mockResolvedValue({ id: DEPT_CUID, tenantId: "other-tenant-id" });
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.employee.create({
          userId: USER_CUID,
          departmentId: DEPT_CUID,
          dateHired: new Date("2026-01-01"),
          employmentType: "full_time",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockDb.employee.create).not.toHaveBeenCalled();
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

    it("writes an audit log row with action CREATE and entity Employee", async () => {
      mockDb.user.findUnique.mockResolvedValue({ id: USER_CUID, tenantId: "acme-tenant-id" });
      mockDb.employee.create.mockResolvedValue({ id: VALID_CUID, employeeNumber: "EMP-999", dateHired: new Date("2026-01-01"), position: null, employmentType: "full_time" });
      const caller = createCaller(authenticatedCtx());
      await caller.employee.create({
        userId: USER_CUID,
        dateHired: new Date("2026-01-01"),
        employmentType: "full_time",
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CREATE", entity: "Employee" }),
        }),
      );
    });
  });

  describe("update", () => {
    it("updates allowed fields and ignores userId", async () => {
      // update: loadEmployeeForTenant (findUnique #1) then findUnique #2 for existing check
      mockDb.employee.findUnique
        .mockResolvedValueOnce({ id: VALID_CUID, tenantId: "acme-tenant-id" })
        .mockResolvedValueOnce({ id: VALID_CUID, tenantId: "acme-tenant-id", dateHired: new Date("2026-01-01"), position: null, employmentType: "full_time", departmentId: null });
      mockDb.employee.update.mockResolvedValue({ id: VALID_CUID, position: "Manager", dateHired: new Date("2026-01-01"), employmentType: "full_time", departmentId: null });
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

    it("rejects a cross-tenant departmentId (BAD_REQUEST)", async () => {
      mockDb.employee.findUnique
        .mockResolvedValueOnce({ id: VALID_CUID, tenantId: "acme-tenant-id" })
        .mockResolvedValueOnce({ id: VALID_CUID, tenantId: "acme-tenant-id", dateHired: new Date("2026-01-01"), position: null, employmentType: "full_time", departmentId: null });
      mockDb.department.findUnique.mockResolvedValue({ id: DEPT_CUID, tenantId: "other-tenant-id" });
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.employee.update({ id: VALID_CUID, departmentId: DEPT_CUID })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockDb.employee.update).not.toHaveBeenCalled();
    });
  });

  describe("terminate", () => {
    it("sets dateTerminated", async () => {
      mockDb.employee.findUnique.mockResolvedValue({ id: VALID_CUID, tenantId: "acme-tenant-id" });
      const terminationDate = new Date("2026-06-01");
      mockDb.employee.update.mockResolvedValue({ id: VALID_CUID, dateTerminated: terminationDate });
      const caller = createCaller(authenticatedCtx(["HR Manager"]));
      await caller.employee.terminate({ id: VALID_CUID, dateTerminated: terminationDate });
      expect(mockDb.employee.update).toHaveBeenCalledWith({
        where: { id: VALID_CUID },
        data: { dateTerminated: terminationDate },
      });
    });

    it("throws NOT_FOUND when employee missing", async () => {
      mockDb.employee.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx(["HR Manager"]));
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

    // ── Epic-2 state-machine guards (Phase 7) ──────────────────────────────
    it("rejects terminating an already-terminated employee (BAD_REQUEST)", async () => {
      mockDb.employee.findUnique.mockResolvedValue({
        id: VALID_CUID,
        tenantId: "acme-tenant-id",
        dateTerminated: new Date("2026-01-01"),
      });
      const caller = createCaller(authenticatedCtx(["HR Manager"]));
      await expect(
        caller.employee.terminate({ id: VALID_CUID, dateTerminated: new Date("2026-06-01") })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockDb.employee.update).not.toHaveBeenCalled();
    });

    it("gates termination to HR authority — FORBIDDEN for a non-HR role", async () => {
      const caller = createCaller(authenticatedCtx(["Employee"]));
      await expect(
        caller.employee.terminate({ id: VALID_CUID, dateTerminated: new Date() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mockDb.employee.update).not.toHaveBeenCalled();
    });

    it("allows termination for an HR Manager role", async () => {
      mockDb.employee.findUnique.mockResolvedValue({
        id: VALID_CUID,
        tenantId: "acme-tenant-id",
        dateTerminated: null,
      });
      const terminationDate = new Date("2026-06-01");
      mockDb.employee.update.mockResolvedValue({ id: VALID_CUID, dateTerminated: terminationDate });
      const caller = createCaller(authenticatedCtx(["HR Manager"]));
      await caller.employee.terminate({ id: VALID_CUID, dateTerminated: terminationDate });
      expect(mockDb.employee.update).toHaveBeenCalledWith({
        where: { id: VALID_CUID },
        data: { dateTerminated: terminationDate },
      });
    });

    // Owner decision (D-RBAC-DEADGATE): the delegated Admin tier may terminate
    // too, so the terminate roster matches the dtr.ts approver list.
    it("allows termination for an Admin role", async () => {
      mockDb.employee.findUnique.mockResolvedValue({
        id: VALID_CUID,
        tenantId: "acme-tenant-id",
        dateTerminated: null,
      });
      const terminationDate = new Date("2026-06-01");
      mockDb.employee.update.mockResolvedValue({ id: VALID_CUID, dateTerminated: terminationDate });
      const caller = createCaller(authenticatedCtx(["Admin"]));
      await caller.employee.terminate({ id: VALID_CUID, dateTerminated: terminationDate });
      expect(mockDb.employee.update).toHaveBeenCalledOnce();
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
        where: { tenantId: "acme-tenant-id", isActive: true },
        orderBy: { name: "asc" },
      });
    });
  });
});
