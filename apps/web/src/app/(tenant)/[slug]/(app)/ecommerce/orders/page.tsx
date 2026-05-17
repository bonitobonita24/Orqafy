import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { formatCurrency } from "@/lib/quotation-build";

export const metadata: Metadata = { title: "Ecommerce orders" };

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
  delivered: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  cancelled: "text-muted-foreground bg-muted border-border",
  refunded: "text-rose-400 bg-rose-400/10 border-rose-400/30",
};

const DEFAULT_LIMIT = 50;

function isStatus(value: string | undefined): value is OrderStatus {
  return (
    typeof value === "string" && (STATUS_OPTIONS as readonly string[]).includes(value)
  );
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

function hrefFor(
  slug: string,
  params: { status?: OrderStatus | undefined; page?: number | undefined },
): string {
  const sp = new URLSearchParams();
  if (params.status !== undefined) sp.set("status", params.status);
  if (params.page !== undefined && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs.length > 0
    ? `/${slug}/ecommerce/orders?${qs}`
    : `/${slug}/ecommerce/orders`;
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function EcommerceOrdersPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { status: rawStatus, page: rawPage } = await searchParams;
  const status = isStatus(rawStatus) ? rawStatus : undefined;
  const parsedPage = typeof rawPage === "string" ? Number.parseInt(rawPage, 10) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const where = status !== undefined ? { status } : {};

  const [items, total] = await Promise.all([
    prisma.ecommerceOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * DEFAULT_LIMIT,
      take: DEFAULT_LIMIT,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
      },
    }),
    prisma.ecommerceOrder.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_LIMIT));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ecommerce orders</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} of {total} {total === 1 ? "order" : "orders"}
            {status ? ` filtered by "${STATUS_LABELS[status]}"` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefFor(slug, {})}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            status === undefined
              ? "border-[#00d992] bg-[#00d992]/10 text-[#00d992]"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </Link>
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s}
            href={hrefFor(slug, { status: s })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              status === s
                ? STATUS_COLORS[s]
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        {items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No orders{status ? ` with status "${STATUS_LABELS[status]}"` : ""} yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Order #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => {
                const statusKey = isStatus(order.status) ? order.status : "pending";
                return (
                  <tr
                    key={order.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/${slug}/ecommerce/orders/${order.id}`}
                        className="text-[#00d992] hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{customerLabel(order.customer)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${STATUS_COLORS[statusKey]}`}
                      >
                        {STATUS_LABELS[statusKey]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {order.paymentStatus}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(Number(order.totalAmount), order.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {order.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={hrefFor(slug, { status, page: page - 1 })}
                className="rounded-md border border-border bg-card px-3 py-1 hover:text-foreground"
              >
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={hrefFor(slug, { status, page: page + 1 })}
                className="rounded-md border border-border bg-card px-3 py-1 hover:text-foreground"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
