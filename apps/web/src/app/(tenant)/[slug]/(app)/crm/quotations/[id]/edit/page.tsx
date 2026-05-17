import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@orqafy/db";
import {
  QuotationBuilder,
  type InitialQuotation,
} from "../../new/quotation-builder";
import type { MarkupTier } from "@/lib/quotation-build";

export const metadata: Metadata = { title: "Edit Quotation" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
}

export default async function EditQuotationPage({ params }: PageProps) {
  const { slug, id } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      markupColumns: { orderBy: { sortOrder: "asc" } },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (quotation === null) notFound();
  if (quotation.status !== "draft") {
    redirect(`/${slug}/crm/quotations/${id}`);
  }

  const activeCustomers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, companyName: true },
    orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
  });

  // Ensure the quotation's customer is always selectable, even if inactive.
  let customers: CustomerOption[] = activeCustomers;
  if (!activeCustomers.some((c) => c.id === quotation.customerId)) {
    const owner = await prisma.customer.findUnique({
      where: { id: quotation.customerId },
      select: { id: true, firstName: true, lastName: true, companyName: true },
    });
    if (owner !== null) customers = [owner, ...activeCustomers];
  }

  const initialQuotation: InitialQuotation = {
    id: quotation.id,
    customerId: quotation.customerId,
    title: quotation.title,
    validUntil: quotation.validUntil,
    taxAmount: Number(quotation.taxAmount),
    notes: quotation.notes,
    termsAndConditions: quotation.termsAndConditions,
    markupColumns: quotation.markupColumns.map((c) => ({
      name: c.name,
      tier: c.tier as MarkupTier,
      percentage: Number(c.percentage),
      useCeiling: c.useCeiling,
      sortOrder: c.sortOrder,
    })),
    sections: quotation.sections.map((s) => ({
      name: s.name,
      ...(s.description !== null ? { description: s.description } : {}),
      sortOrder: s.sortOrder,
      lineItems: s.lineItems.map((li) => ({
        ...(li.productId !== null ? { productId: li.productId } : {}),
        description: li.description,
        unit: li.unit,
        quantity: Number(li.quantity),
        baseCost: Number(li.baseCost),
        sortOrder: li.sortOrder,
        markups: [],
      })),
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Edit quotation
        </h1>
        <p className="text-sm text-muted-foreground">
          {quotation.quotationNumber} · Draft
        </p>
      </div>
      <QuotationBuilder
        slug={slug}
        customers={customers}
        initialQuotation={initialQuotation}
      />
    </div>
  );
}
