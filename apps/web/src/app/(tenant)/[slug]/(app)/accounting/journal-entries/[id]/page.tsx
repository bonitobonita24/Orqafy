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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <PageHeader
        title={entry.entryNumber}
        titleClassName="font-mono"
        description={entry.description}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/accounting/journal-entries`}>← Journal Entries</Link>
            </Button>
            {entry.status === "draft" && (
              <Button asChild>
                <Link href={`/${slug}/accounting/journal-entries/${id}/edit`}>Edit Draft</Link>
              </Button>
            )}
            <JournalEntryActions entryId={id} status={entry.status} slug={slug} />
          </>
        }
      />

      {/* Entry header */}
      <Card>
        <CardContent className="px-6 py-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground mb-1">Date</dt>
              <dd className="font-medium">{entry.date.toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-1">Status</dt>
              <dd>
                <Badge
                  variant="outline"
                  className={`rounded-full capitalize ${
                    STATUS_BADGE[entry.status] ?? STATUS_BADGE["draft"]
                  }`}
                >
                  {entry.status}
                </Badge>
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
        </CardContent>
      </Card>

      {/* Lines table */}
      <Card>
        <div className="border-b border-border px-6 py-3">
          <h2 className="text-sm font-semibold">Debit / Credit Lines</h2>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{line.account.code}</span>{" "}
                    <span className="text-muted-foreground">{line.account.name}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">{line.account.type}</TableCell>
                  <TableCell className="text-muted-foreground">{line.description !== null ? line.description : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {Number(line.debit) > 0
                      ? `₱${Number(line.debit).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {Number(line.credit) > 0
                      ? `₱${Number(line.credit).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-xs font-semibold text-muted-foreground">Totals</TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">
                  ₱{totalDebits.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">
                  ₱{totalCredits.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Posting info for posted entries */}
      {entry.status === "posted" && entry.postedAt !== null && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          Posted on {entry.postedAt.toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
