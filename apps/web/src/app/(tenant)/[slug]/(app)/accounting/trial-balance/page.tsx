import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Trial Balance" };
export const dynamic = "force-dynamic";

async function getTrialBalance(slug: string, fiscalYearId?: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return null;

  const lines = await prisma.journalLine.findMany({
    where: {
      tenantId: tenant.id,
      journalEntry: {
        status: "posted",
        tenantId: tenant.id,
        ...(fiscalYearId !== undefined ? { fiscalYearId } : {}),
      },
    },
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
  });

  const byAccount = new Map<string, { account: { id: string; code: string; name: string; type: string }; debit: number; credit: number }>();
  for (const line of lines) {
    const existing = byAccount.get(line.accountId) ?? { account: line.account, debit: 0, credit: 0 };
    byAccount.set(line.accountId, {
      account: line.account,
      debit: existing.debit + Number(line.debit),
      credit: existing.credit + Number(line.credit),
    });
  }

  const rows = Array.from(byAccount.values())
    .map((r) => ({ ...r, balance: r.debit - r.credit }))
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Fetch fiscal years for filter dropdown
  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { tenantId: tenant.id },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true },
  });

  return { rows, totalDebit, totalCredit, isBalanced, fiscalYears };
}

const fmt = (n: number) =>
  n !== 0
    ? `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    : "—";

const TYPE_BADGE: Record<string, string> = {
  asset:     "text-blue-400",
  liability: "text-orange-400",
  equity:    "text-purple-400",
  revenue:   "text-emerald-400",
  expense:   "text-red-400",
};

export default async function TrialBalancePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fiscalYearId?: string }>;
}) {
  const { slug } = await params;
  const { fiscalYearId } = await searchParams;

  const data = await getTrialBalance(slug, fiscalYearId);
  if (!data) notFound();

  const { rows, totalDebit, totalCredit, isBalanced, fiscalYears } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trial Balance"
        description="Aggregated posted journal lines by account."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/accounting`}>← Accounting</Link>
          </Button>
        }
      />

      {/* Fiscal year filter */}
      {fiscalYears.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filter by fiscal year:</span>
          <Link
            href={`/${slug}/accounting/trial-balance`}
            className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
              fiscalYearId === undefined
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted/30"
            }`}
          >
            All
          </Link>
          {fiscalYears.map((fy) => (
            <Link
              key={fy.id}
              href={`/${slug}/accounting/trial-balance?fiscalYearId=${fy.id}`}
              className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                fiscalYearId === fy.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/30"
              }`}
            >
              {fy.name}
            </Link>
          ))}
        </div>
      )}

      {/* Balance indicator */}
      <div
        className={`rounded-md border px-4 py-3 text-sm font-medium ${
          isBalanced
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}
      >
        {isBalanced ? "✓ Balanced" : "⚠ Unbalanced — debits and credits do not match"}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Calculator}
                title="No posted journal lines found."
                description="Post journal entries to see the trial balance."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.account.id}>
                    <TableCell className="font-mono text-xs">{row.account.code}</TableCell>
                    <TableCell>{row.account.name}</TableCell>
                    <TableCell className={`capitalize text-xs font-medium ${TYPE_BADGE[row.account.type] ?? ""}`}>
                      {row.account.type}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(row.debit)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(row.credit)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs font-semibold ${row.balance < 0 ? "text-red-400" : ""}`}>
                      {fmt(Math.abs(row.balance))}{row.balance < 0 ? " Cr" : row.balance > 0 ? " Dr" : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-xs font-semibold text-muted-foreground">
                    Totals
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">
                    {fmt(totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">
                    {fmt(totalCredit)}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-xs font-bold ${isBalanced ? "text-emerald-400" : "text-red-400"}`}>
                    {isBalanced ? "✓" : fmt(Math.abs(totalDebit - totalCredit))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
