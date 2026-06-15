import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { JournalEntryActions } from "./JournalEntryActions";

export const metadata: Metadata = { title: "Journal Entry" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  draft:  "border-border bg-muted text-muted-foreground",
  posted: "border-primary/30 bg-primary/10 text-primary",
  void:   "border-red-500/30 bg-red-500/10 text-red-400",
};

export default async function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: {
        include: { account: { select: { code: true, name: true, type: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!entry || entry.tenantId !== tenant.id) notFound();

  const totalDebits = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredits = entry.lines.reduce((s, l) => s + Number(l.credit), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">{entry.entryNumber}</h1>
          <p className="text-sm text-muted-foreground">{entry.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/accounting/journal-entries`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            ← Journal Entries
          </Link>
          {entry.status === "draft" && (
            <Link
              href={`/${slug}/accounting/journal-entries/${id}/edit`}
              className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              Edit Draft
            </Link>
          )}
          <JournalEntryActions entryId={id} status={entry.status} slug={slug} />
        </div>
      </div>

      {/* Entry header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground mb-1">Date</dt>
            <dd className="font-medium">{entry.date.toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground mb-1">Status</dt>
            <dd>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                  STATUS_BADGE[entry.status] ?? STATUS_BADGE["draft"]
                }`}
              >
                {entry.status}
              </span>
            </dd>
          </div>
          {entry.referenceType !== null && (
            <div>
              <dt className="text-xs text-muted-foreground mb-1">Reference Type</dt>
              <dd className="font-medium capitalize">{entry.referenceType}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground mb-1">Created</dt>
            <dd className="font-medium">{entry.createdAt.toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {/* Lines table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-3">
          <h2 className="text-sm font-semibold">Debit / Credit Lines</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Memo</th>
              <th className="px-4 py-3 font-medium text-right">Debit</th>
              <th className="px-4 py-3 font-medium text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line) => (
              <tr key={line.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs">{line.account.code}</span>{" "}
                  <span className="text-muted-foreground">{line.account.name}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{line.account.type}</td>
                <td className="px-4 py-3 text-muted-foreground">{line.description !== null ? line.description : "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {Number(line.debit) > 0
                    ? `₱${Number(line.debit).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {Number(line.credit) > 0
                    ? `₱${Number(line.credit).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/20">
              <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-muted-foreground">Totals</td>
              <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                ₱{totalDebits.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                ₱{totalCredits.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Posting info for posted entries */}
      {entry.status === "posted" && entry.postedAt !== null && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          Posted on {entry.postedAt.toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
