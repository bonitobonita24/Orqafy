import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { GrForm } from "./gr-form";

export const metadata: Metadata = { title: "Record Goods Receipt" };
export const dynamic = "force-dynamic";

/**
 * Only POs in a receivable state can have a GR created against them.
 * HOLD(owner-rule): which statuses are "receivable" is currently set to
 * approved|ordered|partially_received — owner must confirm this matches
 * their intended approval flow.
 */
const RECEIVABLE_STATUSES = ["approved", "ordered", "partially_received"];

async function getReceivablePos(tenantId: string) {
  return prisma.purchaseOrder.findMany({
    // tenant-scoped: prevents cross-tenant data leak
    where: { tenantId, status: { in: RECEIVABLE_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      poNumber: true,
      vendor: { select: { companyName: true } },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          quantityReceived: true,
          product: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export default async function NewGrPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return <div>Tenant not found</div>;
  // Serialize Prisma Decimal → string so the data is safe to pass into the
  // client GrForm (Decimal is not a serializable RSC boundary value).
  const receivablePos = (await getReceivablePos(tenant.id)).map((po) => ({
    ...po,
    items: po.items.map((item) => ({
      ...item,
      quantity: item.quantity.toString(),
      quantityReceived: item.quantityReceived.toString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/purchasing/receipts`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Goods Receipts
        </Link>
      </div>
      <PageHeader
        title="Record Goods Receipt"
        description="Record items received against an approved Purchase Order."
      />
      {receivablePos.length === 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          No purchase orders are currently in a receivable state (approved / ordered / partially received).
          {/* HOLD(owner-rule): approval workflow — POs need to be approved before receipt can be recorded. */}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <GrForm slug={slug} receivablePos={receivablePos} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
