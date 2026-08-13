import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  paid: "text-primary bg-primary/10 border-primary/30",
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
      <PageHeader
        title="Invoices"
        description={
          <>
            {invoices.length} total · {paidCount} paid ·{" "}
            <span className="text-foreground">
              {formatCurrency(outstanding, "PHP")} outstanding
            </span>
          </>
        }
        actions={
          <Button asChild>
            <Link href={`/${slug}/invoices/new`}>New Invoice</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={FileText} title="No invoices yet." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const statusClass =
                    STATUS_COLORS[inv.status] ??
                    "text-muted-foreground bg-muted border-border";
                  const statusLabel = STATUS_LABELS[inv.status] ?? inv.status;
                  const customerName =
                    inv.customer.companyName ??
                    `${inv.customer.firstName} ${inv.customer.lastName}`;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/${slug}/invoices/${inv.id}`}
                          className="text-primary hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{customerName}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${statusClass}`}
                        >
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(inv.totalAmount, inv.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {Number(inv.balance) > 0
                          ? formatCurrency(inv.balance, inv.currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(inv.dueDate)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
