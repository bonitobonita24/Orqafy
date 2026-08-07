import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "Edit Product" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        description: true,
        categoryId: true,
        unit: true,
        baseCost: true,
        reorderLevel: true,
        isActive: true,
        isSerialTracked: true,
      },
    }),
    prisma.category.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (product === null) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Product"
        description={product.name}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/inventory`}>← Back</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-6">
          <ProductForm
            slug={slug}
            categories={categories}
            mode="edit"
            productId={product.id}
            defaultValues={{
              name: product.name,
              sku: product.sku,
              barcode: product.barcode,
              description: product.description,
              categoryId: product.categoryId,
              unit: product.unit,
              baseCost: product.baseCost.toString(),
              reorderLevel: product.reorderLevel,
              isActive: product.isActive,
              isSerialTracked: product.isSerialTracked,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
