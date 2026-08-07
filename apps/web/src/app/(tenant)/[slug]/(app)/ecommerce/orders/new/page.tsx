import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
      <PageHeader
        title="Place order on behalf"
        description="Create an ecommerce order for an existing CRM customer."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/ecommerce/orders`}>← Back to orders</Link>
          </Button>
        }
      />

      <StaffOrderForm slug={slug} />
    </div>
  );
}
