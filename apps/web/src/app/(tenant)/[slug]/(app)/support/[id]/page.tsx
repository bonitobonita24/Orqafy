import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketActions } from "./ticket-actions";

export const metadata: Metadata = { title: "Support Ticket" };
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function getTicket(id: string, tenantId: string) {
  return prisma.supportTicket.findUnique({
    where: { id, tenantId },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      closedAt: true,
      assignedToId: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          isInternal: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          fileSizeBytes: true,
          mimeType: true,
        },
      },
    },
  });
}

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (tenant === null) notFound();

  const ticket = await getTicket(id, tenant.id);
  if (ticket === null) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/${slug}/support`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All tickets
        </Link>
        <PageHeader
          className="mt-1"
          title={ticket.title}
          description={
            <>
              <span className="font-mono text-xs">{ticket.ticketNumber}</span>
              {" · Opened by "}
              {userDisplayName(ticket.createdBy)}
              {" · "}
              {ticket.createdAt.toLocaleString()}
              {ticket.category !== null ? ` · ${ticket.category}` : ""}
            </>
          }
          actions={
            <>
              <Badge
                variant="outline"
                className={`rounded-full ${
                  STATUS_BADGE[ticket.status] ?? STATUS_BADGE["open"]
                }`}
              >
                {STATUS_LABELS[ticket.status] ?? ticket.status}
              </Badge>
              <Badge
                variant="outline"
                className={`rounded-full ${
                  PRIORITY_BADGE[ticket.priority] ?? PRIORITY_BADGE["medium"]
                }`}
              >
                {ticket.priority}
              </Badge>
            </>
          }
        />
      </div>

      {/* Mutation actions — Client Component */}
      <TicketActions
        ticketId={ticket.id}
        currentStatus={ticket.status}
        assignedToId={ticket.assignedToId}
      />

      {/* Meta grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Assigned to</div>
            <div className="mt-1 text-sm font-medium">
              {ticket.assignedToId !== null
                ? `User ${ticket.assignedToId.slice(0, 8)}`
                : "— Unassigned —"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Resolved at</div>
            <div className="mt-1 text-sm font-medium">
              {ticket.resolvedAt !== null ? ticket.resolvedAt.toLocaleString() : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Closed at</div>
            <div className="mt-1 text-sm font-medium">
              {ticket.closedAt !== null ? ticket.closedAt.toLocaleString() : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
        </CardContent>
      </Card>

      {/* Attachments */}
      {ticket.attachments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Attachments ({ticket.attachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {ticket.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded border border-border bg-muted/20 px-3 py-2 text-sm"
                >
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {a.fileName}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {a.mimeType} · {formatBytes(a.fileSizeBytes)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Comments thread */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Comments ({ticket.comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ticket.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-4">
              {ticket.comments.map((c) => (
                <li
                  key={c.id}
                  className={`rounded border px-4 py-3 ${
                    c.isInternal
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {userDisplayName(c.user)}
                      {c.isInternal ? (
                        <span className="ml-2 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
                          Internal
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.createdAt.toLocaleString()}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{c.content}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
