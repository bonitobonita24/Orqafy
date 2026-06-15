import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Chart of Accounts" };
export const dynamic = "force-dynamic";

const TYPE_BADGE: Record<string, string> = {
  asset:     "border-blue-500/30 bg-blue-500/10 text-blue-400",
  liability: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  equity:    "border-purple-500/30 bg-purple-500/10 text-purple-400",
  revenue:   "border-primary/30 bg-primary/10 text-primary",
  expense:   "border-red-500/30 bg-red-500/10 text-red-400",
};

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

  const TYPE_TABS = [
    { key: "all", label: "All" },
    { key: "asset", label: "Asset" },
    { key: "liability", label: "Liability" },
    { key: "equity", label: "Equity" },
    { key: "revenue", label: "Revenue" },
    { key: "expense", label: "Expense" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {accounts.length} account{accounts.length === 1 ? "" : "s"}
            {activeOnly ? " — active only" : ""}
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
            href={`/${slug}/accounting/accounts/new`}
            className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            + New Account
          </Link>
        </div>
      </div>

      {/* Type + active filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md border border-border bg-card p-1">
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

      <div className="rounded-lg border border-border bg-card">
        {accounts.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No accounts found.{" "}
            <Link href={`/${slug}/accounting/accounts/new`} className="text-primary hover:underline">
              Create your first account.
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Subtype</th>
                <th className="px-4 py-3 font-medium">JE Lines</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium">{account.code}</td>
                  <td className="px-4 py-3 font-medium">
                    {account.name}
                    {account.isSystem && (
                      <span className="ml-2 text-xs text-muted-foreground">(system)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                        TYPE_BADGE[account.type] ?? TYPE_BADGE["asset"]
                      }`}
                    >
                      {account.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {account.subtype !== null ? account.subtype : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {account._count.journalLines}
                  </td>
                  <td className="px-4 py-3">
                    {account.isActive ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!account.isSystem && (
                      <Link
                        href={`/${slug}/accounting/accounts/${account.id}/edit`}
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
