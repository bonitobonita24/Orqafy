import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Goods Receipt" };
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

async function getGoodsReceipt(id: string) {
  return prisma.goodsReceipt.findUnique({
    where: { id },
    select: {
      id: true,
      grNumber: true,
      status: true,
      receivedAt: true,
      notes: true,
      createdAt: true,
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          vendor: { select: { id: true, companyName: true } },
        },
      },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
      items: {
        select: {
          id: true,
          description: true,
          quantityExpected: true,
          quantityReceived: true,
          quantityRejected: true,
          notes: true,
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });
}

export default async function GoodsReceiptDetailPage({
  params,
}: {
  params: Promise<{ slug: string; grId: string }>;
}) {
  const { slug, grId } = await params;
  const gr = await getGoodsReceipt(grId);

  if (gr === null) notFound();

  const totalExpected = gr.items.reduce((sum, i) => sum + Number(i.quantityExpected), 0);
  const totalReceived = gr.items.reduce((sum, i) => sum + Number(i.quantityReceived), 0);
  const totalRejected = gr.items.reduce((sum, i) => sum + Number(i.quantityRejected), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight">{gr.grNumber}</h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                GR_STATUS_BADGE[gr.status] ?? GR_STATUS_BADGE["pending"]
              }`}
            >
              {GR_STATUS_LABELS[gr.status] ?? gr.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded {gr.createdAt.toLocaleDateString()}
          </p>
        </div>
        <Link
          href={`/${slug}/purchasing/receipts`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Goods Receipts
        </Link>
      </div>

      {/* Info grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Purchase Order</p>
          <Link
            href={`/${slug}/purchasing/orders/${gr.purchaseOrder.id}`}
            className="font-mono text-sm font-medium text-primary hover:underline"
          >
            {gr.purchaseOrder.poNumber}
          </Link>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {gr.purchaseOrder.vendor.companyName}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Received By</p>
          <p className="text-sm font-medium">
            {gr.receivedBy.firstName} {gr.receivedBy.lastName}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {gr.receivedAt.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Totals</p>
          <p className="text-sm">
            <span className="font-medium">{totalReceived}</span>
            <span className="text-muted-foreground"> received</span>
          </p>
          {totalRejected > 0 && (
            <p className="text-sm">
              <span className="font-medium text-red-400">{totalRejected}</span>
              <span className="text-muted-foreground"> rejected</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">of {totalExpected} expected</p>
        </div>
      </div>

      {gr.notes !== null && (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {gr.notes}
        </div>
      )}

      {/* Line items */}
      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium text-right">Expected</th>
              <th className="px-4 py-3 font-medium text-right">Received</th>
              <th className="px-4 py-3 font-medium text-right">Rejected</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {gr.items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{item.description}</p>
                  {item.product !== null && (
                    <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {Number(item.quantityExpected).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {Number(item.quantityReceived).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {Number(item.quantityRejected) > 0 ? (
                    <span className="font-medium text-red-400">
                      {Number(item.quantityRejected).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.notes !== null ? item.notes : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* HOLD(owner-rule): GR actions (cancel, amend, link to invoice) need owner rules on
          when receipts can be edited/cancelled after recording. */}
    </div>
  );
}
