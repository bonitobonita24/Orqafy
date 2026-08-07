import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { formatCurrency } from "@/lib/quotation-build";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuotationActions } from "./quotation-actions";

export const metadata: Metadata = { title: "Quotation" };

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  draft: "text-muted-foreground bg-muted border-border",
  sent: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  accepted: "text-primary bg-primary/10 border-primary/30",
  rejected: "text-red-400 bg-red-400/10 border-red-400/30",
  expired: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  converted: "text-purple-400 bg-purple-400/10 border-purple-400/30",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Converted",
};

function customerLabel(customer: {
  companyName: string | null;
  firstName: string;
  lastName: string;
}): string {
  const company = customer.companyName?.trim();
  if (company !== undefined && company.length > 0) return company;
  return `${customer.firstName} ${customer.lastName}`;
}

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function QuotationDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();
  const quotation = await prisma.quotation.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      customer: true,
      createdBy: {
        select: { id: true, firstName: true, lastName: true, displayName: true },
      },
      markupColumns: { orderBy: { sortOrder: "asc" } },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          lineItems: {
            orderBy: { sortOrder: "asc" },
            include: { markups: true },
          },
        },
      },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        take: 10,
        select: { id: true, revisionNumber: true, createdAt: true },
      },
    },
  });

  if (!quotation) notFound();

  const statusClass = STATUS_COLORS[quotation.status] ?? STATUS_COLORS["draft"]!;
  const statusLabel = STATUS_LABELS[quotation.status] ?? quotation.status;
  const displayName = quotation.createdBy.displayName;
  const creator =
    displayName !== null && displayName.length > 0
      ? displayName
      : `${quotation.createdBy.firstName} ${quotation.createdBy.lastName}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/crm/quotations`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Quotations
        </Link>
      </div>

      <PageHeader
        title={quotation.title}
        titleClassName="text-2xl"
        description={
          <>
            <span className="mr-2 inline-flex items-center gap-2 font-mono text-xs font-bold text-foreground">
              {quotation.quotationNumber}
              <Badge variant="outline" className={`rounded-full ${statusClass}`}>
                {statusLabel}
              </Badge>
            </span>
            <br className="sm:hidden" />
            For {customerLabel(quotation.customer)} · Created by {creator} ·{" "}
            {quotation.createdAt.toLocaleDateString()}
            {quotation.validUntil
              ? ` · Valid until ${quotation.validUntil.toLocaleDateString()}`
              : ""}
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/crm/quotations/${quotation.id}/pdf`}>View PDF</Link>
            </Button>
            <QuotationActions
              quotationId={quotation.id}
              status={quotation.status}
              convertedToInvoiceId={quotation.convertedToInvoiceId}
              slug={slug}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {quotation.sections.length === 0 ? (
            <Card>
              <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
                No sections on this quotation.
              </CardContent>
            </Card>
          ) : (
            quotation.sections.map((section) => (
              <Card key={section.id}>
                <div className="border-b border-border px-4 py-3">
                  <h3 className="font-medium">{section.name}</h3>
                  {section.description !== null && section.description.length > 0 ? (
                    <p className="text-xs text-muted-foreground">{section.description}</p>
                  ) : null}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Base cost</TableHead>
                      {quotation.markupColumns.map((col) => (
                        <TableHead
                          key={col.id}
                          className="text-right"
                          title={`${col.tier} · ${col.percentage.toString()}%${col.useCeiling ? " (ceiling)" : ""}`}
                        >
                          {col.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.lineItems.map((li) => (
                      <TableRow key={li.id}>
                        <TableCell>{li.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {li.quantity.toString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {li.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(Number(li.baseCost), quotation.currency)}
                        </TableCell>
                        {quotation.markupColumns.map((col) => {
                          const markup = li.markups.find(
                            (m) => m.markupColumnId === col.id,
                          );
                          return (
                            <TableCell key={col.id} className="text-right font-mono">
                              {markup
                                ? formatCurrency(
                                    Number(markup.markedUpPrice),
                                    quotation.currency,
                                  )
                                : "—"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))
          )}

          <Card>
            <CardContent className="p-4">
              <div className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">
                    {formatCurrency(Number(quotation.subtotal), quotation.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-mono">
                    {formatCurrency(Number(quotation.taxAmount), quotation.currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="font-mono">
                    {formatCurrency(Number(quotation.totalAmount), quotation.currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {quotation.notes !== null && quotation.notes.length > 0 ? (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes
                </h4>
                <p className="mt-2 whitespace-pre-wrap text-sm">{quotation.notes}</p>
              </CardContent>
            </Card>
          ) : null}

          {quotation.termsAndConditions !== null
          && quotation.termsAndConditions.length > 0 ? (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Terms & Conditions
                </h4>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {quotation.termsAndConditions}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Markup columns
              </h4>
              {quotation.markupColumns.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No markup columns.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {quotation.markupColumns.map((col) => (
                    <li key={col.id} className="flex justify-between gap-3">
                      <span>
                        {col.name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({col.tier})
                        </span>
                      </span>
                      <span className="font-mono text-xs">
                        {col.percentage.toString()}%{col.useCeiling ? " ⌈⌉" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Revisions
              </h4>
              {quotation.revisions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No revisions yet.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {quotation.revisions.map((rev) => (
                    <li key={rev.id} className="flex justify-between">
                      <span>Rev #{rev.revisionNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {rev.createdAt.toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
