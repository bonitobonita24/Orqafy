import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Edit Client" };

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EditClientPage({ params }: Props) {
  const { slug, id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const client = await prisma.customer.findFirst({
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
      taxId: true,
      tier: true,
      notes: true,
    },
  });
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/clients`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Clients
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">
          {client.companyName ?? `${client.firstName} ${client.lastName}`}
        </span>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">Edit</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Edit Client</h1>
      <ClientForm
        slug={slug}
        mode="edit"
        clientId={client.id}
        initialValues={client}
      />
    </div>
  );
}
