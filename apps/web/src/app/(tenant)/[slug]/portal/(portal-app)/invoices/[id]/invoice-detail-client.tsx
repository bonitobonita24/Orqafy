"use client";

import Link from "next/link";
import { ChevronLeft, Receipt } from "@/components/ui/icons";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Presentation (header/dates/line-items/totals/notes) lifted verbatim from
// the D-4 public invoice view (apps/web/src/app/invoice/[token]/page.tsx),
// extended with the customer's own payment history — a detail visible to
// the authed customer that the token-only public view does not expose.
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

function toNumber(amount: unknown): number {
  if (
    typeof amount === "object" &&
    amount !== null &&
    "toNumber" in amount &&
    typeof (amount as { toNumber: unknown }).toNumber === "function"
  ) {
    return (amount as { toNumber: () => number }).toNumber();
  }
  return Number(amount);
}

function formatCurrency(amount: unknown, currency: string): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(toNumber(amount));
}

function formatDate(d: Date | string | null): string {
  if (d === null) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(d));
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceDetailClientProps {
  slug: string;
  id: string;
}

export function InvoiceDetailClient({ slug, id }: InvoiceDetailClientProps) {
  const { data: invoice, isLoading, error } = trpc.portal.invoices.byId.useQuery({ id });

  const backLink = (
    <Link
      href={`/${slug}/portal/invoices`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
    >
      <ChevronLeft className="size-4" />
      Back to invoices
    </Link>
  );

  if (isLoading) {
    return (
      <div data-fdl="portal-invoice-detail" className="space-y-6">
        {backLink}
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // NOT_FOUND is expected here — an id that exists but belongs to someone
  // else, or a stale/mistyped link. Never a crash, just a friendly state.
  if (error !== null || invoice === undefined) {
    return (
      <div data-fdl="portal-invoice-detail" className="space-y-6">
        {backLink}
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Receipt}
              title="Invoice not found"
              description="This invoice doesn't exist or isn't available to your account."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = invoice.currency ?? "PHP";
  const statusClass = STATUS_COLORS[invoice.status] ?? "text-muted-foreground bg-muted border-border";
  const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status;

  const lineItems = Array.isArray(invoice.lineItems) ? (invoice.lineItems as unknown as LineItem[]) : [];

  return (
    <div data-fdl="portal-invoice-detail" className="space-y-6">
      {backLink}

      <Card>
        <CardContent className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-mono text-xl font-semibold">{invoice.invoiceNumber}</h1>
            </div>
            <Badge variant="outline" className={`rounded-full ${statusClass}`}>
              {statusLabel}
            </Badge>
          </div>

          {/* Dates */}
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Due Date</dt>
              <dd className="mt-0.5 text-sm">{formatDate(invoice.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Issued</dt>
              <dd className="mt-0.5 text-sm">{formatDate(invoice.issuedAt)}</dd>
            </div>
            {invoice.paidAt !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">Paid</dt>
                <dd className="mt-0.5 text-sm">{formatDate(invoice.paidAt)}</dd>
              </div>
            )}
          </dl>

          {/* Line Items */}
          <div className="mt-6">
            {lineItems.length === 0 ? (
              <div className="rounded-md border border-border px-4 py-8 text-center text-sm text-muted-foreground">
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
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(item.unitPrice, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(item.quantity * item.unitPrice, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Totals */}
          <div className="mt-4 border-t border-border pt-4">
            <dl className="ml-auto max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatCurrency(invoice.subtotal, currency)}</dd>
              </div>
              {toNumber(invoice.taxAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="tabular-nums">{formatCurrency(invoice.taxAmount, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(invoice.totalAmount, currency)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="tabular-nums">{formatCurrency(invoice.amountPaid, currency)}</dd>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <dt>Balance</dt>
                <dd className="tabular-nums">{formatCurrency(invoice.balance, currency)}</dd>
              </div>
            </dl>
          </div>

          {/* Payments */}
          {invoice.payments.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="mb-2 text-xs text-muted-foreground">Payment History</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">{formatDate(p.paidAt)}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.referenceNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(p.amount, p.currency ?? currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Notes */}
          {invoice.notes !== null && invoice.notes !== "" && (
            <div className="mt-4 border-t border-border pt-4">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{invoice.notes}</dd>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
