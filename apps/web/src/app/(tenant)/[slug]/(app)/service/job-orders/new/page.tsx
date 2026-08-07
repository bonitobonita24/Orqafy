import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { NewJobOrderForm } from "./new-job-order-form";

export const metadata: Metadata = { title: "New Job Order" };
export const dynamic = "force-dynamic";

export default async function NewJobOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (tenant === null) notFound();

  // Load active customers for the intake form's customer selector.
  // Scoped to this tenant via tenantId — tenant isolation at the query level.
  const customers = await prisma.customer.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
    },
    orderBy: { companyName: "asc" },
    take: 500,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/job-orders`}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Job orders
        </Link>
        <PageHeader
          className="mt-1"
          title="New Job Order"
          description="Record a new repair or service intake for a customer."
        />
      </div>
      <NewJobOrderForm slug={slug} customers={customers} />
    </div>
  );
}
