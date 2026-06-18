import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { formatCurrency } from "@/lib/quotation-build";
import { OrderStatusActions } from "./order-status-actions";
import { FulfillmentForm } from "./fulfillment-form";
import { PayWithXendit } from "./pay-with-xendit";

export const metadata: Metadata = { title: "Order detail" };

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
type OrderStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  confirmed: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  processing: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  shipped: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  delivered: "text-primary bg-primary/10 border-primary/30",
  cancelled: "text-muted-foreground bg-muted border-border",
  refunded: "text-rose-400 bg-rose-400/10 border-rose-400/30",
};

function isStatus(value: string): value is OrderStatus {
  return (STATUS_OPTIONS as readonly string[]).includes(value);
}

function customerLabel(
  customer: {
    companyName: string | null;
    firstName: string;
    lastName: string;
  } | null,
): string {
  if (customer === null) return "—";
  const company = customer.companyName?.trim();
  if (company !== undefined && company.length > 0) return company;
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function addressLines(address: unknown): string[] {
  if (address === null || typeof address !== "object") return [];
  const a = address as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof a.line1 === "string" && a.line1.length > 0) parts.push(a.line1);
  if (typeof a.line2 === "string" && a.line2.length > 0) parts.push(a.line2);
  const cityRegion = [a.city, a.province, a.postalCode]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(", ");
  if (cityRegion.length > 0) parts.push(cityRegion);
  if (typeof a.country === "string" && a.country.length > 0) parts.push(a.country);
  return parts;
}

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EcommerceOrderDetailPage({ params }: PageProps) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const order = await prisma.ecommerceOrder.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
          phone: true,
        },
      },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });

  // tenant-scoped: prevents cross-tenant data leak
  if (order === null || order.tenantId !== tenant.id) {
    notFound();
  }

  const statusKey: OrderStatus = isStatus(order.status) ? order.status : "pending";
  const currency = order.currency;
  const shipping = addressLines(order.shippingAddress);
  const billing = addressLines(order.billingAddress);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/${slug}/ecommerce/orders`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to orders
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight">
            {order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customerLabel(order.customer)} · created {order.createdAt.toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${STATUS_COLORS[statusKey]}`}
          >
            {STATUS_LABELS[statusKey]}
          </span>
          <OrderStatusActions orderId={order.id} status={order.status} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Customer
          </h2>
          <p className="mt-2 text-sm font-medium">{customerLabel(order.customer)}</p>
          {order.customer.email !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">{order.customer.email}</p>
          ) : null}
          {order.customer.phone !== null ? (
            <p className="text-xs text-muted-foreground">{order.customer.phone}</p>
          ) : null}
          <Link
            href={`/${slug}/crm/customers/${order.customer.id}`}
            className="mt-3 inline-block text-xs text-primary hover:underline"
          >
            View customer →
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Shipping address
          </h2>
          {shipping.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="mt-2 space-y-0.5 text-sm">
              {shipping.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {order.trackingNumber !== null ? (
            <p className="mt-3 text-xs">
              <span className="text-muted-foreground">Tracking:</span>{" "}
              <span className="font-mono">{order.trackingNumber}</span>
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payment
          </h2>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Status:</span> {order.paymentStatus}
          </p>
          {order.paymentMethod !== null ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Method:</span> {order.paymentMethod}
            </p>
          ) : null}
          <PayWithXendit
            orderId={order.id}
            paymentStatus={order.paymentStatus}
            xenditPaymentId={order.xenditPaymentId}
          />
          {billing.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">Billing address</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {billing.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <FulfillmentForm
        orderId={order.id}
        initialTrackingNumber={order.trackingNumber}
        initialPaymentMethod={order.paymentMethod}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">Line items</h2>
        </div>
        {order.items.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No items on this order.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 text-right font-medium">Qty</th>
                <th className="px-4 py-3 text-right font-medium">Unit price</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {item.product.sku ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {Number(item.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(item.unitPrice), currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(item.totalPrice), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="ml-auto w-full max-w-sm space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">
            {formatCurrency(Number(order.subtotal), currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax</span>
          <span className="font-mono">
            {formatCurrency(Number(order.taxAmount), currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shipping</span>
          <span className="font-mono">
            {formatCurrency(Number(order.shippingAmount), currency)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Discount</span>
          <span className="font-mono">
            −{formatCurrency(Number(order.discountAmount), currency)}
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="font-mono">
            {formatCurrency(Number(order.totalAmount), currency)}
          </span>
        </div>
      </div>

      {order.notes !== null ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{order.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
