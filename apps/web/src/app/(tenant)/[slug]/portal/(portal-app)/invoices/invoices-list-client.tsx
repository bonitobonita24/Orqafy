"use client";

import Link from "next/link";
import { Receipt } from "@/components/ui/icons";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Status label/color idiom lifted verbatim from the D-4 public invoice view
// (apps/web/src/app/invoice/[token]/page.tsx) and the staff invoices list
// (apps/web/src/app/(tenant)/[slug]/(app)/invoices/page.tsx) for a
// consistent invoice-status vocabulary across every surface.
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

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(d));
}

interface InvoicesListClientProps {
  slug: string;
}

export function InvoicesListClient({ slug }: InvoicesListClientProps) {
  const { data: invoices, isLoading } = trpc.portal.invoices.list.useQuery();

  return (
    <div data-fdl="portal-invoices-list" className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and track your invoices.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : invoices === undefined || invoices.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Receipt} title="No invoices yet" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const statusClass =
                    STATUS_COLORS[inv.status] ?? "text-muted-foreground bg-muted border-border";
                  const statusLabel = STATUS_LABELS[inv.status] ?? inv.status;
                  const currency = inv.currency ?? "PHP";
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/${slug}/portal/invoices/${inv.id}`}
                          className="text-primary hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-full ${statusClass}`}>
                          {statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(inv.dueDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(inv.totalAmount, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {toNumber(inv.balance) > 0 ? formatCurrency(inv.balance, currency) : "—"}
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
