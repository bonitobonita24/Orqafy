import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";
import { OpenSessionDialog } from "./open-session-dialog";

export const metadata: Metadata = { title: "POS Sessions" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string }>;

function formatAmount(amount: unknown): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDateTime(date: Date | null | undefined): string {
  if (date === null || date === undefined) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function userDisplayName(u: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}): string {
  return u.displayName ?? `${u.firstName} ${u.lastName}`.trim();
}

export default async function POSSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const filter = sp.status === "open" || sp.status === "closed" ? sp.status : null;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return <div>Tenant not found</div>;

  const baseWhere = { tenantId: tenant.id };
  const where = filter !== null ? { ...baseWhere, status: filter } : baseWhere;
  const [sessions, openCount, closedCount] = await Promise.all([
    prisma.pOSSession.findMany({
      // tenant-scoped: prevents cross-tenant data leak
      where,
      orderBy: { openedAt: "desc" },
      take: 50,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, displayName: true },
        },
        _count: { select: { sales: true } },
      },
    }),
    prisma.pOSSession.count({ where: { tenantId: tenant.id, status: "open" } }), // tenant-scoped: prevents cross-tenant data leak
    prisma.pOSSession.count({ where: { tenantId: tenant.id, status: "closed" } }), // tenant-scoped: prevents cross-tenant data leak
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">POS Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Point-of-sale cash drawer sessions. Last 50 sessions shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OpenSessionDialog slug={slug} />
          <Link
            href={`/${slug}/pos/new-sale`}
            className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            New Sale →
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 border-b border-border">
        <FilterTab href={`/${slug}/pos`} label="All" active={filter === null} />
        <FilterTab
          href={`/${slug}/pos?status=open`}
          label={`Open (${openCount})`}
          active={filter === "open"}
        />
        <FilterTab
          href={`/${slug}/pos?status=closed`}
          label={`Closed (${closedCount})`}
          active={filter === "closed"}
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {sessions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No sessions yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Session #</th>
                <th className="px-4 py-3 font-medium">Cashier</th>
                <th className="px-4 py-3 font-medium">Opened</th>
                <th className="px-4 py-3 font-medium">Closed</th>
                <th className="px-4 py-3 text-right font-medium">Opening</th>
                <th className="px-4 py-3 text-right font-medium">Sales</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/${slug}/pos/${s.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {s.sessionNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{userDisplayName(s.user)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(s.openedAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(s.closedAt)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatAmount(s.openingBalance)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {s._count.sales}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
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

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "open") {
    return (
      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Open
      </span>
    );
  }
  return (
    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Closed
    </span>
  );
}
