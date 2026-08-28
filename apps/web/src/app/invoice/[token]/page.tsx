// Public, unauthenticated invoice view — /invoice/[token].
//
// Security: the token is the sole authorisation (crypto.randomUUID(),
// generated in server/trpc/routers/invoice.ts invoice.create). This page
// carries customer PII behind an unguessable token and must never be
// indexed by search engines (robots noindex,nofollow below) or crawled
// into a sitemap.
//
// No app shell/sidebar — this route sits outside the (tenant)/[slug] group
// and renders standalone for guests.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import { getPublicInvoiceByToken } from "@/server/lib/public-invoice";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/require-await
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
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

function toNumber(amount: unknown): number {
  if (
    typeof amount === "object" &&
    amount !== null &&
    "toNumber" in amount &&
    typeof amount.toNumber === "function"
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

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicInvoicePage({ params }: Props) {
  const { token } = await params;
  const invoice = await getPublicInvoiceByToken(token);

  if (invoice === null) {
    notFound();
  }

  const currency = invoice.currency ?? invoice.tenant.currency ?? "PHP";
  const statusClass =
    STATUS_COLORS[invoice.status] ?? "text-muted-foreground bg-muted border-border";
  const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status;

  const customerName =
    invoice.customer.companyName !== null
      ? invoice.customer.companyName
      : `${invoice.customer.firstName} ${invoice.customer.lastName}`;

  const lineItems = Array.isArray(invoice.lineItems)
    ? (invoice.lineItems as Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>)
    : [];

  return (
    <section
      data-fdl="public-invoice-shell"
      className="flex-1 bg-muted py-8 sm:py-16 print:bg-white print:py-0"
    >
      <main className="mx-auto max-w-2xl px-4">
        <Card>
          <CardContent className="p-6 sm:p-8">
            {/* Header */}
            <div
              data-fdl="public-invoice-header"
              className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex items-start gap-3">
                {invoice.tenant.logoUrl !== null && (
                  <img
                    src={invoice.tenant.logoUrl}
                    alt={invoice.tenant.name}
                    className="size-10 shrink-0 rounded-md object-contain"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {invoice.tenant.name}
                  </p>
                  <h1 className="mt-0.5 font-mono text-xl font-semibold">
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
              </div>
              <Badge variant="outline" className={`rounded-full ${statusClass}`}>
                {statusLabel}
              </Badge>
            </div>

            {/* Dates */}
            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </dl>

            {/* Line Items */}
            <div data-fdl="public-invoice-lines" className="mt-6">
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
                        <TableCell className="text-right tabular-nums">
                          {item.quantity}
                        </TableCell>
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
            <div
              data-fdl="public-invoice-totals"
              className="mt-4 border-t border-border pt-4"
            >
              <dl className="ml-auto max-w-xs space-y-1.5">
                <div className="flex justify-between text-sm font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">
                    {formatCurrency(invoice.totalAmount, currency)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Notes */}
            {invoice.notes !== null && (
              <div className="mt-4 border-t border-border pt-4">
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">
                  {invoice.notes}
                </dd>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </section>
  );
}
