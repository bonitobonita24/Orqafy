import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, writeProcedure } from "../trpc";
import { prisma as db } from "@orqafy/db";

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
    .query(async ({ input }) => {
      const where: Record<string, unknown> = { employeeId: input.employeeId };
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
    .query(async ({ input }) => {
      const record = await db.attendanceRecord.findFirst({ where: { id: input.id } });
      if (!record) throw new TRPCError({ code: "NOT_FOUND" });
      return record;
    }),

  attendanceClockIn: writeProcedure
    .input(z.object({
      employeeId: z.string().min(1),
      lat: z.number(),
      lng: z.number(),
    }))
    .mutation(async ({ input }) => {
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
      return db.attendanceRecord.create({
        data: {
          employeeId: input.employeeId,
          date: today,
          clockIn: new Date(),
          clockInLat: input.lat,
          clockInLng: input.lng,
          status: "present",
        },
      });
    }),

  attendanceClockOut: writeProcedure
    .input(z.object({
      attendanceId: z.string().min(1),
      lat: z.number(),
      lng: z.number(),
    }))
    .mutation(async ({ input }) => {
      const existing = await db.attendanceRecord.findFirst({
        where: { id: input.attendanceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.attendanceRecord.update({
        where: { id: input.attendanceId },
        data: {
          clockOut: new Date(),
          clockOutLat: input.lat,
          clockOutLng: input.lng,
        },
      });
    }),

  attendanceApprove: writeProcedure
    .input(z.object({ attendanceId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      requireApproverRole(ctx.roles);
      const existing = await db.attendanceRecord.findFirst({
        where: { id: input.attendanceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.attendanceRecord.update({
        where: { id: input.attendanceId },
        data: { status: "approved" },
      });
    }),

  attendanceReject: writeProcedure
    .input(z.object({
      attendanceId: z.string().min(1),
      reason: z.string().min(1).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireApproverRole(ctx.roles);
      const existing = await db.attendanceRecord.findFirst({
        where: { id: input.attendanceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      // AttendanceRecord schema has no rejectionReason field — store the supplied
      // reason in the existing `notes` field so it's not silently discarded.
      return db.attendanceRecord.update({
        where: { id: input.attendanceId },
        data: {
          status: "rejected",
          ...(input.reason !== undefined && { notes: input.reason }),
        },
      });
    }),

  // ─── Leave requests ──────────────────────────────────────────────────────
  leaveRequestList: protectedProcedure
    .input(z.object({
      employeeId: z.string().min(1),
      type: LEAVE_TYPE.optional(),
      status: z.string().min(1).optional(),
    }))
    .query(async ({ input }) => {
      const where: Record<string, unknown> = { employeeId: input.employeeId };
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
    .mutation(async ({ input }) => {
      const employee = await db.employee.findFirst({ where: { id: input.employeeId } });
      if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found." });
      return db.leaveRequest.create({
        data: {
          employeeId: input.employeeId,
          type: input.type,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          totalDays: inclusiveDayCount(input.startDate, input.endDate),
          status: "pending",
          ...(input.reason !== undefined && { reason: input.reason }),
        },
      });
    }),

  leaveRequestApprove: writeProcedure
    .input(z.object({ leaveRequestId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      requireApproverRole(ctx.roles);
      const existing = await db.leaveRequest.findFirst({
        where: { id: input.leaveRequestId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return db.leaveRequest.update({
        where: { id: input.leaveRequestId },
        data: { status: "approved", approvedAt: new Date() },
      });
    }),

  leaveRequestReject: writeProcedure
    .input(z.object({
      leaveRequestId: z.string().min(1),
      reason: z.string().min(1).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      requireApproverRole(ctx.roles);
      const existing = await db.leaveRequest.findFirst({
        where: { id: input.leaveRequestId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if ((existing as { status: string }).status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending leave requests can be rejected.",
        });
      }
      return db.leaveRequest.update({
        where: { id: input.leaveRequestId },
        data: { status: "rejected" },
      });
    }),
});
