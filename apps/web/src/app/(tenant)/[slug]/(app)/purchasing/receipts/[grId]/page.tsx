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
} from "@/components/ui/table";
import { GoodsReceiptAttachments } from "./gr-attachments";

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
      tenantId: true,
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
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();
  const gr = await getGoodsReceipt(grId);

  // tenant-scoped: prevents cross-tenant data leak
  if (gr === null || gr.tenantId !== tenant.id) notFound();

  const totalExpected = gr.items.reduce((sum, i) => sum + Number(i.quantityExpected), 0);
  const totalReceived = gr.items.reduce((sum, i) => sum + Number(i.quantityReceived), 0);
  const totalRejected = gr.items.reduce((sum, i) => sum + Number(i.quantityRejected), 0);

  const statusClass = GR_STATUS_BADGE[gr.status] ?? GR_STATUS_BADGE["pending"]!;
  const statusLabel = GR_STATUS_LABELS[gr.status] ?? gr.status;

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
        title={gr.grNumber}
        titleClassName="font-mono text-2xl"
        description={
          <>
            <Badge variant="outline" className={`rounded-full ${statusClass}`}>
              {statusLabel}
            </Badge>{" "}
            Recorded {gr.createdAt.toLocaleDateString()}
          </>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/purchasing/receipts`}>← Goods Receipts</Link>
          </Button>
        }
      />

      {/* Info grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Received By</p>
            <p className="text-sm font-medium">
              {gr.receivedBy.firstName} {gr.receivedBy.lastName}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {gr.receivedAt.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
      </div>

      {gr.notes !== null && (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {gr.notes}
        </div>
      )}

      {/* Line items */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gr.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.description}</p>
                    {item.product !== null && (
                      <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {Number(item.quantityExpected).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(item.quantityReceived).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(item.quantityRejected) > 0 ? (
                      <span className="font-medium text-red-400">
                        {Number(item.quantityRejected).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.notes !== null ? item.notes : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardContent className="p-6">
          <GoodsReceiptAttachments goodsReceiptId={gr.id} />
        </CardContent>
      </Card>

      {/* HOLD(owner-rule): GR actions (cancel, amend, link to invoice) need owner rules on
          when receipts can be edited/cancelled after recording. */}
    </div>
  );
}
