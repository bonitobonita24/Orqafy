import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Edit Customer" };

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EditCustomerPage({ params }: Props) {
  const { slug, id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: tenant.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      country: true,
      taxId: true,
      tier: true,
      notes: true,
    },
  });
  if (!customer) notFound();

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
        <Link
          href={`/${slug}/crm/customers/${customer.id}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {customer.companyName ?? `${customer.firstName} ${customer.lastName}`}
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">Edit</span>
      </div>
      <PageHeader title="Edit Customer" />
      <CustomerForm
        slug={slug}
        mode="edit"
        customerId={customer.id}
        initialValues={customer}
      />
    </div>
  );
}
