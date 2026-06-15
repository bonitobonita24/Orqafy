import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Accounting" };
export const dynamic = "force-dynamic";

async function getSummary(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return null;
  const [accountCount, draftEntries, fiscalYears] = await Promise.all([
    prisma.account.count({ where: { tenantId: tenant.id, isActive: true } }),
    prisma.journalEntry.count({ where: { tenantId: tenant.id, status: "draft" } }),
    prisma.fiscalYear.findMany({
      where: { tenantId: tenant.id, isClosed: false },
      orderBy: { startDate: "desc" },
      take: 1,
      select: { name: true },
    }),
  ]);
  return { accountCount, draftEntries, currentFiscalYear: fiscalYears[0]?.name ?? null };
}

export default async function AccountingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const summary = await getSummary(slug);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
        <p className="text-sm text-muted-foreground">
          Chart of accounts, journal entries, and trial balance.
        </p>
      </div>

      {summary !== null && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Active Accounts</p>
            <p className="mt-1 text-2xl font-bold">{summary.accountCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Draft Journal Entries</p>
            <p className="mt-1 text-2xl font-bold">{summary.draftEntries}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Current Fiscal Year</p>
            <p className="mt-1 text-lg font-semibold">{summary.currentFiscalYear ?? "None set"}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href={`/${slug}/accounting/accounts`}
          className="group rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/30"
        >
          <h2 className="font-semibold group-hover:text-primary">Chart of Accounts →</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage account codes (asset, liability, equity, revenue, expense).
          </p>
        </Link>
        <Link
          href={`/${slug}/accounting/journal-entries`}
          className="group rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/30"
        >
          <h2 className="font-semibold group-hover:text-primary">Journal Entries →</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create draft entries, post to the ledger, and reverse posted entries.
          </p>
        </Link>
        <Link
          href={`/${slug}/accounting/trial-balance`}
          className="group rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/30"
        >
          <h2 className="font-semibold group-hover:text-primary">Trial Balance →</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-account aggregation of posted debit/credit lines with balance verification.
          </p>
        </Link>
      </div>

      <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Financial statements, GL rollups, and auto-posting from other modules are pending
        owner-supplied rules (see DECISIONS_LOG §A).
      </div>
    </div>
  );
}
