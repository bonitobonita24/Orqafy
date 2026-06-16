import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { EmployeeTerminate } from "./employee-terminate";
import { EmployeeAttachments } from "./employee-attachments";

export const metadata: Metadata = { title: "Employee Details" };
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

function formatMoney(value: unknown, currency = "PHP"): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getEmployee(id: string, tenantId: string) {
  return prisma.employee.findFirst({
    where: { id, tenantId },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          isActive: true,
        },
      },
      department: true,
    },
  });
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (tenant === null) notFound();
  const employee = await getEmployee(id, tenant.id);
  if (employee === null) notFound();

  const terminated = employee.dateTerminated !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href=".."
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to Employees
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {userDisplayName(employee.user)}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {employee.employeeNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {terminated ? (
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
              Terminated
            </span>
          ) : (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Active
            </span>
          )}
          <Link
            href={`/${slug}/employees/${id}/edit`}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            Edit
          </Link>
          {!terminated && <EmployeeTerminate employeeId={id} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Employment
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Type</dt>
              <dd>
                {EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? employee.employmentType}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Position</dt>
              <dd>{employee.position ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Department</dt>
              <dd>{employee.department?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Date Hired</dt>
              <dd>{employee.dateHired.toLocaleDateString()}</dd>
            </div>
            {terminated && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Date Terminated</dt>
                <dd className="text-red-400">
                  {employee.dateTerminated!.toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Compensation
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Base Salary</dt>
              <dd>{formatMoney(employee.baseSalary)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Daily Rate</dt>
              <dd>{formatMoney(employee.dailyRate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hourly Rate</dt>
              <dd>{formatMoney(employee.hourlyRate)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Government IDs
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">SSS</dt>
              <dd className="font-mono text-xs">{employee.sssNumber ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">PhilHealth</dt>
              <dd className="font-mono text-xs">{employee.philhealthNumber ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Pag-IBIG</dt>
              <dd className="font-mono text-xs">{employee.pagibigNumber ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">TIN</dt>
              <dd className="font-mono text-xs">{employee.tinNumber ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 md:col-span-2">
          <EmployeeAttachments employeeId={employee.id} />
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Contact & Banking
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{employee.user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Bank</dt>
              <dd>{employee.bankName ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Account #</dt>
              <dd className="font-mono text-xs">
                {employee.bankAccountNumber ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Emergency Contact</dt>
              <dd>{employee.emergencyContactName ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Emergency Phone</dt>
              <dd>{employee.emergencyContactPhone ?? "—"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
