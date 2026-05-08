import type { Metadata } from "next";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "DTR" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  present: "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992]",
  approved: "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992]",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
  absent: "border-red-500/30 bg-red-500/10 text-red-400",
  late: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

function statusBadge(status: string): string {
  return STATUS_BADGE[status] ?? "border-border bg-muted text-muted-foreground";
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
          user: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        },
      },
    },
  });
}

export default async function DtrPage() {
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Leave Requests</h2>
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
