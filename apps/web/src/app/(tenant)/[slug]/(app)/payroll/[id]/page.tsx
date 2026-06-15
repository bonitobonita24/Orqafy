import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Payroll Run" };
export const dynamic = "force-dynamic";

function userDisplayName(
  u: { displayName: string | null; firstName: string; lastName: string } | null,
): string {
  if (u === null) return "—";
  return u.displayName ?? `${u.firstName} ${u.lastName}`.trim();
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  processing: "Processing",
  approved: "Approved",
  paid: "Paid",
  void: "Void",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  processing: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  paid: "border-primary/30 bg-primary/10 text-primary",
  void: "border-red-500/30 bg-red-500/10 text-red-400",
};

function formatMoney(value: unknown, currency: string): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getPayroll(id: string) {
  return prisma.payroll.findUnique({
    where: { id },
    include: {
      payslips: {
        include: {
          employee: {
            include: {
              user: {
                select: { firstName: true, lastName: true, displayName: true },
              },
            },
          },
        },
      },
    },
  });
}

export default async function PayrollDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { id } = await params;
  const payroll = await getPayroll(id);
  if (payroll === null) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href=".."
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to Payroll
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Payroll Run
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {payroll.payrollNumber}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            STATUS_BADGE[payroll.status] ?? STATUS_BADGE["draft"]
          }`}
        >
          {STATUS_LABELS[payroll.status] ?? payroll.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Period Start
          </div>
          <div className="mt-1 text-sm">
            {payroll.periodStart.toLocaleDateString()}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Period End
          </div>
          <div className="mt-1 text-sm">
            {payroll.periodEnd.toLocaleDateString()}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Processed
          </div>
          <div className="mt-1 text-sm">
            {payroll.processedAt !== null ? payroll.processedAt.toLocaleString() : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Paid
          </div>
          <div className="mt-1 text-sm">
            {payroll.paidAt !== null ? payroll.paidAt.toLocaleString() : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total Gross
          </div>
          <div className="mt-2 font-mono text-lg font-semibold">
            {formatMoney(payroll.totalGross, payroll.currency)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total Deductions
          </div>
          <div className="mt-2 font-mono text-lg font-semibold text-red-400">
            {formatMoney(payroll.totalDeductions, payroll.currency)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Total Net
          </div>
          <div className="mt-2 font-mono text-lg font-semibold text-primary">
            {formatMoney(payroll.totalNet, payroll.currency)}
          </div>
        </div>
      </div>

      {payroll.notes !== null && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-sm">{payroll.notes}</p>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">
            Payslips
            <span className="ml-2 text-muted-foreground">
              ({payroll.payslips.length})
            </span>
          </h2>
        </div>
        {payroll.payslips.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No payslips generated yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium text-right">Basic Pay</th>
                <th className="px-4 py-3 font-medium text-right">Overtime</th>
                <th className="px-4 py-3 font-medium text-right">Allowances</th>
                <th className="px-4 py-3 font-medium text-right">Gross</th>
                <th className="px-4 py-3 font-medium text-right">Deductions</th>
                <th className="px-4 py-3 font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {payroll.payslips.map((ps) => (
                <tr
                  key={ps.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {userDisplayName(ps.employee.user)}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {ps.employee.employeeNumber}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatMoney(ps.basicPay, payroll.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatMoney(ps.overtimePay, payroll.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatMoney(ps.allowances, payroll.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatMoney(ps.grossPay, payroll.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-red-400">
                    {formatMoney(ps.totalDeductions, payroll.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-primary">
                    {formatMoney(ps.netPay, payroll.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
