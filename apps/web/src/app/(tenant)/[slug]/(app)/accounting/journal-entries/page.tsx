import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Journal Entries" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  draft:  "border-border bg-muted text-muted-foreground",
  posted: "border-primary/30 bg-primary/10 text-primary",
  void:   "border-red-500/30 bg-red-500/10 text-red-400",
};

async function getTenantId(slug: string) {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
}

async function getJournalEntries(tenantId: string, status?: string) {
  return prisma.journalEntry.findMany({
    where: {
      tenantId,
      ...(status !== undefined && status !== "all" ? { status } : {}),
    },
    orderBy: { date: "desc" },
    take: 100,
    select: {
      id: true,
      entryNumber: true,
      date: true,
      description: true,
      status: true,
      createdAt: true,
      _count: { select: { lines: true } },
    },
  });
}

export default async function JournalEntriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const tenantId = await getTenantId(slug);
  if (tenantId === null) return <div className="p-6 text-sm text-muted-foreground">Tenant not found.</div>;

  const activeStatus = sp.status ?? "all";
  const entries = await getJournalEntries(tenantId, activeStatus);

  const STATUS_TABS = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "posted", label: "Posted" },
    { key: "void", label: "Void" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"}
            {activeStatus !== "all" ? ` — ${activeStatus}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/accounting`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            ← Accounting
          </Link>
          <Link
            href={`/${slug}/accounting/journal-entries/new`}
            className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            + New Entry
          </Link>
        </div>
      </div>

      <div className="flex gap-1 rounded-md border border-border bg-card p-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?status=${tab.key}`}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              activeStatus === tab.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No journal entries found.{" "}
            <Link href={`/${slug}/accounting/journal-entries/new`} className="text-primary hover:underline">
              Create your first entry.
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Entry #</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Lines</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/accounting/journal-entries/${entry.id}`}
                      className="font-mono text-xs font-medium text-primary hover:underline"
                    >
                      {entry.entryNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.date.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={entry.description}>
                    {entry.description}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{entry._count.lines}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_BADGE[entry.status] ?? STATUS_BADGE["draft"]
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.status === "draft" && (
                      <Link
                        href={`/${slug}/accounting/journal-entries/${entry.id}/edit`}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
