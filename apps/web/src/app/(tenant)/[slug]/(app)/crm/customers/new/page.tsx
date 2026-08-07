import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "New Customer" };

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NewCustomerPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/crm/customers`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Customers
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">New</span>
      </div>
      <PageHeader title="New Customer" />
      <CustomerForm slug={slug} mode="create" />
    </div>
  );
}
