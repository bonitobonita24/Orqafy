import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { StaffOrderForm } from "./staff-order-form";

export const metadata: Metadata = { title: "Place order on behalf" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PlaceOrderPage({ params }: PageProps) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Place order on behalf</h1>
          <p className="text-sm text-muted-foreground">
            Create an ecommerce order for an existing CRM customer.
          </p>
        </div>
        <Link
          href={`/${slug}/ecommerce/orders`}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to orders
        </Link>
      </div>

      <StaffOrderForm slug={slug} />
    </div>
  );
}
