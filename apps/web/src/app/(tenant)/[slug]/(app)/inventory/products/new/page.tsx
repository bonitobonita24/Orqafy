import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New Product" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewProductPage({ params }: PageProps) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const categories = await prisma.category.findMany({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Product"
        description="Add a product to your inventory catalogue."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/inventory`}>← Back</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-6">
          <ProductForm slug={slug} categories={categories} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
