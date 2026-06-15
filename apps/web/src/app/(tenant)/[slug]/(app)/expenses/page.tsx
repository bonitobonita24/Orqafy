import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Expenses" };

export const dynamic = "force-dynamic";

async function getExpenses(tenantId: string) {
  return prisma.expense.findMany({
    where: { tenantId },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true,
      expenseNumber: true,
      description: true,
      amount: true,
      currency: true,
      date: true,
      status: true,
      expenseCategory: {
        select: { name: true, code: true },
      },
      createdBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  reimbursed: "Reimbursed",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  approved: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  rejected: "text-red-400 bg-red-400/10 border-red-400/30",
  reimbursed: "text-primary bg-primary/10 border-primary/30",
};

function formatCurrency(amount: unknown, currency: string): string {
  const num = typeof amount === "object" && amount !== null && "toNumber" in amount
    ? (amount as { toNumber: () => number }).toNumber()
    : Number(amount);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();
  const expenses = await getExpenses(tenant.id);

  const pending = expenses.filter((e) => e.status === "pending");
  const pendingTotal = pending.reduce((sum, e) => sum + Number(e.amount), 0);
  const approvedCount = expenses.filter((e) => e.status === "approved" || e.status === "reimbursed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            {expenses.length} total · {approvedCount} approved ·{" "}
            <span className="text-yellow-400">
              {pending.length} pending ({formatCurrency(pendingTotal, "PHP")})
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {expenses.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No expenses recorded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Expense #</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Submitted by</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const statusClass =
                  STATUS_COLORS[e.status] ??
                  "text-muted-foreground bg-muted border-border";
                const statusLabel = STATUS_LABELS[e.status] ?? e.status;
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {e.expenseNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.description}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.expenseCategory.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.createdBy.firstName} {e.createdBy.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(e.amount, e.currency)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(e.date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
