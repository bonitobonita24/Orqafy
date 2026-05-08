import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Journal Entries" };

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  posted: "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992]",
  void: "border-destructive/30 bg-destructive/10 text-destructive",
};

async function getJournalEntries() {
  return prisma.journalEntry.findMany({
    orderBy: { date: "desc" },
    take: 100,
    select: {
      id: true,
      entryNumber: true,
      date: true,
      description: true,
      status: true,
      referenceType: true,
      referenceId: true,
      fiscalYear: { select: { name: true } },
      lines: {
        select: {
          debit: true,
          credit: true,
        },
      },
    },
  });
}

function sumDecimal(values: Array<{ debit: unknown; credit: unknown }>): number {
  return values.reduce((acc, l) => acc + Number(l.debit), 0);
}

export default async function JournalEntriesPage() {
  const entries = await getJournalEntries();
  const drafts = entries.filter((e) => e.status === "draft").length;
  const posted = entries.filter((e) => e.status === "posted").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} total · {posted} posted · {drafts} draft
          </p>
        </div>
        <Link
          href="../accounting"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Chart of Accounts
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No journal entries yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Entry #</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Fiscal Year</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const amount = sumDecimal(e.lines);
                const statusStyle = STATUS_STYLES[e.status] ?? STATUS_STYLES.draft;
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {e.entryNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.date.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{e.description}</span>
                      {e.referenceType !== null && (
                        <span className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                          {e.referenceType}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.fiscalYear.name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      ₱{amount.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle}`}
                      >
                        {e.status}
                      </span>
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
