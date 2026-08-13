import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck } from "@/components/ui/icons";
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

export const metadata: Metadata = { title: "Chart of Accounts" };
export const dynamic = "force-dynamic";

const TYPE_BADGE: Record<string, string> = {
  asset:     "border-blue-500/30 bg-blue-500/10 text-blue-400",
  liability: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  equity:    "border-purple-500/30 bg-purple-500/10 text-purple-400",
  revenue:   "border-primary/30 bg-primary/10 text-primary",
  expense:   "border-red-500/30 bg-red-500/10 text-red-400",
};

const TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "asset", label: "Asset" },
  { key: "liability", label: "Liability" },
  { key: "equity", label: "Equity" },
  { key: "revenue", label: "Revenue" },
  { key: "expense", label: "Expense" },
];

async function getAccounts(tenantId: string, type?: string, activeOnly?: boolean) {
  return prisma.account.findMany({
    where: {
      tenantId,
      ...(type !== undefined && type !== "all" ? { type } : {}),
      ...(activeOnly === true ? { isActive: true } : {}),
    },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      subtype: true,
      isActive: true,
      isSystem: true,
      parentId: true,
      _count: { select: { journalLines: true } },
    },
  });
}

async function getTenantId(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return null;
  return tenant.id;
}

export default async function ChartOfAccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; filter?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const tenantId = await getTenantId(slug);
  if (tenantId === null) return <div className="p-6 text-sm text-muted-foreground">Tenant not found.</div>;

  const activeOnly = sp.filter !== "all";
  const activeType = sp.type ?? "all";
  const accounts = await getAccounts(tenantId, activeType, activeOnly);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description={`${accounts.length} account${accounts.length === 1 ? "" : "s"}${
          activeOnly ? " — active only" : ""
        }`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/accounting`}>← Accounting</Link>
            </Button>
            <Button asChild>
              <Link href={`/${slug}/accounting/accounts/new`}>+ New Account</Link>
            </Button>
          </>
        }
      />

      {/* Type + active filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
          {TYPE_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`?type=${tab.key}&filter=${activeOnly ? "active" : "all"}`}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                activeType === tab.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1">
          <Link
            href={`?type=${activeType}&filter=active`}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              activeOnly ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active
          </Link>
          <Link
            href={`?type=${activeType}&filter=all`}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              !activeOnly ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={BookOpenCheck}
                title="No accounts found."
                action={
                  <Link
                    href={`/${slug}/accounting/accounts/new`}
                    className="text-sm text-primary hover:underline"
                  >
                    Create your first account →
                  </Link>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subtype</TableHead>
                  <TableHead>JE Lines</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono text-xs font-medium">{account.code}</TableCell>
                    <TableCell className="font-medium">
                      {account.name}
                      {account.isSystem && (
                        <span className="ml-2 text-xs text-muted-foreground">(system)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full capitalize ${
                          TYPE_BADGE[account.type] ?? TYPE_BADGE["asset"]
                        }`}
                      >
                        {account.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {account.subtype !== null ? account.subtype : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {account._count.journalLines}
                    </TableCell>
                    <TableCell>
                      {account.isActive ? (
                        <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-border bg-muted text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!account.isSystem && (
                        <Link
                          href={`/${slug}/accounting/accounts/${account.id}/edit`}
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
