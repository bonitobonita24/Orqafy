import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <PageHeader
        title="POS Sessions"
        description="Point-of-sale cash drawer sessions. Last 50 sessions shown."
        actions={
          <>
            <OpenSessionDialog slug={slug} />
            <Button variant="outline" asChild>
              <Link href={`/${slug}/pos/new-sale`}>New Sale →</Link>
            </Button>
          </>
        }
      />

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

      <Card>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={ShoppingCart} title="No sessions yet." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session #</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/${slug}/pos/${s.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {s.sessionNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{userDisplayName(s.user)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(s.openedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(s.closedAt)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatAmount(s.openingBalance)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {s._count.sales}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
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
      <Badge
        variant="outline"
        className="rounded-full border-primary/30 bg-primary/10 text-primary"
      >
        Open
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full bg-muted text-muted-foreground">
      Closed
    </Badge>
  );
}
