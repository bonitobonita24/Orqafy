import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LifeBuoy } from "@/components/ui/icons";
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

export const metadata: Metadata = { title: "Support Tickets" };
export const dynamic = "force-dynamic";

function userDisplayName(
  u: { displayName: string | null; firstName: string; lastName: string } | null,
): string {
  if (u === null) return "—";
  return u.displayName ?? `${u.firstName} ${u.lastName}`.trim();
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_BADGE: Record<string, string> = {
  open: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  in_progress: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  waiting: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  resolved: "border-primary/30 bg-primary/10 text-primary",
  closed: "border-border bg-muted text-muted-foreground",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "waiting", label: "Waiting" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

async function getTickets(tenantId: string, status: string | undefined) {
  const filter = status !== undefined && status !== "all" ? { status } : {};
  return prisma.supportTicket.findMany({
    where: { tenantId, ...filter },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      category: true,
      assignedToId: true,
      createdAt: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
      _count: { select: { comments: true } },
    },
  });
}

export default async function SupportTicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (tenant === null) notFound();

  const sp = await searchParams;
  const activeStatus = sp.status ?? "all";
  const tickets = await getTickets(tenant.id, activeStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Tickets"
        description={`${tickets.length} ticket${tickets.length === 1 ? "" : "s"}${
          activeStatus !== "all" ? ` — ${STATUS_LABELS[activeStatus] ?? activeStatus}` : ""
        }`}
        actions={
          <Button asChild>
            <Link href={`/${slug}/support/new`}>+ New Ticket</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
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
          {tickets.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={LifeBuoy} title="No tickets found." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`support/${t.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {t.ticketNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{t.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${
                          STATUS_BADGE[t.status] ?? STATUS_BADGE["open"]
                        }`}
                      >
                        {STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${
                          PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE["medium"]
                        }`}
                      >
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {userDisplayName(t.createdBy)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.createdAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t._count.comments}
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
