"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/quotation-build";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronLeft, Package, PackageCheck, PackageSearch } from "@/components/ui/icons";

// Presentation mirrors the storefront guest order-track card
// (store/orders/track/page.tsx) — same header layout (Package icon, order #,
// status/payment badges, tracking number row, total footer) — extended here
// with a line-items breakdown + subtotal/tax/shipping/discount totals since
// this is an authed detail view, not a lookup-result summary.

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

interface OrderDetailClientProps {
  orderId: string;
}

export function OrderDetailClient({ orderId }: OrderDetailClientProps): React.ReactNode {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = trpc.portal.orders.byId.useQuery(
    { id: orderId },
    { retry: false },
  );

  const backLink = (
    <Link
      href={`/${slug}/portal/orders`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" />
      Back to orders
    </Link>
  );

  if (isLoading) {
    return (
      <div data-fdl="portal-order-detail" className="space-y-6">
        {backLink}
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error !== null || data === undefined) {
    return (
      <div data-fdl="portal-order-detail" className="space-y-6">
        {backLink}
        <Card>
          <CardContent className="pt-6">
            <EmptyState icon={PackageSearch} title="Order not found" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-fdl="portal-order-detail" className="space-y-6">
      {backLink}

      <Card className="gap-6">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <Package className="size-8 shrink-0 text-muted-foreground" />
          <div className="grow">
            <CardTitle className="text-base">
              Order <span className="font-bold">{data.orderNumber}</span>
            </CardTitle>
            <CardDescription>Order status &amp; payment details</CardDescription>
          </div>
          <PackageCheck className="size-5 shrink-0 text-muted-foreground" />
        </CardHeader>

        <CardContent className="space-y-3 border-t pt-6 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="secondary">{STATUS_LABELS[data.status] ?? data.status}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment</span>
            <Badge variant="secondary">
              {PAYMENT_STATUS_LABELS[data.paymentStatus] ?? data.paymentStatus}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tracking</span>
            <span className="font-medium">
              {data.trackingNumber !== null && data.trackingNumber !== ""
                ? data.trackingNumber
                : "Not yet shipped"}
            </span>
          </div>
        </CardContent>

        {data.items.length > 0 && (
          <CardContent className="space-y-3 border-t pt-6">
            <p className="text-sm font-medium">Items</p>
            <div className="space-y-2">
              {data.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.product?.name ?? item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number(item.quantity)} × {formatCurrency(Number(item.unitPrice), data.currency)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono">
                    {formatCurrency(Number(item.totalPrice), data.currency)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        )}

        <CardContent className="space-y-1.5 border-t pt-6 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(Number(data.subtotal), data.currency)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Tax</span>
            <span>{formatCurrency(Number(data.taxAmount), data.currency)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>{formatCurrency(Number(data.shippingAmount), data.currency)}</span>
          </div>
          {Number(data.discountAmount) > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Discount</span>
              <span>-{formatCurrency(Number(data.discountAmount), data.currency)}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t pt-6">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">
            {formatCurrency(Number(data.totalAmount), data.currency)}
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
