import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { QuotationBuilder } from "./quotation-builder";

export const metadata: Metadata = { title: "New quotation" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewQuotationPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();
  const customers = await prisma.customer.findMany({
    where: { isActive: true, tenantId: tenant.id },
    orderBy: { companyName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
    },
  });

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
        title="New quotation"
        description="Build a draft quotation with sections, markup columns, and line items. Subtotal locks at create — create a revision to change it later."
      />
      <QuotationBuilder slug={slug} customers={customers} />
    </div>
  );
}
