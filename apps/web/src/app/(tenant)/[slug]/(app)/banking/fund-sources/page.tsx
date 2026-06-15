import type { Metadata } from "next";
import { prisma } from "@orqafy/db";
import { AddFundSourceButton, EditFundSourceButton, ToggleFundSourceButton } from "./fund-source-form";

async function getTenantId(slug: string) {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
}

export const metadata: Metadata = { title: "Fund Sources" };

export const dynamic = "force-dynamic";

async function getFundSources(tenantId: string) {
  return prisma.fundSource.findMany({
    // tenant-scoped: prevents cross-tenant data leak
    where: { tenantId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      currentBalance: true,
      currency: true,
      bankName: true,
      accountNumber: true,
      isActive: true,
    },
  });
}

const TYPE_LABELS: Record<string, string> = {
  cash_on_hand: "Cash on Hand",
  e_wallet: "E-Wallet",
  bank: "Bank Account",
  credit_card: "Credit Card",
  loan: "Loan",
};

const TYPE_COLORS: Record<string, string> = {
  bank: "text-primary bg-primary/10 border-primary/30",
  cash_on_hand: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  e_wallet: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  credit_card: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  loan: "text-orange-400 bg-orange-400/10 border-orange-400/30",
};

function formatBalance(balance: unknown, currency: string): string {
  const num = Number(balance);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

export default async function FundSourcesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenantId = await getTenantId(slug);
  if (tenantId === null) return <div>Tenant not found</div>;
  const fundSources = await getFundSources(tenantId);
  const active = fundSources.filter((f) => f.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fund Sources</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active of {fundSources.length} total
          </p>
        </div>
        <AddFundSourceButton />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {fundSources.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No fund sources configured yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fundSources.map((fs) => {
                const typeClass =
                  TYPE_COLORS[fs.type] ??
                  "text-muted-foreground bg-muted border-border";
                const typeLabel = TYPE_LABELS[fs.type] ?? fs.type;
                return (
                  <tr
                    key={fs.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{fs.name}</div>
                      {fs.bankName !== null && (
                        <div className="text-xs text-muted-foreground">
                          {fs.bankName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${typeClass}`}
                      >
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {formatBalance(fs.currentBalance, fs.currency)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fs.accountNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {fs.isActive ? (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <EditFundSourceButton
                          fundSource={{
                            id: fs.id,
                            name: fs.name,
                            type: fs.type,
                            bankName: fs.bankName,
                            accountNumber: fs.accountNumber,
                          }}
                        />
                        <ToggleFundSourceButton id={fs.id} isActive={fs.isActive} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
