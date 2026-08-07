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
import { PayrollActions } from "./payroll-actions";

export const metadata: Metadata = { title: "Payroll Run" };
export const dynamic = "force-dynamic";

function userDisplayName(
  u: { displayName: string | null; firstName: string; lastName: string } | null,
): string {
  if (u === null) return "—";
  return u.displayName ?? `${u.firstName} ${u.lastName}`.trim();
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

function formatMoney(value: unknown, currency: string): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getPayroll(id: string, tenantId: string) {
  return prisma.payroll.findFirst({
    where: { id, tenantId },
    include: {
      payslips: {
        include: {
          employee: {
            include: {
              user: {
                select: { firstName: true, lastName: true, displayName: true },
              },
            },
          },
        },
      },
    },
  });
}

export default async function PayrollDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (tenant === null) notFound();
  const payroll = await getPayroll(id, tenant.id);
  if (payroll === null) notFound();

  const statusClass = STATUS_BADGE[payroll.status] ?? STATUS_BADGE["draft"]!;
  const statusLabel = STATUS_LABELS[payroll.status] ?? payroll.status;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/payroll`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to Payroll
        </Link>
      </div>

      <PageHeader
        title="Payroll Run"
        description={
          <span className="font-mono text-xs">{payroll.payrollNumber}</span>
        }
        actions={
          <>
            {payroll.status === "draft" && (
              <Button asChild>
                <Link href={`/${slug}/payroll/${id}/payslips/new`}>+ Add Payslip</Link>
              </Button>
            )}
            <PayrollActions payrollId={id} status={payroll.status} />
            <Badge variant="outline" className={`rounded-full ${statusClass}`}>
              {statusLabel}
            </Badge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Period Start
            </div>
            <div className="mt-1 text-sm">
              {payroll.periodStart.toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Period End
            </div>
            <div className="mt-1 text-sm">
              {payroll.periodEnd.toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Processed
            </div>
            <div className="mt-1 text-sm">
              {payroll.processedAt !== null ? payroll.processedAt.toLocaleString() : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Paid
            </div>
            <div className="mt-1 text-sm">
              {payroll.paidAt !== null ? payroll.paidAt.toLocaleString() : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Gross
            </div>
            <div className="mt-2 font-mono text-lg font-semibold">
              {formatMoney(payroll.totalGross, payroll.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Deductions
            </div>
            <div className="mt-2 font-mono text-lg font-semibold text-red-400">
              {formatMoney(payroll.totalDeductions, payroll.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Net
            </div>
            <div className="mt-2 font-mono text-lg font-semibold text-primary">
              {formatMoney(payroll.totalNet, payroll.currency)}
            </div>
          </CardContent>
        </Card>
      </div>

      {payroll.notes !== null && (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              Notes
            </h2>
            <p className="whitespace-pre-wrap text-sm">{payroll.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">
            Payslips
            <span className="ml-2 text-muted-foreground">
              ({payroll.payslips.length})
            </span>
          </h2>
        </div>
        <CardContent className="p-0">
          {payroll.payslips.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No payslips generated yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Basic Pay</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead className="text-right">Allowances</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">SSS</TableHead>
                  <TableHead className="text-right">PhilHealth</TableHead>
                  <TableHead className="text-right">Pag-IBIG</TableHead>
                  <TableHead className="text-right">W/Tax</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payroll.payslips.map((ps) => (
                  <TableRow key={ps.id}>
                    <TableCell>
                      <div className="font-medium">
                        {userDisplayName(ps.employee.user)}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {ps.employee.employeeNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(ps.basicPay, payroll.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(ps.overtimePay, payroll.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(ps.allowances, payroll.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(ps.grossPay, payroll.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatMoney(ps.sssDeduction, payroll.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatMoney(ps.philhealthDeduction, payroll.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatMoney(ps.pagibigDeduction, payroll.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatMoney(ps.taxDeduction, payroll.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-red-400">
                      {formatMoney(ps.totalDeductions, payroll.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-primary">
                      {formatMoney(ps.netPay, payroll.currency)}
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
