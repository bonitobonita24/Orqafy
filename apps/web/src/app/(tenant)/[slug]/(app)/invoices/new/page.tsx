import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "./invoice-form";

export const metadata: Metadata = { title: "New Invoice" };

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NewInvoicePage({ params }: Props) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const [customers, projects] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true, tenantId: tenant.id },
      orderBy: { companyName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
      },
    }),
    prisma.project.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ["planning", "active", "on_hold"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/invoices`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Invoices
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">New</span>
      </div>
      <PageHeader title="New Invoice" />
      <InvoiceForm slug={slug} customers={customers} projects={projects} />
    </div>
  );
}
