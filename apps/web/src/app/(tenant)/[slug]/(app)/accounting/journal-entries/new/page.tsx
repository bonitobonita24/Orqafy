import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { JournalEntryForm } from "../journal-entry-form";

export const metadata: Metadata = { title: "New Journal Entry" };
export const dynamic = "force-dynamic";

export default async function NewJournalEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const [fiscalYears, accounts] = await Promise.all([
    prisma.fiscalYear.findMany({
      where: { tenantId: tenant.id, isClosed: false },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    }),
    prisma.account.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Journal Entry</h1>
          <p className="text-sm text-muted-foreground">Create a draft journal entry. Debits must equal credits.</p>
        </div>
        <Link
          href={`/${slug}/accounting/journal-entries`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Journal Entries
        </Link>
      </div>

      {fiscalYears.length === 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          No open fiscal years found. Please create a fiscal year before adding journal entries.
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6">
        <JournalEntryForm slug={slug} mode="create" fiscalYears={fiscalYears} accounts={accounts} />
      </div>
    </div>
  );
}
