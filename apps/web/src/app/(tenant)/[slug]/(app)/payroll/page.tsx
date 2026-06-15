import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Payroll" };
export const dynamic = "force-dynamic";

async function getTenantId(slug: string) {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
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

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "processing", label: "Processing" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
];

function formatMoney(value: unknown, currency: string): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPeriod(start: Date, end: Date): string {
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
}

async function getPayrolls(status: string) {
  const filter = status !== "all" ? { status } : undefined;
  return prisma.payroll.findMany({
    ...(filter !== undefined ? { where: filter } : {}),
    orderBy: { periodStart: "desc" },
    include: { _count: { select: { payslips: true } } },
  });
}

export default async function PayrollPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await routeParams;
  const sp = await searchParams;
  const activeStatus = sp.status ?? "all";
  const payrolls = await getPayrolls(activeStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            {payrolls.length} payroll run{payrolls.length === 1 ? "" : "s"}
            {activeStatus !== "all" ? ` — ${STATUS_LABELS[activeStatus] ?? activeStatus}` : ""}
          </p>
        </div>
        <Link
          href={`/${slug}/payroll/new`}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + New Payroll Run
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?status=${tab.key}`}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              activeStatus === tab.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        {payrolls.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No payroll runs found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Payroll #</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payslips</th>
                <th className="px-4 py-3 font-medium text-right">Gross</th>
                <th className="px-4 py-3 font-medium text-right">Deductions</th>
                <th className="px-4 py-3 font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`payroll/${p.id}`}
                      className="font-mono text-xs font-medium text-primary hover:underline"
                    >
                      {p.payrollNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatPeriod(p.periodStart, p.periodEnd)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[p.status] ?? STATUS_BADGE["draft"]
                      }`}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p._count.payslips}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatMoney(p.totalGross, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                    {formatMoney(p.totalDeductions, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                    {formatMoney(p.totalNet, p.currency)}
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
