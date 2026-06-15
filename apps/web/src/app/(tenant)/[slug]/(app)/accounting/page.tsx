import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Chart of Accounts" };

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

async function getAccounts() {
  return prisma.account.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      subtype: true,
      isActive: true,
      isSystem: true,
    },
  });
}

export default async function AccountingPage() {
  const accounts = await getAccounts();
  const active = accounts.filter((a) => a.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active of {accounts.length} total
          </p>
        </div>
        <Link
          href="accounting/journal-entries"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          Journal Entries →
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {accounts.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No accounts yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Subtype</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {a.code}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{a.name}</span>
                    {a.isSystem && (
                      <span className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        System
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {TYPE_LABELS[a.type] ?? a.type}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.subtype !== null ? a.subtype : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.isActive ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
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
