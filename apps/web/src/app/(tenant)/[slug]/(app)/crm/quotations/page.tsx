import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { formatCurrency } from "@/lib/quotation-build";
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
  accepted: "text-primary bg-primary/10 border-primary/30",
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
      <PageHeader
        title="Quotations"
        description={`${items.length} of ${total} ${total === 1 ? "quotation" : "quotations"}${
          status ? ` filtered by "${STATUS_LABELS[status]}"` : ""
        }`}
        actions={
          <Button asChild>
            <Link href={`/${slug}/crm/quotations/new`}>New quotation</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${slug}/crm/quotations`}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            status === undefined
              ? "border-primary bg-primary/10 text-primary"
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

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title={`No quotations${status ? ` with status "${STATUS_LABELS[status]}"` : ""} yet.`}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((q) => {
                  const statusKey = isStatus(q.status) ? q.status : "draft";
                  const statusClass = STATUS_COLORS[statusKey];
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/${slug}/crm/quotations/${q.id}`}
                          className="text-primary hover:underline"
                        >
                          {q.quotationNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{customerLabel(q.customer)}</TableCell>
                      <TableCell>{q.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-full ${statusClass}`}>
                          {STATUS_LABELS[statusKey]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(Number(q.totalAmount), q.currency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {q.validUntil ? q.validUntil.toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {q.createdAt.toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
