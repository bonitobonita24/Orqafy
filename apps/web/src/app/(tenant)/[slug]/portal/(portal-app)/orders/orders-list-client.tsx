"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Package } from "@/components/ui/icons";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/quotation-build";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Mirrors the "pending/confirmed/processing/shipped/delivered/cancelled/
// refunded" EcommerceOrder.status values used by the staff ecommerce/orders
// list (see (app)/ecommerce/orders/page.tsx) — kept as a loose label lookup
// here since the customer never needs the filter chips, only readable text.
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function OrdersTableSkeleton(): React.ReactNode {
  return (
    <div className="space-y-2 p-6">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function OrdersListClient(): React.ReactNode {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.portal.orders.list.useQuery();

  return (
    <div data-fdl="portal-orders-list" className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your order history.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <OrdersTableSkeleton />
          ) : data === undefined || data.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Package} title="No orders yet" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/${slug}/portal/orders/${order.id}`}
                        className="text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Number(order.totalAmount), order.currency)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
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
