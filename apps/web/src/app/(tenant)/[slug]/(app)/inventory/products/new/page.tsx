import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Product</h1>
          <p className="text-sm text-muted-foreground">
            Add a product to your inventory catalogue.
          </p>
        </div>
        <Link
          href={`/${slug}/inventory`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Back
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card px-6 py-6">
        <ProductForm slug={slug} categories={categories} mode="create" />
      </div>
    </div>
  );
}
