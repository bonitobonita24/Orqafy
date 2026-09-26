import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { requireTenantSession } from "@/server/auth/require-tenant-session";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { WarehousePanel } from "./warehouse-panel";

export const metadata: Metadata = { title: "Warehouses" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function WarehousesPage({ params }: PageProps) {
  const { slug } = await params;
  await requireTenantSession(slug);

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      isDefault: true,
      isActive: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="Manage your storage locations."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/inventory`}>← Products</Link>
          </Button>
        }
      />

      <WarehousePanel warehouses={warehouses} />
    </div>
  );
}
