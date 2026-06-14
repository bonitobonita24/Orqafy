import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { WarehousePanel } from "./warehouse-panel";

export const metadata: Metadata = { title: "Warehouses" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function WarehousesPage({ params }: PageProps) {
  const { slug } = await params;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
          <p className="text-sm text-muted-foreground">
            Manage your storage locations.
          </p>
        </div>
        <Link
          href={`/${slug}/inventory`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Products
        </Link>
      </div>

      <WarehousePanel warehouses={warehouses} />
    </div>
  );
}
