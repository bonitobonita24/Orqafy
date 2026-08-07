import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { PurchaseOrderAttachments } from "./po-attachments";
import { PoActions } from "./po-actions";

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
      tenantId: true,
      orderedAt: true,
      expectedDelivery: true,
      subtotal: true,
      taxAmount: true,
      totalAmount: true,
      isVatExempt: true,
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
  const { id, slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();
  const order = await getPurchaseOrder(id);

  // tenant-scoped: prevents cross-tenant data leak
  if (order === null || order.tenantId !== tenant.id) {
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

  const statusClass = STATUS_BADGE[order.status] ?? STATUS_BADGE["draft"]!;
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;

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
        title={order.poNumber}
        titleClassName="font-mono text-2xl"
        description={
          <>
            <Badge variant="outline" className={`rounded-full ${statusClass}`}>
              {statusLabel}
            </Badge>{" "}
            Created {order.createdAt.toLocaleDateString()}
          </>
        }
        actions={
          <>
            {order.status === "draft" && (
              <Button asChild>
                <Link href={`/${slug}/purchasing/orders/${id}/edit`}>Edit Draft</Link>
              </Button>
            )}
            <PoActions slug={slug} poId={order.id} status={order.status} />
            <Button variant="outline" asChild>
              <Link href={`/${slug}/purchasing`}>← Purchase Orders</Link>
            </Button>
          </>
        }
      />

      {/* PO Info Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Vendor */}
        <Card>
          <CardContent className="p-4">
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
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card>
          <CardContent className="p-4">
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
              {order.subtotal !== null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium">
                    ₱{Number(order.subtotal).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  VAT (12%)
                  {order.isVatExempt && (
                    <Badge
                      variant="outline"
                      className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-400"
                    >
                      VAT-exempt
                    </Badge>
                  )}
                </dt>
                <dd className="font-medium">
                  {order.taxAmount !== null
                    ? `₱${Number(order.taxAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                    : "₱0.00"}
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
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {order.notes !== null && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Notes
            </h2>
            <p className="text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Line Items</h2>
        <Card>
          <CardContent className="p-0">
            {order.items.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No line items on this order.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item / Description</TableHead>
                    <TableHead className="text-right">Qty Ordered</TableHead>
                    <TableHead className="text-right">Qty Received</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    const received = Number(item.quantityReceived);
                    const ordered = Number(item.quantity);
                    const fullyReceived = received >= ordered;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
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
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {ordered}
                        </TableCell>
                        <TableCell className="text-right">
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
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.unitPrice !== null
                            ? `₱${Number(item.unitPrice).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.totalPrice !== null
                            ? `₱${Number(item.totalPrice).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                {order.totalAmount !== null && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="text-right text-sm font-medium">
                        Total
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-primary">
                        ₱
                        {Number(order.totalAmount).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goods Receipts */}
      {order.goodsReceipts.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold">
            Goods Receipts ({order.goodsReceipts.length})
          </h2>
          <div className="space-y-3">
            {order.goodsReceipts.map((gr) => (
              <Card key={gr.id}>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gr.items.map((grItem) => (
                        <TableRow key={grItem.id}>
                          <TableCell className="text-muted-foreground">
                            {grItem.product !== null
                              ? grItem.product.name
                              : grItem.description}
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {Number(grItem.quantityReceived)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {gr.notes !== null && (
                  <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    {gr.notes}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      <Card>
        <CardContent className="p-6">
          <PurchaseOrderAttachments purchaseOrderId={order.id} />
        </CardContent>
      </Card>
    </div>
  );
}
