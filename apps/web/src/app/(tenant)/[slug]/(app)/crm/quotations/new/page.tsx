import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { QuotationBuilder } from "./quotation-builder";

export const metadata: Metadata = { title: "New quotation" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewQuotationPage({ params }: PageProps) {
  const { slug } = await params;
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New quotation</h1>
        <p className="text-sm text-muted-foreground">
          Build a draft quotation with sections, markup columns, and line items.
          Subtotal locks at create — create a revision to change it later.
        </p>
      </div>
      <QuotationBuilder slug={slug} customers={customers} />
    </div>
  );
}
