import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

function userDisplayName(
  u: { displayName: string | null; firstName: string; lastName: string } | null,
): string {
  if (u === null) return "—";
  return u.displayName ?? `${u.firstName} ${u.lastName}`.trim();
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-Time",
  part_time: "Part-Time",
  contract: "Contract",
  probationary: "Probationary",
};

const TYPE_BADGE: Record<string, string> = {
  full_time: "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992]",
  part_time: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  contract: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  probationary: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "terminated", label: "Terminated" },
];

async function getEmployees(filter: string) {
  const where =
    filter === "active"
      ? { dateTerminated: null }
      : filter === "terminated"
        ? { dateTerminated: { not: null } }
        : undefined;
  return prisma.employee.findMany({
    ...(where !== undefined ? { where } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      employeeNumber: true,
      position: true,
      employmentType: true,
      dateHired: true,
      dateTerminated: true,
      user: {
        select: { firstName: true, lastName: true, displayName: true, email: true },
      },
      department: { select: { name: true } },
    },
  });
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter ?? "all";
  const employees = await getEmployees(filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
        <p className="text-sm text-muted-foreground">
          {employees.length} employee{employees.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?filter=${tab.key}`}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              filter === tab.key
                ? "bg-[#00d992]/10 text-[#00d992]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        {employees.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No employees found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Employee #</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Hired</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`employees/${e.id}`}
                      className="font-mono text-xs font-medium text-[#00d992] hover:underline"
                    >
                      {e.employeeNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{userDisplayName(e.user)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.department?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        TYPE_BADGE[e.employmentType] ?? TYPE_BADGE["full_time"]
                      }`}
                    >
                      {EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.dateHired.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {e.dateTerminated !== null ? (
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                        Terminated
                      </span>
                    ) : (
                      <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992]">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
