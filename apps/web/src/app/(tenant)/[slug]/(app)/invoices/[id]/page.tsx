import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceActions } from "./invoice-actions";
import { InvoiceAttachments } from "./invoice-attachments";

export const metadata: Metadata = { title: "Invoice Detail" };

export const dynamic = "force-dynamic";

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

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  gcash: "GCash",
  maya: "Maya",
  card: "Card",
  xendit: "Xendit",
  credit: "Credit",
};

function formatCurrency(amount: unknown, currency: string): string {
  const num =
    typeof amount === "object" && amount !== null && "toNumber" in amount
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

async function getInvoice(id: string, tenantId: string) {
  return prisma.invoice.findFirst({
    where: { id, tenantId },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
          phone: true,
        },
      },
      project: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      // publicToken powers the staff-side "Copy share link" button (D-4);
      // never surfaced to any customer-facing endpoint from this include.
      payments: {
        orderBy: { paidAt: "desc" },
        include: {
          fundSource: { select: { name: true } },
          recordedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
}

async function getFundSources(tenantId: string) {
  const result = await prisma.fundSource.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true },
  });
  return result;
}

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const [invoice, fundSources] = await Promise.all([
    getInvoice(id, tenant.id),
    getFundSources(tenant.id),
  ]);

  if (invoice === null) notFound();

  const statusClass =
    STATUS_COLORS[invoice.status] ?? "text-muted-foreground bg-muted border-border";
  const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status;

  const customerName =
    invoice.customer.companyName !== null
      ? invoice.customer.companyName
      : `${invoice.customer.firstName} ${invoice.customer.lastName}`;

  const totalAmount = Number(invoice.totalAmount);
  const amountPaid = Number(invoice.amountPaid);
  const outstandingBalance = Math.round((totalAmount - amountPaid) * 100) / 100;

  // lineItems is a JSON field typed as Prisma.JsonValue; cast to array
  const lineItems = Array.isArray(invoice.lineItems)
    ? (invoice.lineItems as Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>)
    : [];

  const completedPayments = invoice.payments.filter((p) => p.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        className="sm:items-start"
        title={invoice.invoiceNumber}
        titleClassName="font-mono"
        description={
          <>
            {customerName}
            {invoice.project !== null && (
              <span className="ml-2 text-muted-foreground/60">
                · {invoice.project.name}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Badge variant="outline" className={`rounded-full ${statusClass}`}>
              {statusLabel}
            </Badge>
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
              outstandingBalance={outstandingBalance}
              fundSources={fundSources}
              publicToken={invoice.publicToken}
            />
          </>
        }
      />

      {/* Invoice Info */}
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Invoice Details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Due Date</dt>
              <dd className="mt-0.5 text-sm">{formatDate(invoice.dueDate)}</dd>
            </div>
            {invoice.issuedAt !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">Issued</dt>
                <dd className="mt-0.5 text-sm">{formatDate(invoice.issuedAt)}</dd>
              </div>
            )}
            {invoice.paidAt !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">Paid</dt>
                <dd className="mt-0.5 text-sm">{formatDate(invoice.paidAt)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground">Created By</dt>
              <dd className="mt-0.5 text-sm">
                {invoice.createdBy.firstName} {invoice.createdBy.lastName}
              </dd>
            </div>
            {invoice.customer.email !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">Customer Email</dt>
                <dd className="mt-0.5 text-sm">{invoice.customer.email}</dd>
              </div>
            )}
            {invoice.customer.phone !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">Customer Phone</dt>
                <dd className="mt-0.5 text-sm">{invoice.customer.phone}</dd>
              </div>
            )}
          </dl>
          {invoice.notes !== null && (
            <div className="mt-4 border-t border-border pt-4">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{invoice.notes}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Line Items</h2>
        </div>
        {lineItems.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No line items.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.unitPrice, invoice.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(item.quantity * item.unitPrice, invoice.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Totals */}
        <div className="border-t border-border px-6 py-4">
          <dl className="space-y-1.5 ml-auto max-w-xs">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">
                {formatCurrency(invoice.subtotal, invoice.currency)}
              </dd>
            </div>
            {Number(invoice.taxAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular-nums">
                  {formatCurrency(invoice.taxAmount, invoice.currency)}
                </dd>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5 mt-1.5">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {formatCurrency(invoice.totalAmount, invoice.currency)}
              </dd>
            </div>
            {amountPaid > 0 && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Amount Paid</dt>
                <dd className="tabular-nums text-primary">
                  {formatCurrency(invoice.amountPaid, invoice.currency)}
                </dd>
              </div>
            )}
            {outstandingBalance > 0 && (
              <div className="flex justify-between text-sm font-semibold">
                <dt className="text-yellow-400">Outstanding</dt>
                <dd className="tabular-nums text-yellow-400">
                  {formatCurrency(outstandingBalance, invoice.currency)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </Card>

      {/* Attachments */}
      <Card>
        <CardContent className="p-6">
          <InvoiceAttachments invoiceId={invoice.id} />
        </CardContent>
      </Card>

      {/* Payments History */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">
            Payment History
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {completedPayments.length}
            </span>
          </h2>
        </div>
        {completedPayments.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Fund Source</TableHead>
                <TableHead>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(payment.paidAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-primary">
                    {formatCurrency(payment.amount, payment.currency)}
                  </TableCell>
                  <TableCell>
                    {METHOD_LABELS[payment.method] ?? payment.method}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {payment.referenceNumber !== null ? payment.referenceNumber : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {payment.fundSource !== null ? payment.fundSource.name : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {payment.recordedBy !== null
                      ? `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
