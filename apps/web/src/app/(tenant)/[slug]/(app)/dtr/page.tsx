import type { Metadata } from "next";
import { prisma } from "@orqafy/db";
import { auth } from "@/server/auth";
import { LeaveRequestForm } from "./leave-request-form";
import { LeaveRequestActions } from "./leave-request-actions";
import { AttendanceActions } from "./attendance-actions";
import { ClockActions } from "./clock-actions";

export const metadata: Metadata = { title: "DTR" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  present: "border-primary/30 bg-primary/10 text-primary",
  approved: "border-primary/30 bg-primary/10 text-primary",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
  absent: "border-red-500/30 bg-red-500/10 text-red-400",
  late: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

function statusBadge(status: string): string {
  return STATUS_BADGE[status] ?? "border-border bg-muted text-muted-foreground";
}

/**
 * Fetch the Employee row for the currently logged-in user, if one exists.
 * Returns null for admin-only accounts that have no employee record.
 */
async function getMyEmployee(userId: string | null) {
  if (userId === null) return null;
  return prisma.employee.findFirst({
    where: { userId },
    select: { id: true },
  });
}

/**
 * Fetch today's AttendanceRecord for the given employee, if any.
 * Returns null when no clock-in has occurred today.
 */
async function getMyTodayRecord(employeeId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return prisma.attendanceRecord.findFirst({
    where: { employeeId, date: today },
    select: { id: true, clockIn: true, clockOut: true, status: true },
  });
}

async function getRecentAttendance() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  return prisma.attendanceRecord.findMany({
    where: { date: { gte: since } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 30,
    select: {
      id: true,
      date: true,
      status: true,
      clockIn: true,
      clockOut: true,
      overtimeMinutes: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          // userId required so the row can be matched against session.user.id
          userId: true,
          user: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        },
      },
    },
  });
}

async function getLeaveRequests() {
  return prisma.leaveRequest.findMany({
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 30,
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      totalDays: true,
      status: true,
      reason: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          userId: true,
          user: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        },
      },
    },
  });
}

export default async function DtrPage() {
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;

  // Employee lookup runs first so the result can feed getMyTodayRecord.
  const myEmployee = await getMyEmployee(currentUserId);
  const myTodayRecord =
    myEmployee !== null ? await getMyTodayRecord(myEmployee.id) : null;

  const [attendance, leaves] = await Promise.all([
    getRecentAttendance(),
    getLeaveRequests(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Daily Time Record</h1>
        <p className="text-sm text-muted-foreground">
          Recent attendance and leave requests across the organization.
        </p>
      </div>

      {/* ── My Attendance Today (self-service clock-in / clock-out) ──────── */}
      {myEmployee !== null && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            My Attendance Today
          </h2>
          <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4">
            {myTodayRecord !== null ? (
              <>
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium">
                    Clocked in at{" "}
                    {myTodayRecord.clockIn?.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }) ?? "—"}
                  </p>
                  {myTodayRecord.clockOut !== null ? (
                    <p className="text-xs text-muted-foreground">
                      Clocked out at{" "}
                      {myTodayRecord.clockOut.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Not yet clocked out
                    </p>
                  )}
                </div>
                <ClockActions
                  attendanceId={myTodayRecord.id}
                  employeeId={myEmployee.id}
                  hasClockedOut={myTodayRecord.clockOut !== null}
                />
              </>
            ) : (
              <>
                <p className="flex-1 text-sm text-muted-foreground">
                  You have not clocked in today.
                </p>
                <ClockActions
                  attendanceId={null}
                  employeeId={myEmployee.id}
                  hasClockedOut={false}
                />
              </>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Attendance · last 7 days
        </h2>
        <div className="rounded-lg border border-border bg-card">
          {attendance.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No attendance records in the last 7 days.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Clock In</th>
                  <th className="px-4 py-3 font-medium">Clock Out</th>
                  <th className="px-4 py-3 font-medium">OT (min)</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {a.employee.user.displayName ?? `${a.employee.user.firstName} ${a.employee.user.lastName}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.employee.employeeNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.date.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.clockIn !== null
                        ? a.clockIn.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.clockOut !== null
                        ? a.clockOut.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.overtimeMinutes > 0 ? a.overtimeMinutes : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge(
                          a.status,
                        )}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <AttendanceActions attendanceId={a.id} status={a.status} />
                        {currentUserId !== null &&
                          a.employee.userId === currentUserId && (
                            <ClockActions
                              attendanceId={a.id}
                              employeeId={a.employee.id}
                              hasClockedOut={a.clockOut !== null}
                            />
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Leave Requests</h2>
          <LeaveRequestForm />
        </div>
        <div className="rounded-lg border border-border bg-card">
          {leaves.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No leave requests yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {l.employee.user.displayName ?? `${l.employee.user.firstName} ${l.employee.user.lastName}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {l.employee.employeeNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {l.type}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.startDate.toLocaleDateString()} →{" "}
                      {l.endDate.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {Number(l.totalDays)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.reason !== null ? l.reason : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge(
                          l.status,
                        )}`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <LeaveRequestActions
                        leaveRequestId={l.id}
                        status={l.status}
                        isOwn={currentUserId !== null && l.employee.userId === currentUserId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
