import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
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

export const metadata: Metadata = { title: "Journal Entries" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  draft:  "border-border bg-muted text-muted-foreground",
  posted: "border-primary/30 bg-primary/10 text-primary",
  void:   "border-red-500/30 bg-red-500/10 text-red-400",
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "posted", label: "Posted" },
  { key: "void", label: "Void" },
];

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        description={`${entries.length} entr${entries.length === 1 ? "y" : "ies"}${
          activeStatus !== "all" ? ` — ${activeStatus}` : ""
        }`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/accounting`}>← Accounting</Link>
            </Button>
            <Button asChild>
              <Link href={`/${slug}/accounting/journal-entries/new`}>+ New Entry</Link>
            </Button>
          </>
        }
      />

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

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ReceiptText}
                title="No journal entries found."
                action={
                  <Link
                    href={`/${slug}/accounting/journal-entries/new`}
                    className="text-sm text-primary hover:underline"
                  >
                    Create your first entry →
                  </Link>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Link
                        href={`/${slug}/accounting/journal-entries/${entry.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {entry.entryNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.date.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={entry.description}>
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry._count.lines}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full capitalize ${
                          STATUS_BADGE[entry.status] ?? STATUS_BADGE["draft"]
                        }`}
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.status === "draft" && (
                        <Link
                          href={`/${slug}/accounting/journal-entries/${entry.id}/edit`}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Edit
                        </Link>
                      )}
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
