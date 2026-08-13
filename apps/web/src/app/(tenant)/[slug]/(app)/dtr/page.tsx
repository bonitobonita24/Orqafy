import type { Metadata } from "next";
import { CalendarClock, Clock3 } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { auth } from "@/server/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
async function getMyEmployee(userId: string | null, tenantId: string) {
  if (userId === null) return null;
  return prisma.employee.findFirst({
    where: { userId, tenantId },
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

async function getRecentAttendance(tenantId: string) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  return prisma.attendanceRecord.findMany({
    where: { tenantId, date: { gte: since } },
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

async function getLeaveRequests(tenantId: string) {
  return prisma.leaveRequest.findMany({
    where: { tenantId },
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
  const tenantId = session?.user?.tenantId ?? null;

  // No tenant on the session → nothing to show. Never fall through to an
  // unscoped query (that would expose every tenant's attendance + leave data).
  if (tenantId === null || tenantId.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title="Daily Time Record" />
        <p className="text-sm text-muted-foreground">
          No tenant context on this session.
        </p>
      </div>
    );
  }

  // Employee lookup runs first so the result can feed getMyTodayRecord.
  const myEmployee = await getMyEmployee(currentUserId, tenantId);
  const myTodayRecord =
    myEmployee !== null ? await getMyTodayRecord(myEmployee.id) : null;

  const [attendance, leaves] = await Promise.all([
    getRecentAttendance(tenantId),
    getLeaveRequests(tenantId),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Daily Time Record"
        description="Recent attendance and leave requests across the organization."
      />

      {/* ── My Attendance Today (self-service clock-in / clock-out) ──────── */}
      {myEmployee !== null && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            My Attendance Today
          </h2>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
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
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Attendance · last 7 days
        </h2>
        <Card>
          <CardContent className="p-0">
            {attendance.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={Clock3} title="No attendance records in the last 7 days." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>OT (min)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">
                          {a.employee.user.displayName ?? `${a.employee.user.firstName} ${a.employee.user.lastName}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.employee.employeeNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.date.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.clockIn !== null
                          ? a.clockIn.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.clockOut !== null
                          ? a.clockOut.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.overtimeMinutes > 0 ? a.overtimeMinutes : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${statusBadge(a.status)}`}
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Leave Requests</h2>
          <LeaveRequestForm />
        </div>
        <Card>
          <CardContent className="p-0">
            {leaves.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={CalendarClock} title="No leave requests yet." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">
                          {l.employee.user.displayName ?? `${l.employee.user.firstName} ${l.employee.user.lastName}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {l.employee.employeeNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">
                        {l.type}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.startDate.toLocaleDateString()} →{" "}
                        {l.endDate.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {Number(l.totalDays)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.reason !== null ? l.reason : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${statusBadge(l.status)}`}
                        >
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <LeaveRequestActions
                          leaveRequestId={l.id}
                          status={l.status}
                          isOwn={currentUserId !== null && l.employee.userId === currentUserId}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
