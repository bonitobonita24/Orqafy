/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { dtrRouter } from "@/server/trpc/routers/dtr";
import { createTRPCRouter, createCallerFactory } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";

vi.mock("@orqafy/db", () => {
  const mockPrisma = {
    attendanceRecord: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leaveRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    employee: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  return {
    prisma: {
      ...mockPrisma,
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
    },
    writeAuditLog: async (
      tx: { auditLog: { create: (args: unknown) => unknown } },
      entry: unknown,
    ) => { await tx.auditLog.create({ data: entry }); },
  };
});

import type { NextRequest } from "next/server";
function makeReq(): NextRequest {
  return {} as NextRequest;
}
function authenticatedCtx(role = "Administrator") {
  return {
    req: makeReq(),
    userId: "user-1",
    roles: [role] as string[],
    tenantSlug: "acme",
    tenantId: "acme-tenant-id",
    securityVersion: 1,
    isDemoTenant: false,
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

const testRouter = createTRPCRouter({ dtr: dtrRouter });
const createCaller = createCallerFactory(testRouter);

import { prisma as db } from "@orqafy/db";
const mockDb = db as unknown as {
  attendanceRecord: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  leaveRequest: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  employee: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

const fakeAttendance = {
  id: "att-1",
  tenantId: "acme-tenant-id",
  employeeId: "emp-1",
  date: new Date("2025-01-15"),
  clockIn: new Date("2025-01-15T08:00:00Z"),
  clockOut: null,
  clockInLat: null,
  clockInLng: null,
  clockOutLat: null,
  clockOutLng: null,
  status: "present",
  overtimeMinutes: 0,
  undertimeMinutes: 0,
  isOfflineSynced: false,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeLeave = {
  id: "leave-1",
  tenantId: "acme-tenant-id",
  employeeId: "emp-1",
  type: "sick",
  startDate: new Date("2025-01-20"),
  endDate: new Date("2025-01-21"),
  totalDays: 2,
  reason: "Flu",
  status: "pending",
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeEmployee = {
  id: "emp-1",
  userId: "user-1",
  tenantId: "acme-tenant-id",
};

describe("dtrRouter", () => {
  describe("dtr.attendanceList", () => {
    it("returns attendance records for an employee", async () => {
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee);
      mockDb.attendanceRecord.findMany.mockResolvedValue([fakeAttendance]);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.dtr.attendanceList({ employeeId: "emp-1" });
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("att-1");
    });

    it("rejects unauthenticated caller", async () => {
      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.dtr.attendanceList({ employeeId: "emp-1" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("dtr.attendanceClockIn", () => {
    it("creates a clock-in record with GPS coordinates", async () => {
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee);
      mockDb.attendanceRecord.findFirst.mockResolvedValue(null); // no duplicate
      mockDb.attendanceRecord.create.mockResolvedValue({
        ...fakeAttendance,
        clockInLat: 14.5995,
        clockInLng: 120.9842,
      });
      const caller = createCaller(authenticatedCtx());
      const result = await caller.dtr.attendanceClockIn({
        employeeId: "emp-1",
        lat: 14.5995,
        lng: 120.9842,
      });
      expect(result.id).toBe("att-1");
      expect(mockDb.attendanceRecord.create).toHaveBeenCalledOnce();
    });

    it("throws CONFLICT if employee already clocked in today", async () => {
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee);
      mockDb.attendanceRecord.findFirst.mockResolvedValue(fakeAttendance);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.dtr.attendanceClockIn({
          employeeId: "emp-1",
          lat: 14.5995,
          lng: 120.9842,
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("rejects unauthenticated caller", async () => {
      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.dtr.attendanceClockIn({
          employeeId: "emp-1",
          lat: 14.5995,
          lng: 120.9842,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("writes an audit log row with action CREATE and entity AttendanceRecord", async () => {
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee);
      mockDb.attendanceRecord.findFirst.mockResolvedValue(null);
      mockDb.attendanceRecord.create.mockResolvedValue({ ...fakeAttendance, id: "att-audit" });
      const caller = createCaller(authenticatedCtx());
      await caller.dtr.attendanceClockIn({
        employeeId: "emp-1",
        lat: 14.5995,
        lng: 120.9842,
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CREATE", entity: "AttendanceRecord" }),
        }),
      );
    });
  });

  describe("dtr.attendanceById", () => {
    it("returns an attendance record by id", async () => {
      mockDb.attendanceRecord.findUnique.mockResolvedValue(fakeAttendance);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.dtr.attendanceById({ id: "att-1" });
      expect(result.id).toBe("att-1");
    });

    it("throws NOT_FOUND when attendance record does not exist", async () => {
      mockDb.attendanceRecord.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.dtr.attendanceById({ id: "missing" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("rejects unauthenticated caller", async () => {
      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.dtr.attendanceById({ id: "att-1" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("dtr.attendanceApprove", () => {
    it("approves a present attendance record when called by HR/Manager", async () => {
      mockDb.attendanceRecord.findUnique.mockResolvedValue(fakeAttendance);
      mockDb.attendanceRecord.update.mockResolvedValue({
        ...fakeAttendance,
        status: "approved",
      });
      const caller = createCaller(authenticatedCtx("HR Manager"));
      const result = await caller.dtr.attendanceApprove({ attendanceId: "att-1" });
      expect(result.status).toBe("approved");
    });

    it("throws FORBIDDEN when called by a non-approver role", async () => {
      const caller = createCaller(authenticatedCtx("Employee"));
      await expect(
        caller.dtr.attendanceApprove({ attendanceId: "att-1" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws NOT_FOUND if attendance record does not exist", async () => {
      mockDb.attendanceRecord.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx("HR Manager"));
      await expect(
        caller.dtr.attendanceApprove({ attendanceId: "att-999" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("dtr.attendanceReject", () => {
    it("rejects an attendance record when called by HR/Manager", async () => {
      mockDb.attendanceRecord.findUnique.mockResolvedValue(fakeAttendance);
      mockDb.attendanceRecord.update.mockResolvedValue({
        ...fakeAttendance,
        status: "rejected",
      });
      const caller = createCaller(authenticatedCtx("HR Manager"));
      const result = await caller.dtr.attendanceReject({
        attendanceId: "att-1",
        reason: "Outside geofence",
      });
      expect(result.status).toBe("rejected");
    });

    it("throws FORBIDDEN when called by a non-approver role", async () => {
      const caller = createCaller(authenticatedCtx("Employee"));
      await expect(
        caller.dtr.attendanceReject({ attendanceId: "att-1" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("dtr.attendanceClockOut", () => {
    it("updates an existing attendance record with clock-out time", async () => {
      mockDb.attendanceRecord.findUnique.mockResolvedValue(fakeAttendance);
      mockDb.attendanceRecord.update.mockResolvedValue({
        ...fakeAttendance,
        clockOut: new Date("2025-01-15T17:00:00Z"),
        clockOutLat: 14.5995,
        clockOutLng: 120.9842,
      });
      const caller = createCaller(authenticatedCtx());
      const result = await caller.dtr.attendanceClockOut({
        attendanceId: "att-1",
        lat: 14.5995,
        lng: 120.9842,
      });
      expect(result.clockOut).toBeTruthy();
      expect(mockDb.attendanceRecord.update).toHaveBeenCalledOnce();
    });

    it("throws NOT_FOUND if attendance record does not exist", async () => {
      mockDb.attendanceRecord.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.dtr.attendanceClockOut({
          attendanceId: "att-999",
          lat: 14.5995,
          lng: 120.9842,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("dtr.leaveRequestCreate", () => {
    it("creates a leave request", async () => {
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee);
      mockDb.leaveRequest.create.mockResolvedValue(fakeLeave);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.dtr.leaveRequestCreate({
        employeeId: "emp-1",
        type: "sick",
        startDate: "2025-01-20",
        endDate: "2025-01-21",
        reason: "Flu",
      });
      expect(result.id).toBe("leave-1");
      expect(result.status).toBe("pending");
    });

    it("throws NOT_FOUND if employee does not exist", async () => {
      mockDb.employee.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.dtr.leaveRequestCreate({
          employeeId: "emp-999",
          type: "vacation",
          startDate: "2025-02-01",
          endDate: "2025-02-05",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("rejects unauthenticated caller", async () => {
      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.dtr.leaveRequestCreate({
          employeeId: "emp-1",
          type: "sick",
          startDate: "2025-01-20",
          endDate: "2025-01-21",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("dtr.leaveRequestList", () => {
    it("returns leave requests for an employee", async () => {
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee);
      mockDb.leaveRequest.findMany.mockResolvedValue([fakeLeave]);
      const caller = createCaller(authenticatedCtx());
      const result = await caller.dtr.leaveRequestList({ employeeId: "emp-1" });
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("sick");
    });
  });

  describe("dtr.leaveRequestApprove", () => {
    it("approves a pending leave request when called by HR/Manager", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue(fakeLeave);
      mockDb.leaveRequest.update.mockResolvedValue({
        ...fakeLeave,
        status: "approved",
        approvedAt: new Date(),
      });
      const caller = createCaller(authenticatedCtx("HR Manager"));
      const result = await caller.dtr.leaveRequestApprove({
        leaveRequestId: "leave-1",
      });
      expect(result.status).toBe("approved");
    });

    it("throws FORBIDDEN when called by a non-approver role", async () => {
      const caller = createCaller(authenticatedCtx("Employee"));
      await expect(
        caller.dtr.leaveRequestApprove({ leaveRequestId: "leave-1" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws NOT_FOUND if leave request does not exist", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue(null);
      const caller = createCaller(authenticatedCtx("HR Manager"));
      await expect(
        caller.dtr.leaveRequestApprove({ leaveRequestId: "leave-999" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("dtr.leaveRequestReject", () => {
    it("rejects a pending leave request when called by HR/Manager", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue(fakeLeave);
      mockDb.leaveRequest.update.mockResolvedValue({
        ...fakeLeave,
        status: "rejected",
      });
      const caller = createCaller(authenticatedCtx("HR Manager"));
      const result = await caller.dtr.leaveRequestReject({
        leaveRequestId: "leave-1",
        reason: "Insufficient leave balance",
      });
      expect(result.status).toBe("rejected");
    });

    it("throws FORBIDDEN when called by a non-approver role", async () => {
      const caller = createCaller(authenticatedCtx("Employee"));
      await expect(
        caller.dtr.leaveRequestReject({ leaveRequestId: "leave-1" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws BAD_REQUEST if leave request is not in pending status", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue({
        ...fakeLeave,
        status: "approved",
      });
      const caller = createCaller(authenticatedCtx("HR Manager"));
      await expect(
        caller.dtr.leaveRequestReject({ leaveRequestId: "leave-1" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("dtr.leaveRequestCancel", () => {
    it("cancels a pending request when called by the requesting employee", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue(fakeLeave);
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee); // userId === "user-1"
      mockDb.leaveRequest.update.mockResolvedValue({ ...fakeLeave, status: "cancelled" });
      const caller = createCaller(authenticatedCtx());
      const result = await caller.dtr.leaveRequestCancel({ leaveRequestId: "leave-1" });
      expect(result.status).toBe("cancelled");
      expect(mockDb.leaveRequest.update).toHaveBeenCalledOnce();
    });

    it("writes an audit log row with action UPDATE and entity LeaveRequest", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue(fakeLeave);
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee);
      mockDb.leaveRequest.update.mockResolvedValue({ ...fakeLeave, status: "cancelled" });
      const caller = createCaller(authenticatedCtx());
      await caller.dtr.leaveRequestCancel({ leaveRequestId: "leave-1" });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "UPDATE",
            entity: "LeaveRequest",
            after: expect.objectContaining({ status: "cancelled" }),
          }),
        }),
      );
    });

    it("throws FORBIDDEN when cancelling someone else's request", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue(fakeLeave);
      mockDb.employee.findUnique.mockResolvedValue({ ...fakeEmployee, userId: "user-2" });
      const caller = createCaller(authenticatedCtx()); // userId === "user-1"
      await expect(
        caller.dtr.leaveRequestCancel({ leaveRequestId: "leave-1" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mockDb.leaveRequest.update).not.toHaveBeenCalled();
    });

    it("throws BAD_REQUEST when the request is not pending (already approved)", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue({ ...fakeLeave, status: "approved" });
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.dtr.leaveRequestCancel({ leaveRequestId: "leave-1" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mockDb.leaveRequest.update).not.toHaveBeenCalled();
    });

    it("throws BAD_REQUEST when cancelling an already-cancelled request", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue({ ...fakeLeave, status: "cancelled" });
      mockDb.employee.findUnique.mockResolvedValue(fakeEmployee);
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.dtr.leaveRequestCancel({ leaveRequestId: "leave-1" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("throws NOT_FOUND for a cross-tenant request", async () => {
      mockDb.leaveRequest.findUnique.mockResolvedValue({ ...fakeLeave, tenantId: "other-tenant" });
      const caller = createCaller(authenticatedCtx());
      await expect(
        caller.dtr.leaveRequestCancel({ leaveRequestId: "leave-1" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(mockDb.leaveRequest.update).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated caller", async () => {
      const caller = createCaller(unauthenticatedCtx());
      await expect(
        caller.dtr.leaveRequestCancel({ leaveRequestId: "leave-1" })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ─── Epic-2 state-machine guards (Phase 7) ─────────────────────────────────
  // Each lifecycle procedure must reject illegal transitions server-side, not
  // just the happy path. These tests pin every rejected edge.
  describe("Epic-2 state-machine guards", () => {
    // Owner decision (Phase 7): approvers may FLIP a prior decision to handle
    // re-review edges. Only re-applying the SAME decision is rejected as a no-op.
    describe("dtr.attendanceApprove — re-review flips", () => {
      it("flips a rejected record to approved (rejected → approved)", async () => {
        mockDb.attendanceRecord.findUnique.mockResolvedValue({ ...fakeAttendance, status: "rejected" });
        mockDb.attendanceRecord.update.mockResolvedValue({ ...fakeAttendance, status: "approved" });
        const caller = createCaller(authenticatedCtx("HR Manager"));
        const result = await caller.dtr.attendanceApprove({ attendanceId: "att-1" });
        expect(result.status).toBe("approved");
        expect(mockDb.attendanceRecord.update).toHaveBeenCalledOnce();
      });

      it("rejects re-approving an already-approved record (approved → approved no-op)", async () => {
        mockDb.attendanceRecord.findUnique.mockResolvedValue({ ...fakeAttendance, status: "approved" });
        const caller = createCaller(authenticatedCtx("HR Manager"));
        await expect(
          caller.dtr.attendanceApprove({ attendanceId: "att-1" })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(mockDb.attendanceRecord.update).not.toHaveBeenCalled();
      });

      it("still approves a present record (present → approved)", async () => {
        mockDb.attendanceRecord.findUnique.mockResolvedValue(fakeAttendance);
        mockDb.attendanceRecord.update.mockResolvedValue({ ...fakeAttendance, status: "approved" });
        const caller = createCaller(authenticatedCtx("HR Manager"));
        const result = await caller.dtr.attendanceApprove({ attendanceId: "att-1" });
        expect(result.status).toBe("approved");
      });

      it("requires approver role to flip", async () => {
        const caller = createCaller(authenticatedCtx("Employee"));
        await expect(
          caller.dtr.attendanceApprove({ attendanceId: "att-1" })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      });
    });

    describe("dtr.attendanceReject — re-review flips", () => {
      it("flips an approved record to rejected (approved → rejected)", async () => {
        mockDb.attendanceRecord.findUnique.mockResolvedValue({ ...fakeAttendance, status: "approved" });
        mockDb.attendanceRecord.update.mockResolvedValue({ ...fakeAttendance, status: "rejected" });
        const caller = createCaller(authenticatedCtx("HR Manager"));
        const result = await caller.dtr.attendanceReject({ attendanceId: "att-1" });
        expect(result.status).toBe("rejected");
        expect(mockDb.attendanceRecord.update).toHaveBeenCalledOnce();
      });

      it("rejects re-rejecting an already-rejected record (rejected → rejected no-op)", async () => {
        mockDb.attendanceRecord.findUnique.mockResolvedValue({ ...fakeAttendance, status: "rejected" });
        const caller = createCaller(authenticatedCtx("HR Manager"));
        await expect(
          caller.dtr.attendanceReject({ attendanceId: "att-1" })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(mockDb.attendanceRecord.update).not.toHaveBeenCalled();
      });
    });

    describe("dtr.attendanceClockOut — illegal transitions", () => {
      it("rejects clocking out a session that is already closed", async () => {
        mockDb.attendanceRecord.findUnique.mockResolvedValue({
          ...fakeAttendance,
          clockOut: new Date("2025-01-15T17:00:00Z"),
        });
        const caller = createCaller(authenticatedCtx());
        await expect(
          caller.dtr.attendanceClockOut({ attendanceId: "att-1", lat: 14.6, lng: 120.9 })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(mockDb.attendanceRecord.update).not.toHaveBeenCalled();
      });
    });

    describe("dtr.leaveRequestApprove — illegal transitions", () => {
      it("rejects approving an already-approved request (approved → approved)", async () => {
        mockDb.leaveRequest.findUnique.mockResolvedValue({ ...fakeLeave, status: "approved" });
        const caller = createCaller(authenticatedCtx("HR Manager"));
        await expect(
          caller.dtr.leaveRequestApprove({ leaveRequestId: "leave-1" })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(mockDb.leaveRequest.update).not.toHaveBeenCalled();
      });

      it("rejects approving an already-rejected request (rejected → approved)", async () => {
        mockDb.leaveRequest.findUnique.mockResolvedValue({ ...fakeLeave, status: "rejected" });
        const caller = createCaller(authenticatedCtx("HR Manager"));
        await expect(
          caller.dtr.leaveRequestApprove({ leaveRequestId: "leave-1" })
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      });
    });
  });
});
