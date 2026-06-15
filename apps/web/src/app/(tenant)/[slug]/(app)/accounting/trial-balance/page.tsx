import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trial Balance</h1>
          <p className="text-sm text-muted-foreground">
            Aggregated posted journal lines by account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/accounting`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            ← Accounting
          </Link>
        </div>
      </div>

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

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No posted journal lines found. Post journal entries to see the trial balance.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Account Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Debit</th>
                <th className="px-4 py-3 font-medium text-right">Credit</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.account.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                  <td className="px-4 py-3 font-mono text-xs">{row.account.code}</td>
                  <td className="px-4 py-3">{row.account.name}</td>
                  <td className={`px-4 py-3 capitalize text-xs font-medium ${TYPE_BADGE[row.account.type] ?? ""}`}>
                    {row.account.type}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{fmt(row.debit)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{fmt(row.credit)}</td>
                  <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${row.balance < 0 ? "text-red-400" : ""}`}>
                    {fmt(Math.abs(row.balance))}{row.balance < 0 ? " Cr" : row.balance > 0 ? " Dr" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                  Totals
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                  {fmt(totalDebit)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                  {fmt(totalCredit)}
                </td>
                <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${isBalanced ? "text-emerald-400" : "text-red-400"}`}>
                  {isBalanced ? "✓" : fmt(Math.abs(totalDebit - totalCredit))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
