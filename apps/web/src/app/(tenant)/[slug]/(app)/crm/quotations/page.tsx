import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { formatCurrency } from "@/lib/quotation-build";

export const metadata: Metadata = { title: "Quotations" };

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
] as const;
type QuotationStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: "text-muted-foreground bg-muted border-border",
  sent: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  accepted: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  rejected: "text-red-400 bg-red-400/10 border-red-400/30",
  expired: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  converted: "text-purple-400 bg-purple-400/10 border-purple-400/30",
};

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Converted",
};

function isStatus(value: string | undefined): value is QuotationStatus {
  return typeof value === "string" && (STATUS_OPTIONS as readonly string[]).includes(value);
}

function customerLabel(customer: {
  companyName: string | null;
  firstName: string;
  lastName: string;
}): string {
  const company = customer.companyName?.trim();
  if (company !== undefined && company.length > 0) return company;
  return `${customer.firstName} ${customer.lastName}`;
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function QuotationsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { status: rawStatus } = await searchParams;
  const status = isStatus(rawStatus) ? rawStatus : undefined;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const where = {
    tenantId: tenant.id,
    ...(status !== undefined ? { status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
      },
    }),
    prisma.quotation.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} of {total} {total === 1 ? "quotation" : "quotations"}
            {status ? ` filtered by "${STATUS_LABELS[status]}"` : ""}
          </p>
        </div>
        <Link
          href={`/${slug}/crm/quotations/new`}
          className="inline-flex items-center gap-2 rounded-md bg-[#00d992] px-4 py-2 text-sm font-medium text-black hover:bg-[#00d992]/90"
        >
          New quotation
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${slug}/crm/quotations`}
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
            href={`/${slug}/crm/quotations?status=${s}`}
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
            No quotations{status ? ` with status "${STATUS_LABELS[status]}"` : ""} yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Quotation #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Valid until</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => {
                const statusKey = isStatus(q.status) ? q.status : "draft";
                const statusClass = STATUS_COLORS[statusKey];
                return (
                  <tr key={q.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/${slug}/crm/quotations/${q.id}`}
                        className="text-[#00d992] hover:underline"
                      >
                        {q.quotationNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{customerLabel(q.customer)}</td>
                    <td className="px-4 py-3">{q.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass}`}
                      >
                        {STATUS_LABELS[statusKey]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(Number(q.totalAmount), q.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {q.validUntil ? q.validUntil.toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {q.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
