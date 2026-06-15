import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Purchase Order" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  ordered: "Ordered",
  partially_received: "Partially Received",
  received: "Received",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  pending_approval: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  ordered: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  partially_received: "border-primary/30 bg-primary/10 text-primary",
  received: "border-primary/30 bg-primary/10 text-primary",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-400",
};

async function getPurchaseOrder(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    select: {
      id: true,
      poNumber: true,
      status: true,
      orderedAt: true,
      expectedDelivery: true,
      totalAmount: true,
      notes: true,
      createdAt: true,
      vendor: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
          phone: true,
        },
      },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          quantityReceived: true,
          unitPrice: true,
          totalPrice: true,
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      goodsReceipts: {
        select: {
          id: true,
          grNumber: true,
          receivedAt: true,
          notes: true,
          status: true,
          items: {
            select: {
              id: true,
              description: true,
              quantityReceived: true,
              quantityRejected: true,
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { receivedAt: "desc" },
      },
    },
  });
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id } = await params;
  const order = await getPurchaseOrder(id);

  if (order === null) {
    notFound();
  }

  const totalOrdered = order.items.reduce(
    (sum: number, item) => sum + Number(item.quantity),
    0,
  );
  const totalReceived = order.items.reduce(
    (sum: number, item) => sum + Number(item.quantityReceived),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight">
              {order.poNumber}
            </h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                STATUS_BADGE[order.status] ?? STATUS_BADGE["draft"]
              }`}
            >
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {order.createdAt.toLocaleDateString()}
          </p>
        </div>
        <Link
          href="../"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Purchase Orders
        </Link>
      </div>

      {/* PO Info Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Vendor */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Vendor
          </h2>
          <div className="space-y-1">
            <p className="font-medium">{order.vendor.companyName}</p>
            {order.vendor.contactName !== null && (
              <p className="text-sm text-muted-foreground">
                {order.vendor.contactName}
              </p>
            )}
            {order.vendor.email !== null && (
              <a
                href={`mailto:${order.vendor.email}`}
                className="block text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                {order.vendor.email}
              </a>
            )}
            {order.vendor.phone !== null && (
              <p className="text-sm text-muted-foreground">
                {order.vendor.phone}
              </p>
            )}
          </div>
        </div>

        {/* Order Details */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Order Details
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ordered At</dt>
              <dd className="font-medium">
                {order.orderedAt !== null
                  ? order.orderedAt.toLocaleDateString()
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Expected Delivery</dt>
              <dd className="font-medium">
                {order.expectedDelivery !== null
                  ? order.expectedDelivery.toLocaleDateString()
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total Amount</dt>
              <dd className="font-medium text-primary">
                {order.totalAmount !== null
                  ? `₱${Number(order.totalAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Items</dt>
              <dd className="font-medium">
                {order.items.length} line{order.items.length === 1 ? "" : "s"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Qty Received</dt>
              <dd className="font-medium">
                {totalReceived} / {totalOrdered}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Notes */}
      {order.notes !== null && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Notes
          </h2>
          <p className="text-sm">{order.notes}</p>
        </div>
      )}

      {/* Line Items */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Line Items</h2>
        <div className="rounded-lg border border-border bg-card">
          {order.items.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No line items on this order.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Item / Description</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Qty Ordered
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Qty Received
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => {
                  const received = Number(item.quantityReceived);
                  const ordered = Number(item.quantity);
                  const fullyReceived = received >= ordered;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        {item.product !== null ? (
                          <div>
                            <div className="font-medium">
                              {item.product.name}
                            </div>
                            {item.product.sku !== null && (
                              <div className="text-xs text-muted-foreground">
                                SKU: {item.product.sku}
                              </div>
                            )}
                            {item.description !== null && (
                              <div className="text-xs text-muted-foreground">
                                {item.description}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {item.description !== null
                              ? item.description
                              : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {ordered}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            fullyReceived
                              ? "text-primary"
                              : received > 0
                                ? "text-amber-400"
                                : "text-muted-foreground"
                          }
                        >
                          {received}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {item.unitPrice !== null
                          ? `₱${Number(item.unitPrice).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.totalPrice !== null
                          ? `₱${Number(item.totalPrice).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {order.totalAmount !== null && (
                <tfoot>
                  <tr className="border-t border-border">
                    <td
                      colSpan={4}
                      className="px-4 py-3 text-right text-sm font-medium"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-primary">
                      ₱
                      {Number(order.totalAmount).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {/* Goods Receipts */}
      {order.goodsReceipts.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold">
            Goods Receipts ({order.goodsReceipts.length})
          </h2>
          <div className="space-y-3">
            {order.goodsReceipts.map((gr) => (
              <div
                key={gr.id}
                className="rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium text-primary">
                      {gr.grNumber}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Received {gr.receivedAt.toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {gr.items.length} item{gr.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                {gr.items.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Item</th>
                        <th className="px-4 py-2 font-medium text-right">
                          Qty Received
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {gr.items.map((grItem) => (
                        <tr
                          key={grItem.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-4 py-2 text-muted-foreground">
                            {grItem.product !== null
                              ? grItem.product.name
                              : grItem.description}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-primary">
                            {Number(grItem.quantityReceived)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {gr.notes !== null && (
                  <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    {gr.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
