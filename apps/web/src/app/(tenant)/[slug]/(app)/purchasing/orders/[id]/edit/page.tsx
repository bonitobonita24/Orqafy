import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PoForm } from "../../new/po-form";

export const metadata: Metadata = { title: "Edit Purchase Order" };
export const dynamic = "force-dynamic";

async function getPoForEdit(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    select: {
      id: true,
      poNumber: true,
      status: true,
      tenantId: true,
      vendorId: true,
      currency: true,
      notes: true,
      expectedDelivery: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          description: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });
}

async function getActiveVendors(tenantId: string) {
  return prisma.vendor.findMany({
    // tenant-scoped: prevents cross-tenant data leak
    where: { tenantId, isActive: true },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });
}

export default async function EditPoPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();
  const [po, vendors] = await Promise.all([getPoForEdit(id), getActiveVendors(tenant.id)]);

  // tenant-scoped: prevents cross-tenant data leak
  if (po === null || po.tenantId !== tenant.id) notFound();

  // Only draft POs are editable — hold all other transitions for owner approval rules
  if (po.status !== "draft") {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href={`/${slug}/purchasing/orders/${id}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← {po.poNumber}
          </Link>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          {/* HOLD(owner-rule): editing submitted/approved POs — owner must decide if/when
              non-draft POs can be edited (amendment workflow, versioning, cancel + reissue). */}
          This purchase order is in <strong>{po.status}</strong> status and cannot be edited directly.
          Contact your administrator for amendments.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/purchasing/orders/${id}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← {po.poNumber}
        </Link>
      </div>
      <PageHeader
        title="Edit Purchase Order"
        description={`${po.poNumber} — Draft`}
      />
      <Card>
        <CardContent className="p-6">
          <PoForm
            slug={slug}
            vendors={vendors}
            poId={id}
            initial={{
              vendorId: po.vendorId,
              currency: po.currency,
              notes: po.notes ?? undefined,
              expectedDelivery: po.expectedDelivery
                ? po.expectedDelivery.toISOString().slice(0, 10)
                : undefined,
              items: po.items.map((item) => ({
                description: item.description,
                quantity: String(Number(item.quantity)),
                unitPrice: String(Number(item.unitPrice)),
                allocationType: "company_expense" as const,
                warehouseId: "",
                projectId: "",
              })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
