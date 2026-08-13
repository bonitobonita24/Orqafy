import type { Metadata } from "next";
import Link from "next/link";
import { PackageCheck } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <PageHeader
        title="Goods Receipts"
        description={`${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/purchasing`}>← Purchase Orders</Link>
            </Button>
            <Button asChild>
              <Link href={`/${slug}/purchasing/receipts/new`}>+ Record Receipt</Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {receipts.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={PackageCheck}
                title="No goods receipts recorded."
                action={
                  <Button asChild>
                    <Link href={`/${slug}/purchasing/receipts/new`}>Record your first receipt</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GR Number</TableHead>
                  <TableHead>Purchase Order</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received At</TableHead>
                  <TableHead>Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((gr) => (
                  <TableRow key={gr.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/${slug}/purchasing/receipts/${gr.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {gr.grNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link
                        href={`/${slug}/purchasing/orders/${gr.purchaseOrder.id}`}
                        className="font-mono text-xs hover:text-foreground hover:underline"
                      >
                        {gr.purchaseOrder.poNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {gr.purchaseOrder.vendor.companyName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${
                          GR_STATUS_BADGE[gr.status] ?? GR_STATUS_BADGE["pending"]
                        }`}
                      >
                        {GR_STATUS_LABELS[gr.status] ?? gr.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {gr.receivedAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{gr._count.items}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
