import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

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
  resolved: "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992]",
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

async function getTickets(status: string | undefined) {
  const filter = status !== undefined && status !== "all" ? { status } : undefined;
  return prisma.supportTicket.findMany({
    ...(filter !== undefined ? { where: filter } : {}),
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
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const activeStatus = params.status ?? "all";
  const tickets = await getTickets(activeStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
        <p className="text-sm text-muted-foreground">
          {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          {activeStatus !== "all" ? ` — ${STATUS_LABELS[activeStatus] ?? activeStatus}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?status=${tab.key}`}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              activeStatus === tab.key
                ? "bg-[#00d992]/10 text-[#00d992]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        {tickets.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No tickets found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Ticket #</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Reporter</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Comments</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`support/${t.id}`}
                      className="font-mono text-xs font-medium text-[#00d992] hover:underline"
                    >
                      {t.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{t.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[t.status] ?? STATUS_BADGE["open"]
                      }`}
                    >
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE["medium"]
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {userDisplayName(t.createdBy)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.createdAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t._count.comments}
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
