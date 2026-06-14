import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db, writeAuditLog } from "@orqafy/db";

async function loadEmployeeForTenant(id: string, ctx: { tenantId: string }) {
  const e = await db.employee.findUnique({ where: { id } });
  if (!e || e.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
  }
  return e;
}

async function loadAttendanceForTenant(id: string, ctx: { tenantId: string }) {
  const a = await db.attendanceRecord.findUnique({ where: { id } });
  if (!a || a.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Attendance record not found" });
  }
  return a;
}

async function loadLeaveRequestForTenant(id: string, ctx: { tenantId: string }) {
  const lr = await db.leaveRequest.findUnique({ where: { id } });
  if (!lr || lr.tenantId !== ctx.tenantId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Leave request not found" });
  }
  return lr;
}

const LEAVE_TYPE = z.enum(["vacation", "sick", "emergency", "maternity", "paternity", "unpaid"]);

// Roles permitted to approve/reject attendance + leave requests.
// Inline gate (vs. shared middleware) — keeps the role list visible at the
// call site and matches the small number of approver procedures here.
const APPROVER_ROLES = ["HR Manager", "Manager", "Administrator"] as const;

function requireApproverRole(roles: ReadonlyArray<string>): void {
  if (!roles.some((r) => (APPROVER_ROLES as ReadonlyArray<string>).includes(r))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only HR Manager, Manager, or Administrator can approve or reject.",
    });
  }
}

// Attendance review state machine. A record is created as "present" (open for
// review); an approver moves it to "approved" or "rejected". Approvers may also
// FLIP a prior decision (re-review): approved → rejected and rejected → approved.
// The only no-op is re-applying the SAME decision the record already carries —
// that is rejected as a BAD_REQUEST so the audit log isn't spammed with no-ops.
function requireReviewableAttendance(status: string, verb: "approved" | "rejected"): void {
  if (status === verb) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `This attendance record is already ${status}.`,
    });
  }
}

// Inclusive day count between two ISO dates (e.g. "2025-01-20" → "2025-01-21" = 2 days).
function inclusiveDayCount(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1);
}

// Local-day window (UTC midnight) used to detect duplicate clock-ins for "today".
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const dtrRouter = createTRPCRouter({
  // ─── Attendance ──────────────────────────────────────────────────────────
  attendanceList: protectedProcedure
    .input(z.object({
      employeeId: z.string().min(1),
      status: z.string().min(1).optional(),
      from: z.string().min(1).optional(),
      to: z.string().min(1).optional(),
    }))
    .query(async ({ input, ctx }) => {
      await loadEmployeeForTenant(input.employeeId, ctx);
      const where: Record<string, unknown> = { employeeId: input.employeeId, tenantId: ctx.tenantId };
      if (input.status !== undefined) where["status"] = input.status;
      if (input.from !== undefined || input.to !== undefined) {
        const range: Record<string, Date> = {};
        if (input.from !== undefined) range["gte"] = new Date(input.from);
        if (input.to !== undefined) range["lte"] = new Date(input.to);
        where["date"] = range;
      }
      return db.attendanceRecord.findMany({ where, orderBy: { date: "desc" } });
    }),

  attendanceById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const record = await loadAttendanceForTenant(input.id, ctx);
      return record;
    }),

  attendanceClockIn: writeProcedure
    .input(z.object({
      employeeId: z.string().min(1),
      lat: z.number(),
      lng: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await loadEmployeeForTenant(input.employeeId, ctx);
      const today = startOfTodayUtc();
      const existing = await db.attendanceRecord.findFirst({
        where: { employeeId: input.employeeId, date: today },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Employee has already clocked in today.",
        });
      }
      return db.$transaction(async (tx) => {
        const created = await tx.attendanceRecord.create({
          data: {
            tenantId: ctx.tenantId,
            employeeId: input.employeeId,
            date: today,
            clockIn: new Date(),
            clockInLat: input.lat,
            clockInLng: input.lng,
            status: "present",
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "AttendanceRecord",
          entityId: created.id,
          before: null,
          after: {
            employeeId: created.employeeId,
            date: created.date.toISOString(),
            clockIn: created.clockIn?.toISOString() ?? null,
            status: created.status,
          },
        });
        return created;
      });
    }),

  attendanceClockOut: writeProcedure
    .input(z.object({
      attendanceId: z.string().min(1),
      lat: z.number(),
      lng: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const before = await loadAttendanceForTenant(input.attendanceId, ctx);
      if (before.clockOut != null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This attendance session has already been clocked out.",
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.attendanceRecord.update({
          where: { id: input.attendanceId },
          data: {
            clockOut: new Date(),
            clockOutLat: input.lat,
            clockOutLng: input.lng,
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "AttendanceRecord",
          entityId: updated.id,
          before: {
            employeeId: before.employeeId,
            clockOut: before.clockOut?.toISOString() ?? null,
            status: before.status,
          },
          after: {
            employeeId: updated.employeeId,
            clockOut: updated.clockOut?.toISOString() ?? null,
            status: updated.status,
          },
        });
        return updated;
      });
    }),

  attendanceApprove: writeProcedure
    .input(z.object({ attendanceId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      requireApproverRole(ctx.roles);
      const before = await loadAttendanceForTenant(input.attendanceId, ctx);
      requireReviewableAttendance(before.status, "approved");
      return db.$transaction(async (tx) => {
        const updated = await tx.attendanceRecord.update({
          where: { id: input.attendanceId },
          data: { status: "approved" },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "AttendanceRecord",
          entityId: updated.id,
          before: { status: before.status },
          after: { status: updated.status },
        });
        return updated;
      });
    }),

  attendanceReject: writeProcedure
    .input(z.object({
      attendanceId: z.string().min(1),
      reason: z.string().min(1).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireApproverRole(ctx.roles);
      const before = await loadAttendanceForTenant(input.attendanceId, ctx);
      requireReviewableAttendance(before.status, "rejected");
      // AttendanceRecord schema has no rejectionReason field — store the supplied
      // reason in the existing `notes` field so it's not silently discarded.
      return db.$transaction(async (tx) => {
        const updated = await tx.attendanceRecord.update({
          where: { id: input.attendanceId },
          data: {
            status: "rejected",
            ...(input.reason !== undefined && { notes: input.reason }),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "AttendanceRecord",
          entityId: updated.id,
          before: { status: before.status, notes: before.notes ?? null },
          after: { status: updated.status, notes: updated.notes ?? null },
        });
        return updated;
      });
    }),

  // ─── Leave requests ──────────────────────────────────────────────────────
  leaveRequestList: protectedProcedure
    .input(z.object({
      employeeId: z.string().min(1),
      type: LEAVE_TYPE.optional(),
      status: z.string().min(1).optional(),
    }))
    .query(async ({ input, ctx }) => {
      await loadEmployeeForTenant(input.employeeId, ctx);
      const where: Record<string, unknown> = { employeeId: input.employeeId, tenantId: ctx.tenantId };
      if (input.type !== undefined) where["type"] = input.type;
      if (input.status !== undefined) where["status"] = input.status;
      return db.leaveRequest.findMany({ where, orderBy: { startDate: "desc" } });
    }),

  leaveRequestCreate: writeProcedure
    .input(z.object({
      employeeId: z.string().min(1),
      type: LEAVE_TYPE,
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      reason: z.string().min(1).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await loadEmployeeForTenant(input.employeeId, ctx);
      return db.$transaction(async (tx) => {
        const created = await tx.leaveRequest.create({
          data: {
            tenantId: ctx.tenantId,
            employeeId: input.employeeId,
            type: input.type,
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
            totalDays: inclusiveDayCount(input.startDate, input.endDate),
            status: "pending",
            ...(input.reason !== undefined && { reason: input.reason }),
          },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entity: "LeaveRequest",
          entityId: created.id,
          before: null,
          after: {
            employeeId: created.employeeId,
            type: created.type,
            startDate: created.startDate.toISOString(),
            endDate: created.endDate.toISOString(),
            totalDays: created.totalDays,
            status: created.status,
          },
        });
        return created;
      });
    }),

  leaveRequestApprove: writeProcedure
    .input(z.object({ leaveRequestId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      requireApproverRole(ctx.roles);
      const before = await loadLeaveRequestForTenant(input.leaveRequestId, ctx);
      if ((before as { status: string }).status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending leave requests can be approved.",
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { id: input.leaveRequestId },
          data: { status: "approved", approvedAt: new Date() },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "LeaveRequest",
          entityId: updated.id,
          before: { status: (before as { status: string }).status, approvedAt: null },
          after: {
            status: updated.status,
            approvedAt: updated.approvedAt?.toISOString() ?? null,
          },
        });
        return updated;
      });
    }),

  leaveRequestReject: writeProcedure
    .input(z.object({
      leaveRequestId: z.string().min(1),
      reason: z.string().min(1).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireApproverRole(ctx.roles);
      const existing = await loadLeaveRequestForTenant(input.leaveRequestId, ctx);
      if ((existing as { status: string }).status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending leave requests can be rejected.",
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { id: input.leaveRequestId },
          data: { status: "rejected" },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "LeaveRequest",
          entityId: updated.id,
          before: { status: (existing as { status: string }).status },
          after: { status: updated.status },
        });
        return updated;
      });
    }),

  // Self-service cancel. Unlike approve/reject (approver-gated), only the
  // REQUESTING employee — the owner of the record — may cancel, and only while
  // the request is still "pending". The owner check loads the employee row and
  // compares its userId to the caller's; tenant scoping is enforced by
  // loadLeaveRequestForTenant + loadEmployeeForTenant.
  leaveRequestCancel: writeProcedure
    .input(z.object({ leaveRequestId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await loadLeaveRequestForTenant(input.leaveRequestId, ctx);
      const employee = await loadEmployeeForTenant(existing.employeeId, ctx);
      if (employee.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only cancel your own leave requests.",
        });
      }
      if ((existing as { status: string }).status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending leave requests can be cancelled.",
        });
      }
      return db.$transaction(async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { id: input.leaveRequestId },
          data: { status: "cancelled" },
        });
        await writeAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entity: "LeaveRequest",
          entityId: updated.id,
          before: { status: (existing as { status: string }).status },
          after: { status: updated.status },
        });
        return updated;
      });
    }),
});
