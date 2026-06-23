import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { auth } from "@/server/auth";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Wrench,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { TopClientsTable } from "@/components/reports/top-clients-table";
import { RevenueChart } from "./revenue-chart";
import { ExpensesChart } from "./expenses-chart";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

function formatAmount(amount: unknown): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function formatInt(value: unknown): string {
  return new Intl.NumberFormat("en-PH").format(Number(value));
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  cancelled: "Cancelled",
};

const JOB_ORDER_STATUS_LABELS: Record<string, string> = {
  received: "Received",
  diagnosing: "Diagnosing",
  awaiting_parts: "Awaiting Parts",
  awaiting_approval: "Awaiting Approval",
  in_progress: "In Progress",
  completed: "Completed",
  released: "Released",
  cancelled: "Cancelled",
};

async function getKPIs(tenantId: string) {
  const [invoiceStats, expenseStats, jobOrderStats, customers, projects, employees] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: { tenantId },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.expense.aggregate({
        where: { tenantId, status: "approved" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.jobOrder.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: { id: true },
      }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.project.count({ where: { tenantId } }),
      prisma.employee.count({ where: { tenantId } }),
    ]);

  const revenue = Number(invoiceStats._sum.totalAmount ?? 0);
  const expensesTotal = Number(expenseStats._sum.amount ?? 0);

  return {
    revenue,
    revenueCount: invoiceStats._count.id,
    expensesTotal,
    expensesCount: expenseStats._count.id,
    netIncome: revenue - expensesTotal,
    jobOrders: jobOrderStats as Array<{ status: string; _count: { id: number } }>,
    customers,
    projects,
    employees,
  };
}

async function getInvoicesByStatus(tenantId: string) {
  return prisma.invoice.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { id: true },
    _sum: { totalAmount: true },
  });
}

async function getTopClients(tenantId: string) {
  const grouped = await prisma.invoice.groupBy({
    by: ["customerId"],
    where: { tenantId, status: "paid" },
    _sum: { totalAmount: true },
    _count: { id: true },
    orderBy: { _sum: { totalAmount: "desc" } },
    take: 10,
  });

  if (grouped.length === 0) return [];

  const customers = await prisma.customer.findMany({
    where: { tenantId, id: { in: grouped.map((g) => g.customerId) } },
    select: { id: true, firstName: true, lastName: true, companyName: true },
  });
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  return grouped.map((g) => {
    const c = customerMap.get(g.customerId);
    const name =
      c === undefined
        ? "Unknown"
        : c.companyName ?? `${c.firstName} ${c.lastName}`.trim();
    return {
      customerId: g.customerId,
      name,
      revenue: Number(g._sum.totalAmount ?? 0),
      invoiceCount: g._count.id,
    };
  });
}

async function getExpensesByCategory(tenantId: string) {
  const grouped = await prisma.expense.groupBy({
    by: ["expenseCategoryId"],
    where: { tenantId, status: "approved" },
    _sum: { amount: true },
    _count: { id: true },
  });

  if (grouped.length === 0) return [];

  const categories = await prisma.expenseCategory.findMany({
    where: { tenantId, id: { in: grouped.map((g) => g.expenseCategoryId) } },
    select: { id: true, name: true, code: true },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  return grouped
    .map((g) => {
      const c = catMap.get(g.expenseCategoryId);
      return {
        expenseCategoryId: g.expenseCategoryId,
        name: c?.name ?? "Unknown",
        code: c?.code ?? "—",
        total: Number(g._sum.amount ?? 0),
        count: g._count.id,
      };
    })
    .sort((a, b) => b.total - a.total);
}

async function getPayrollSummary(tenantId: string) {
  const agg = await prisma.payroll.aggregate({
    where: { tenantId, status: "paid" },
    _sum: { totalGross: true, totalNet: true, totalDeductions: true },
    _count: { id: true },
  });
  return {
    totalGross: Number(agg._sum.totalGross ?? 0),
    totalNet: Number(agg._sum.totalNet ?? 0),
    totalDeductions: Number(agg._sum.totalDeductions ?? 0),
    payrollCount: agg._count.id,
  };
}

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Tenant isolation: scope every aggregate to the signed-in user's tenant.
  // Mirrors reportRouter's ctx.tenantId scoping — without it these cross-module
  // aggregates would span ALL tenants (cross-tenant data leak).
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (
    session?.user == null ||
    session.user.error === "SESSION_INVALIDATED" ||
    tenantId == null ||
    tenantId === ""
  ) {
    notFound();
  }

  const [kpis, invoicesByStatus, topClients, expensesByCategory, payroll] =
    await Promise.all([
      getKPIs(tenantId),
      getInvoicesByStatus(tenantId),
      getTopClients(tenantId),
      getExpensesByCategory(tenantId),
      getPayrollSummary(tenantId),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Cross-module financial and operational analytics.
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={formatAmount(kpis.revenue)}
          sub={`${formatInt(kpis.revenueCount)} invoices`}
          accent
        />
        <KpiCard
          label="Approved Expenses"
          value={formatAmount(kpis.expensesTotal)}
          sub={`${formatInt(kpis.expensesCount)} records`}
        />
        <KpiCard
          label="Net Income"
          value={formatAmount(kpis.netIncome)}
          sub="Revenue − Expenses"
          accent={kpis.netIncome >= 0}
          danger={kpis.netIncome < 0}
        />
        <KpiCard
          label="Active Records"
          value={`${formatInt(kpis.customers)} customers`}
          sub={`${formatInt(kpis.projects)} projects · ${formatInt(kpis.employees)} employees`}
        />
      </div>

      {/* Revenue over time — client chart (date-range filter, Recharts AreaChart) */}
      <RevenueChart slug={slug} />

      {/* Expenses by category — client chart (date-range filter, Recharts BarChart) */}
      <ExpensesChart slug={slug} />

      {/* Invoice + Job Order status breakdowns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Invoices by Status</h2>
          </header>
          {invoicesByStatus.length === 0 ? (
            <div className="px-6 py-4">
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Invoice counts will appear here once created."
              />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Count</th>
                  <th className="px-4 py-2 text-right font-medium">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoicesByStatus.map((row) => (
                  <tr
                    key={row.status}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2">
                      {INVOICE_STATUS_LABELS[row.status] ?? row.status}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {formatInt(row._count.id)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {formatAmount(row._sum.totalAmount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Job Orders by Status</h2>
          </header>
          {kpis.jobOrders.length === 0 ? (
            <div className="px-6 py-4">
              <EmptyState
                icon={Wrench}
                title="No job orders yet"
                description="Job order status counts will appear here once created."
              />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {kpis.jobOrders.map((row) => (
                  <tr
                    key={row.status}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2">
                      {JOB_ORDER_STATUS_LABELS[row.status] ?? row.status}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {formatInt(row._count.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Top clients — Pro TanStack DataTable (sortable revenue column) */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Top Clients by Revenue (Paid)</h2>
          <span className="text-xs text-muted-foreground">Top 10</span>
        </header>
        <div className="px-0 py-0">
          <TopClientsTable data={topClients} />
        </div>
      </section>

      {/* Expense breakdown by category */}
      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Approved Expenses by Category</h2>
        </header>
        {expensesByCategory.length === 0 ? (
          <div className="px-6 py-4">
            <EmptyState
              icon={Receipt}
              title="No approved expenses yet"
              description="Expense category totals will appear here once expenses are approved."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 text-right font-medium">Records</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {expensesByCategory.map((row) => (
                <tr
                  key={row.expenseCategoryId}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-2 font-medium">{row.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {row.code}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">
                    {formatInt(row.count)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {formatAmount(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Payroll summary */}
      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Payroll Summary (Paid)</h2>
        </header>
        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-4">
          <PayrollStat label="Payrolls Paid" value={formatInt(payroll.payrollCount)} />
          <PayrollStat label="Total Gross" value={formatAmount(payroll.totalGross)} />
          <PayrollStat
            label="Total Deductions"
            value={formatAmount(payroll.totalDeductions)}
          />
          <PayrollStat
            label="Total Net"
            value={formatAmount(payroll.totalNet)}
            accent
          />
        </div>
      </section>
    </div>
  );
}

// ─── Pro KPI stat card — genuine shadcn-studio statistics-component-2 pattern ──
// Key Pro characteristics adopted:
//   • Card/CardContent wrapper (no CardHeader — Pro puts label inside CardContent)
//   • Value: text-3xl font-semibold (not text-2xl font-bold)
//   • Trend badge: bg-primary/10 text-primary rounded-sm (primary-tinted, sign in text)
//   • TrendingUp/Down icon inline with percentage in the badge
//   • Separator between value and sub-label (kept from prior implementation)
//   • danger variant: text-red-500 value + destructive-tinted badge
function KpiCard({
  label,
  value,
  sub,
  accent = false,
  danger = false,
  trend,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  danger?: boolean;
  /** Optional percentage change vs prior period, e.g. +12.5 or -3.2 */
  trend?: number;
}) {
  const valueClass = danger
    ? "text-red-500"
    : accent
      ? "text-primary"
      : "text-foreground";

  const TrendIcon =
    trend === undefined || trend === 0
      ? Minus
      : trend > 0
        ? TrendingUp
        : TrendingDown;

  // Pro: primary-tinted for positive/neutral, red-tinted for negative — not
  // variant="secondary"/"destructive" (those are too heavy for stat cards)
  const trendBadgeClass =
    trend === undefined || trend === 0
      ? "bg-muted/60 text-muted-foreground"
      : trend > 0
        ? "bg-primary/10 text-primary"
        : "bg-red-500/10 text-red-500";

  return (
    <Card>
      <CardContent className="px-5 py-4">
        {/* Pro layout: label row · trend badge top-right */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {trend !== undefined && (
            <Badge
              className={`flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${trendBadgeClass}`}
            >
              <TrendIcon className="h-2.5 w-2.5" />
              {trend > 0 ? "+" : ""}{Math.abs(trend).toFixed(1)}%
            </Badge>
          )}
        </div>
        {/* Pro: text-3xl font-semibold (statistics-component-2 value size) */}
        <div className={`mt-2 text-3xl font-semibold tracking-tight ${valueClass}`}>
          {value}
        </div>
        <Separator className="my-2" />
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function PayrollStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-semibold ${accent ? "text-primary" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
