import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Invoices" };

export const dynamic = "force-dynamic";

async function getInvoices(tenantId: string) {
  return prisma.invoice.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      currency: true,
      totalAmount: true,
      amountPaid: true,
      balance: true,
      dueDate: true,
      createdAt: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          companyName: true,
        },
      },
    },
  });
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-muted-foreground bg-muted border-border",
  sent: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  partially_paid: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  paid: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  overdue: "text-red-400 bg-red-400/10 border-red-400/30",
  void: "text-muted-foreground bg-muted border-border line-through",
  cancelled: "text-muted-foreground bg-muted border-border line-through",
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

export default async function InvoicesPage({
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
  const invoices = await getInvoices(tenant.id);

  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "partially_paid" || i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.balance), 0);

  const paidCount = invoices.filter((i) => i.status === "paid").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {invoices.length} total · {paidCount} paid ·{" "}
            <span className="text-yellow-400">
              {formatCurrency(outstanding, "PHP")} outstanding
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No invoices yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Invoice #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const statusClass =
                  STATUS_COLORS[inv.status] ??
                  "text-muted-foreground bg-muted border-border";
                const statusLabel = STATUS_LABELS[inv.status] ?? inv.status;
                const customerName =
                  inv.customer.companyName ??
                  `${inv.customer.firstName} ${inv.customer.lastName}`;
                return (
                  <tr
                    key={inv.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/${slug}/invoices/${inv.id}`}
                        className="text-[#00d992] hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{customerName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(inv.totalAmount, inv.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {Number(inv.balance) > 0
                        ? formatCurrency(inv.balance, inv.currency)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(inv.dueDate)}
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
