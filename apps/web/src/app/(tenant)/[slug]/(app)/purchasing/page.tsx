import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "@/components/ui/icons";
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

export const metadata: Metadata = { title: "Purchase Orders" };
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

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "ordered", label: "Ordered" },
  { key: "partially_received", label: "Partial" },
  { key: "received", label: "Received" },
  { key: "cancelled", label: "Cancelled" },
];

async function getPurchaseOrders(tenantId: string, status: string | undefined) {
  const statusFilter = status !== undefined && status !== "all" ? { status } : {};
  return prisma.purchaseOrder.findMany({
    // tenant-scoped: prevents cross-tenant data leak
    where: { tenantId, ...statusFilter },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      poNumber: true,
      status: true,
      orderedAt: true,
      expectedDelivery: true,
      totalAmount: true,
      vendor: { select: { id: true, companyName: true } },
      _count: { select: { items: true } },
    },
  });
}

export default async function PurchaseOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const activeStatus = sp.status ?? "all";

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return <div>Tenant not found</div>;

  const orders = await getPurchaseOrders(tenant.id, activeStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description={`${orders.length} order${orders.length === 1 ? "" : "s"}${
          activeStatus !== "all" ? ` — ${STATUS_LABELS[activeStatus] ?? activeStatus}` : ""
        }`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/purchasing/vendors`}>Vendors →</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/purchasing/receipts`}>Goods Receipts →</Link>
            </Button>
            <Button asChild>
              <Link href={`/${slug}/purchasing/orders/new`}>+ New PO</Link>
            </Button>
          </>
        }
      />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?status=${tab.key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              activeStatus === tab.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ClipboardList}
                title="No purchase orders found."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Expected Delivery</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/${slug}/purchasing/orders/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.poNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.vendor.companyName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${
                          STATUS_BADGE[order.status] ?? STATUS_BADGE["draft"]
                        }`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.orderedAt !== null
                        ? order.orderedAt.toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order.expectedDelivery !== null
                        ? order.expectedDelivery.toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.totalAmount !== null
                        ? `₱${Number(order.totalAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {order._count.items}
                    </TableCell>
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
