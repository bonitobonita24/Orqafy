import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { QuotationPdfClient } from "./quotation-pdf-client";

export const metadata: Metadata = { title: "Quotation PDF Preview" };

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function QuotationPdfPage({ params }: Props) {
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
      createdBy: true,
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
    },
  });

  if (quotation === null) notFound();

  const customerName =
    quotation.customer.companyName !== null &&
    quotation.customer.companyName.length > 0
      ? quotation.customer.companyName
      : `${quotation.customer.firstName} ${quotation.customer.lastName}`;

  const creatorName =
    quotation.createdBy.displayName !== null &&
    quotation.createdBy.displayName.length > 0
      ? quotation.createdBy.displayName
      : `${quotation.createdBy.firstName} ${quotation.createdBy.lastName}`;

  const serialized = {
    quotationNumber: quotation.quotationNumber,
    title: quotation.title,
    status: quotation.status,
    customerName,
    creatorName,
    createdAt: quotation.createdAt.toISOString(),
    validUntil:
      quotation.validUntil !== null ? quotation.validUntil.toISOString() : null,
    subtotal: Number(quotation.subtotal),
    taxAmount: Number(quotation.taxAmount),
    totalAmount: Number(quotation.totalAmount),
    currency: quotation.currency,
    notes: quotation.notes,
    termsAndConditions: quotation.termsAndConditions,
    markupColumns: quotation.markupColumns.map((c) => ({
      id: c.id,
      name: c.name,
      percentage: Number(c.percentage),
    })),
    sections: quotation.sections.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      lineItems: s.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        unit: li.unit,
        quantity: Number(li.quantity),
        baseCost: Number(li.baseCost),
        markups: li.markups.map((m) => ({
          markupColumnId: m.markupColumnId,
          markedUpPrice: Number(m.markedUpPrice),
        })),
      })),
    })),
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h1 className="text-sm font-medium">
          PDF Preview · {quotation.quotationNumber}
        </h1>
        <Link
          href={`/${slug}/crm/quotations/${quotation.id}`}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          ← Back to quotation
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        <QuotationPdfClient data={serialized} />
      </div>
    </div>
  );
}
