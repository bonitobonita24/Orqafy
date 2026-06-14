import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Product</h1>
          <p className="text-sm text-muted-foreground">{product.name}</p>
        </div>
        <Link
          href={`/${slug}/inventory`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Back
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card px-6 py-6">
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
      </div>
    </div>
  );
}
