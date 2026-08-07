import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PoForm } from "./po-form";

export const metadata: Metadata = { title: "New Purchase Order" };
export const dynamic = "force-dynamic";

async function getActiveVendors(tenantId: string) {
  return prisma.vendor.findMany({
    // tenant-scoped: prevents cross-tenant data leak
    where: { tenantId, isActive: true },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });
}

export default async function NewPoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return <div>Tenant not found</div>;
  const vendors = await getActiveVendors(tenant.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/purchasing`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Purchase Orders
        </Link>
      </div>
      <PageHeader
        title="New Purchase Order"
        description="Create a draft PO with line items. The PO will be saved as a draft until submitted."
      />
      {vendors.length === 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          No active vendors found.{" "}
          <Link href={`/${slug}/purchasing/vendors/new`} className="underline">
            Add a vendor first.
          </Link>
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <PoForm slug={slug} vendors={vendors} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
