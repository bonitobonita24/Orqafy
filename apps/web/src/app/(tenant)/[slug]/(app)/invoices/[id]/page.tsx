import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { InvoiceActions } from "./invoice-actions";

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">
            {invoice.invoiceNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {customerName}
            {invoice.project !== null && (
              <span className="ml-2 text-muted-foreground/60">
                · {invoice.project.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {statusLabel}
          </span>
          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
            outstandingBalance={outstandingBalance}
            fundSources={fundSources}
          />
        </div>
      </div>

      {/* Invoice Info */}
      <div className="rounded-lg border border-border bg-card p-6">
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
      </div>

      {/* Line Items */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Line Items</h2>
        </div>
        {lineItems.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No line items.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Unit Price</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr
                  key={idx}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(item.unitPrice, invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(item.quantity * item.unitPrice, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      </div>

      {/* Payments History */}
      <div className="rounded-lg border border-border bg-card">
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Fund Source</th>
                <th className="px-4 py-3 font-medium">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {completedPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(payment.paidAt)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary">
                    {formatCurrency(payment.amount, payment.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {METHOD_LABELS[payment.method] ?? payment.method}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {payment.referenceNumber !== null ? payment.referenceNumber : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {payment.fundSource !== null ? payment.fundSource.name : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {payment.recordedBy !== null
                      ? `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}`
                      : "—"}
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
