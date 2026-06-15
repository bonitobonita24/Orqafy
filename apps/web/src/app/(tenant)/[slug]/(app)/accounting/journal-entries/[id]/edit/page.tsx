import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { JournalEntryForm } from "../../journal-entry-form";

export const metadata: Metadata = { title: "Edit Journal Entry" };
export const dynamic = "force-dynamic";

export default async function EditJournalEntryPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });

  if (!entry || entry.tenantId !== tenant.id) notFound();
  if (entry.status !== "draft") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Cannot Edit Entry</h1>
          <Link
            href={`/${slug}/accounting/journal-entries/${id}`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            ← Back
          </Link>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Only draft journal entries can be edited.
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Edit Journal Entry</h1>
          <p className="text-sm text-muted-foreground font-mono">{entry.entryNumber}</p>
        </div>
        <Link
          href={`/${slug}/accounting/journal-entries/${id}`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Entry Detail
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <JournalEntryForm
          slug={slug}
          mode="edit"
          entryId={entry.id}
          fiscalYears={fiscalYears}
          accounts={accounts}
          initial={{
            fiscalYearId: entry.fiscalYearId,
            date: entry.date.toISOString().slice(0, 10),
            description: entry.description,
            lines: entry.lines.map((l) => ({
              accountId: l.accountId,
              debit: Number(l.debit),
              credit: Number(l.credit),
              description: l.description ?? "",
            })),
          }}
        />
      </div>
    </div>
  );
}
