import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Goods Receipts" };
export const dynamic = "force-dynamic";

const GR_STATUS_BADGE: Record<string, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  partial: "border-primary/30 bg-primary/10 text-primary",
  complete: "border-primary/30 bg-primary/10 text-primary",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-400",
};

const GR_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partial: "Partial",
  complete: "Complete",
  cancelled: "Cancelled",
};

async function getGoodsReceipts(tenantId: string) {
  return prisma.goodsReceipt.findMany({
    // tenant-scoped: prevents cross-tenant data leak
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      grNumber: true,
      status: true,
      receivedAt: true,
      notes: true,
      purchaseOrder: {
        select: { id: true, poNumber: true, vendor: { select: { companyName: true } } },
      },
      _count: { select: { items: true } },
    },
  });
}

export default async function GoodsReceiptsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return <div>Tenant not found</div>;
  const receipts = await getGoodsReceipts(tenant.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goods Receipts</h1>
          <p className="text-sm text-muted-foreground">
            {receipts.length} receipt{receipts.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/purchasing`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            ← Purchase Orders
          </Link>
          <Link
            href={`/${slug}/purchasing/receipts/new`}
            className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            + Record Receipt
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {receipts.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No goods receipts recorded.{" "}
            <Link href={`/${slug}/purchasing/receipts/new`} className="text-primary hover:underline">
              Record your first receipt.
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">GR Number</th>
                <th className="px-4 py-3 font-medium">Purchase Order</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Received At</th>
                <th className="px-4 py-3 font-medium">Items</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((gr) => (
                <tr
                  key={gr.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/purchasing/receipts/${gr.id}`}
                      className="font-mono text-xs font-medium text-primary hover:underline"
                    >
                      {gr.grNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <Link
                      href={`/${slug}/purchasing/orders/${gr.purchaseOrder.id}`}
                      className="font-mono text-xs hover:text-foreground hover:underline"
                    >
                      {gr.purchaseOrder.poNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {gr.purchaseOrder.vendor.companyName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        GR_STATUS_BADGE[gr.status] ?? GR_STATUS_BADGE["pending"]
                      }`}
                    >
                      {GR_STATUS_LABELS[gr.status] ?? gr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {gr.receivedAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{gr._count.items}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
