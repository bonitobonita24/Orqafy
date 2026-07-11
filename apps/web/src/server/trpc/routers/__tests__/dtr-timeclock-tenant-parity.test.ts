/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/**
 * DTR Timeclock tenant-parity tests
 *
 * Proves:
 *  1. attendanceClockIn injects tenantId from ctx (not from input) + writes audit log
 *  2. attendanceClockIn throws CONFLICT when a clock-in record already exists today
 *     (double-clock-in guard)
 *  3. attendanceClockIn throws NOT_FOUND when the employeeId belongs to a different
 *     tenant (tenant-scope isolation)
 *  4. attendanceClockOut throws NOT_FOUND when the attendanceId belongs to a different
 *     tenant (tenant-scope isolation)
 *  5. attendanceClockOut throws BAD_REQUEST when the record is already clocked out
 *  6. writeProcedure (demo guard) blocks clock-in mutations on demo tenant
 *  7. attendanceApprove throws FORBIDDEN for non-approver roles (RBAC)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── DB mock (hoisted so vi.mock factory can reference) ────────────────────────
const {
  mockEmployeeFindUnique,
  mockAttendanceFindFirst,
  mockAttendanceFindUnique,
  mockAttendanceCreate,
  mockAttendanceUpdate,
  mockAuditLogCreate,
  mockRoleFindFirst,
} = vi.hoisted(() => ({
  mockEmployeeFindUnique: vi.fn(),
  mockAttendanceFindFirst: vi.fn(),
  mockAttendanceFindUnique: vi.fn(),
  mockAttendanceCreate: vi.fn(),
  mockAttendanceUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockRoleFindFirst: vi.fn(),
}));

vi.mock("@orqafy/db", () => {
  // mockDb is the object passed INTO the $transaction callback.
  // It must include every model the router touches inside a transaction.
  const mockDb = {
    employee: { findUnique: mockEmployeeFindUnique },
    attendanceRecord: {
      findFirst: mockAttendanceFindFirst,
      findUnique: mockAttendanceFindUnique,
      create: mockAttendanceCreate,
      update: mockAttendanceUpdate,
    },
    auditLog: { create: mockAuditLogCreate },
  };
  return {
    prisma: {
      ...mockDb,
      // RBAC matrix middleware (dtr router migrated to `matrixProcedure` /
      // `matrixMiddleware("dtr", ...)`). Every ctxForTenant() caller below
      // resolves to a "Platform Owner" DB role, which `hasPermission`
      // bypasses entirely — preserves this file's original intent of
      // exercising tenant-scope isolation + demo guard + approver-role
      // checks, not the matrix grant itself (covered by dtr-matrix.test.ts).
      role: { findFirst: mockRoleFindFirst },
      // $transaction passes mockDb as "tx" so router's tx.attendanceRecord.xxx
      // calls resolve to the same mocks.
      $transaction: vi.fn((fn: any) => fn(mockDb)),
    },
    writeAuditLog: async (tx: any, entry: any) => {
      await tx.auditLog.create({ data: entry });
    },
    // Minimal stand-in for the real @orqafy/db#hasPermission resolver —
    // mirrors its Platform Owner / Tenant Super Admin bypass path only
    // (matrix-row grants are exercised separately in dtr-matrix.test.ts).
    hasPermission: async (
      _prisma: unknown,
      args: { roleId: string; tenantId: string },
    ): Promise<boolean> => {
      const role = (await mockRoleFindFirst({
        where: { id: args.roleId, tenantId: args.tenantId },
      })) as { name: string } | null;
      if (!role) return false;
      return ["Platform Owner", "Tenant Super Admin"].includes(role.name);
    },
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { dtrRouter } from "@/server/trpc/routers/dtr";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";

const testRouter = createTRPCRouter({ dtr: dtrRouter });
const createCaller = createCallerFactory(testRouter);

function makeReq(): NextRequest {
  return {} as NextRequest;
}

function ctxForTenant(
  tenantId: string,
  options: { isDemoTenant?: boolean; roles?: string[] } = {},
) {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: options.roles ?? ["Administrator"],
    roleId: "role-1",
    tenantSlug: "test",
    tenantId,
    securityVersion: 1,
    isDemoTenant: options.isDemoTenant ?? false,
    session: null,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMP_A = {
  id: "emp-a-000000000000000000000000",
  tenantId: "tenant-A",
  userId: "user-1",
  employeeNumber: "EMP-001",
};

const ATT_A = {
  id: "att-a-000000000000000000000000",
  tenantId: "tenant-A",
  employeeId: EMP_A.id,
  date: new Date(),
  clockIn: new Date("2026-06-15T08:00:00Z"),
  clockOut: null as Date | null,
  clockInLat: null,
  clockInLng: null,
  clockOutLat: null,
  clockOutLng: null,
  status: "present",
  overtimeMinutes: 0,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DTR timeclock tenant-parity", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // Default: authenticated caller resolves to a "Platform Owner" DB role,
    // which bypasses the RBAC matrix entirely (tenant-rbac-standard.md §4).
    mockRoleFindFirst.mockResolvedValue({
      id: "role-1",
      tenantId: "tenant-A",
      name: "Platform Owner",
    });
    // Re-wire $transaction after reset so it always passes mockDb to the callback.
    const { prisma } = await import("@orqafy/db");
    (prisma as any).$transaction.mockImplementation((fn: any) => {
      const mockDb = {
        employee: { findUnique: mockEmployeeFindUnique },
        attendanceRecord: {
          findFirst: mockAttendanceFindFirst,
          findUnique: mockAttendanceFindUnique,
          create: mockAttendanceCreate,
          update: mockAttendanceUpdate,
        },
        auditLog: { create: mockAuditLogCreate },
      };
      return fn(mockDb);
    });
  });

  // ── 1. Clock-in injects tenantId from ctx + writes audit log ───────────────
  describe("attendanceClockIn", () => {
    it("creates record with tenantId from ctx and writes an audit log entry", async () => {
      mockEmployeeFindUnique.mockResolvedValueOnce(EMP_A);
      mockAttendanceFindFirst.mockResolvedValueOnce(null); // no duplicate today
      mockAttendanceCreate.mockResolvedValueOnce(ATT_A);

      const caller = createCaller(ctxForTenant("tenant-A"));
      await caller.dtr.attendanceClockIn({
        employeeId: EMP_A.id,
        lat: 14.5995,
        lng: 120.9842,
      });

      // tenantId in create data must come from ctx, not input
      expect(mockAttendanceCreate).toHaveBeenCalledOnce();
      const createData = (mockAttendanceCreate.mock.calls[0] as any)[0].data;
      expect(createData.tenantId).toBe("tenant-A");

      // audit log must be written inside the transaction
      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditEntry = (mockAuditLogCreate.mock.calls[0] as any)[0].data;
      expect(auditEntry.action).toBe("CREATE");
      expect(auditEntry.entity).toBe("AttendanceRecord");
    });

    // ── 2. Double-clock-in guard ──────────────────────────────────────────────
    it("throws CONFLICT when employee has already clocked in today", async () => {
      mockEmployeeFindUnique.mockResolvedValueOnce(EMP_A);
      // existing record found — triggers the duplicate guard
      mockAttendanceFindFirst.mockResolvedValueOnce(ATT_A);

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.dtr.attendanceClockIn({
          employeeId: EMP_A.id,
          lat: 0,
          lng: 0,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      // Must not proceed to create
      expect(mockAttendanceCreate).not.toHaveBeenCalled();
    });

    // ── 3. Tenant-scope isolation (clock-in) ──────────────────────────────────
    it("throws NOT_FOUND when employeeId belongs to a different tenant", async () => {
      // employee exists but its tenantId is tenant-B — ctx is tenant-A
      mockEmployeeFindUnique.mockResolvedValueOnce({
        ...EMP_A,
        tenantId: "tenant-B",
      });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.dtr.attendanceClockIn({
          employeeId: EMP_A.id,
          lat: 0,
          lng: 0,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    // ── 6. Demo guard ─────────────────────────────────────────────────────────
    it("throws FORBIDDEN on demo tenant", async () => {
      const caller = createCaller(
        ctxForTenant("tenant-A", { isDemoTenant: true }),
      );
      await expect(
        caller.dtr.attendanceClockIn({
          employeeId: EMP_A.id,
          lat: 0,
          lng: 0,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  // ── 4 & 5. Clock-out ────────────────────────────────────────────────────────
  describe("attendanceClockOut", () => {
    it("records clock-out time and writes audit log", async () => {
      mockAttendanceFindUnique.mockResolvedValueOnce(ATT_A);
      mockAttendanceUpdate.mockResolvedValueOnce({
        ...ATT_A,
        clockOut: new Date(),
      });

      const caller = createCaller(ctxForTenant("tenant-A"));
      const result = await caller.dtr.attendanceClockOut({
        attendanceId: ATT_A.id,
        lat: 14.5995,
        lng: 120.9842,
      });

      expect(result.clockOut).not.toBeNull();
      expect(mockAuditLogCreate).toHaveBeenCalledOnce();
      const auditEntry = (mockAuditLogCreate.mock.calls[0] as any)[0].data;
      expect(auditEntry.action).toBe("UPDATE");
      expect(auditEntry.entity).toBe("AttendanceRecord");
    });

    it("throws NOT_FOUND when attendance record belongs to a different tenant", async () => {
      // record exists but tenantId is tenant-B — ctx is tenant-A
      mockAttendanceFindUnique.mockResolvedValueOnce({
        ...ATT_A,
        tenantId: "tenant-B",
      });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.dtr.attendanceClockOut({
          attendanceId: ATT_A.id,
          lat: 0,
          lng: 0,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws BAD_REQUEST when the record is already clocked out", async () => {
      mockAttendanceFindUnique.mockResolvedValueOnce({
        ...ATT_A,
        clockOut: new Date("2026-06-15T17:00:00Z"), // already closed
      });

      const caller = createCaller(ctxForTenant("tenant-A"));
      await expect(
        caller.dtr.attendanceClockOut({
          attendanceId: ATT_A.id,
          lat: 0,
          lng: 0,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  // ── 7. RBAC — attendanceApprove gated to approver roles ───────────────────
  describe("attendanceApprove (RBAC)", () => {
    it("throws FORBIDDEN when caller has Employee role (non-approver)", async () => {
      const caller = createCaller(
        ctxForTenant("tenant-A", { roles: ["Employee"] }),
      );
      await expect(
        caller.dtr.attendanceApprove({ attendanceId: ATT_A.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("allows HR Manager to approve attendance", async () => {
      mockAttendanceFindUnique.mockResolvedValueOnce(ATT_A); // present → approvable
      mockAttendanceUpdate.mockResolvedValueOnce({
        ...ATT_A,
        status: "approved",
      });

      const caller = createCaller(
        ctxForTenant("tenant-A", { roles: ["HR Manager"] }),
      );
      const result = await caller.dtr.attendanceApprove({
        attendanceId: ATT_A.id,
      });
      expect(result.status).toBe("approved");
    });
  });
});
