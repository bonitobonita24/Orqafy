import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";
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

export const metadata: Metadata = { title: "Payroll" };
export const dynamic = "force-dynamic";

async function getTenantId(slug: string) {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  processing: "Processing",
  approved: "Approved",
  paid: "Paid",
  void: "Void",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  processing: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  paid: "border-primary/30 bg-primary/10 text-primary",
  void: "border-red-500/30 bg-red-500/10 text-red-400",
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "processing", label: "Processing" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
];

function formatMoney(value: unknown, currency: string): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPeriod(start: Date, end: Date): string {
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
}

async function getPayrolls(tenantId: string, status: string) {
  const where = status !== "all" ? { tenantId, status } : { tenantId };
  return prisma.payroll.findMany({
    where,
    orderBy: { periodStart: "desc" },
    include: { _count: { select: { payslips: true } } },
  });
}

export default async function PayrollPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await routeParams;
  const sp = await searchParams;
  const activeStatus = sp.status ?? "all";
  const tenantId = await getTenantId(slug);
  if (tenantId === null) notFound();
  const payrolls = await getPayrolls(tenantId, activeStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description={`${payrolls.length} payroll run${payrolls.length === 1 ? "" : "s"}${
          activeStatus !== "all" ? ` — ${STATUS_LABELS[activeStatus] ?? activeStatus}` : ""
        }`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/payroll/statutory-rates`}>Statutory Rates</Link>
            </Button>
            <Button asChild>
              <Link href={`/${slug}/payroll/new`}>+ New Payroll Run</Link>
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
          {payrolls.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Wallet} title="No payroll runs found." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payroll #</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payslips</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`payroll/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.payrollNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatPeriod(p.periodStart, p.periodEnd)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${
                          STATUS_BADGE[p.status] ?? STATUS_BADGE["draft"]
                        }`}
                      >
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p._count.payslips}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(p.totalGross, p.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatMoney(p.totalDeductions, p.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatMoney(p.totalNet, p.currency)}
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
