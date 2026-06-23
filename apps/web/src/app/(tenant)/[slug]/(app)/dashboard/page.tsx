import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import {
  FileText,
  Receipt,
  Users,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DashboardNotifications } from "./dashboard-notifications";

export const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

function toNumber(v: unknown): number {
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

function formatCurrency(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  }).format(d);
}

async function getDashboardData(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) {
    return null;
  }
  const tenantId = tenant.id;
  const [
    invoices,
    expenses,
    activeCustomers,
    recentInvoices,
    recentExpenses,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId },
      select: { status: true, balance: true, totalAmount: true, currency: true },
    }),
    prisma.expense.findMany({
      where: { tenantId },
      select: { status: true, amount: true, currency: true },
    }),
    prisma.customer.count({ where: { tenantId, isActive: true } }),
    prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        customer: {
          select: { firstName: true, lastName: true, companyName: true },
        },
      },
    }),
    prisma.expense.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        expenseNumber: true,
        description: true,
        status: true,
        amount: true,
        currency: true,
        date: true,
      },
    }),
  ]);

  const outstanding = invoices
    .filter(
      (i) =>
        i.status === "sent" ||
        i.status === "partially_paid" ||
        i.status === "overdue",
    )
    .reduce((sum, i) => sum + toNumber(i.balance), 0);
  const outstandingCount = invoices.filter(
    (i) =>
      i.status === "sent" ||
      i.status === "partially_paid" ||
      i.status === "overdue",
  ).length;

  const pendingExpenses = expenses.filter((e) => e.status === "pending");
  const pendingExpenseTotal = pendingExpenses.reduce(
    (sum, e) => sum + toNumber(e.amount),
    0,
  );

  const paidThisMonth = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + toNumber(i.totalAmount), 0);

  return {
    tenant,
    outstanding,
    outstandingCount,
    pendingExpenseTotal,
    pendingExpenseCount: pendingExpenses.length,
    activeCustomers,
    paidThisMonth,
    paidCount: invoices.filter((i) => i.status === "paid").length,
    recentInvoices,
    recentExpenses,
  };
}

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "text-muted-foreground bg-muted border-border",
  sent: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  partially_paid: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  paid: "text-primary bg-primary/10 border-primary/30",
  overdue: "text-red-400 bg-red-400/10 border-red-400/30",
  void: "text-muted-foreground bg-muted border-border",
  cancelled: "text-muted-foreground bg-muted border-border",
};

const EXPENSE_STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  approved: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  rejected: "text-red-400 bg-red-400/10 border-red-400/30",
  reimbursed: "text-primary bg-primary/10 border-primary/30",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getDashboardData(slug);
  if (!data) notFound();

  const kpis = [
    {
      label: "Outstanding",
      value: formatCurrency(data.outstanding),
      sub: `${data.outstandingCount} unpaid invoice${data.outstandingCount === 1 ? "" : "s"}`,
      icon: FileText,
      accent: "text-foreground",
      href: `/${slug}/invoices`,
    },
    {
      label: "Pending Expenses",
      value: formatCurrency(data.pendingExpenseTotal),
      sub: `${data.pendingExpenseCount} awaiting approval`,
      icon: Receipt,
      accent: "text-foreground",
      href: `/${slug}/expenses`,
    },
    {
      label: "Active Customers",
      value: data.activeCustomers.toString(),
      sub: "customer accounts",
      icon: Users,
      accent: "text-foreground",
      href: `/${slug}/crm/customers`,
    },
    {
      label: "Paid Invoices",
      value: formatCurrency(data.paidThisMonth),
      sub: `${data.paidCount} settled`,
      icon: Briefcase,
      accent: "text-foreground",
      href: `/${slug}/invoices`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {data.tenant?.name ?? "Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview of activity across your workspace.
        </p>
      </div>

      {/* Pro-style KPI cards — shadcn-studio statistics-component-02 pattern:
          icon top-right · value · separator · sub-label · hover lift */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="group rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/30 hover:bg-card/80 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {kpi.label}
                </p>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 transition-colors group-hover:border-primary/20 group-hover:bg-primary/5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
              </div>
              <p className={`mt-2 text-2xl font-bold tracking-tight ${kpi.accent}`}>
                {kpi.value}
              </p>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Recent invoices</h2>
            <Link
              href={`/${slug}/invoices`}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recentInvoices.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">
              No invoices yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentInvoices.map((inv) => {
                const customerName =
                  inv.customer.companyName ??
                  `${inv.customer.firstName} ${inv.customer.lastName}`;
                const colorClass =
                  INVOICE_STATUS_COLORS[inv.status] ??
                  "text-muted-foreground bg-muted border-border";
                return (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {customerName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {inv.invoiceNumber} · {formatDate(inv.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(toNumber(inv.totalAmount), inv.currency)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Recent expenses</h2>
            <Link
              href={`/${slug}/expenses`}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recentExpenses.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">
              No expenses yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentExpenses.map((e) => {
                const colorClass =
                  EXPENSE_STATUS_COLORS[e.status] ??
                  "text-muted-foreground bg-muted border-border";
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {e.description}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {e.expenseNumber} · {formatDate(e.date)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">
                        {formatCurrency(toNumber(e.amount), e.currency)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}
                      >
                        {e.status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <DashboardNotifications />
    </div>
  );
}
