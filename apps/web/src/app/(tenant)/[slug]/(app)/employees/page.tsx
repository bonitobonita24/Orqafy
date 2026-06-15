import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  full_time: "border-primary/30 bg-primary/10 text-primary",
  part_time: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  contract: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  probationary: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "terminated", label: "Terminated" },
];

async function getTenantId(slug: string) {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
}

async function getEmployees(tenantId: string, filter: string) {
  const where =
    filter === "active"
      ? { tenantId, dateTerminated: null }
      : filter === "terminated"
        ? { tenantId, dateTerminated: { not: null } }
        : { tenantId };
  return prisma.employee.findMany({
    where,
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
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await routeParams;
  const params = await searchParams;
  const filter = params.filter ?? "all";
  const tenantId = await getTenantId(slug);
  if (tenantId === null) notFound();
  const employees = await getEmployees(tenantId, filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {employees.length} employee{employees.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={`/${slug}/employees/new`}
          className="rounded-md bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          + New Employee
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?filter=${tab.key}`}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              filter === tab.key
                ? "bg-primary/10 text-primary"
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
                      className="font-mono text-xs font-medium text-primary hover:underline"
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
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
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
