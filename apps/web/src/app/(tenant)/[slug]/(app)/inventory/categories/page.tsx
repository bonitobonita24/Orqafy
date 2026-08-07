import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CategoryPanel } from "./category-panel";

export const metadata: Metadata = { title: "Categories" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoriesPage({ params }: PageProps) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const categories = await prisma.category.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
      sortOrder: true,
      isActive: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organise products into categories."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/inventory`}>← Products</Link>
          </Button>
        }
      />

      <CategoryPanel categories={categories} />
    </div>
  );
}
