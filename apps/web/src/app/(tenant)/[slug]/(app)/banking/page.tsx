import type { Metadata } from "next";
import Link from "next/link";
import { Landmark } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function getTenantId(slug: string) {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
}

export const metadata: Metadata = { title: "Banking & Finance" };
export const dynamic = "force-dynamic";

function formatPHP(amount: unknown): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

const TYPE_LABELS: Record<string, string> = {
  cash_on_hand: "Cash on Hand",
  e_wallet: "E-Wallet",
  bank: "Bank Account",
  credit_card: "Credit Card",
  loan: "Loan",
};

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  expense: "Expense",
  income: "Income",
  refund: "Refund",
  adjustment: "Adjustment",
  loan_disbursement: "Loan Disbursement",
  loan_repayment: "Loan Repayment",
  loan_payback: "Loan Payback",
  credit_card_charge: "CC Charge",
  credit_card_payment: "CC Payment",
};

const TX_TYPE_DIR: Record<string, "in" | "out" | "neutral"> = {
  income: "in",
  refund: "in",
  transfer_in: "in",
  loan_disbursement: "in",
  expense: "out",
  withdrawal: "out",
  transfer_out: "out",
  loan_repayment: "out",
  loan_payback: "out",
  credit_card_charge: "out",
  credit_card_payment: "out",
  deposit: "in",
  adjustment: "neutral",
};

async function getDashboardData(tenantId: string) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [activeSources, monthTxs, recentTxs] = await Promise.all([
    prisma.fundSource.findMany({
      // tenant-scoped: prevents cross-tenant data leak
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        currentBalance: true,
        outstandingBalance: true,
        loanBalance: true,
        loanPrincipal: true,
        currency: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.fundTransaction.findMany({
      // tenant-scoped: prevents cross-tenant data leak
      where: { tenantId, transactionDate: { gte: monthStart } },
      select: { type: true, amount: true },
    }),
    prisma.fundTransaction.findMany({
      // tenant-scoped: prevents cross-tenant data leak
      where: { tenantId },
      orderBy: { transactionDate: "desc" },
      take: 10,
      include: {
        fundSource: { select: { id: true, name: true, type: true } },
      },
    }),
  ]);

  let cashTotal = 0;
  let creditCardOutstanding = 0;
  let loanBalanceTotal = 0;
  for (const s of activeSources) {
    if (s.type === "cash_on_hand" || s.type === "bank" || s.type === "e_wallet") {
      cashTotal += parseFloat(s.currentBalance.toString());
    } else if (s.type === "credit_card") {
      creditCardOutstanding += parseFloat((s.outstandingBalance ?? "0").toString());
    } else if (s.type === "loan") {
      loanBalanceTotal += parseFloat(
        (s.loanBalance ?? s.loanPrincipal ?? "0").toString()
      );
    }
  }

  let thisMonthIncome = 0;
  let thisMonthExpense = 0;
  for (const t of monthTxs) {
    const amt = parseFloat(t.amount.toString());
    if (t.type === "income" || t.type === "refund") {
      thisMonthIncome += amt;
    } else if (t.type === "expense") {
      thisMonthExpense += amt;
    }
  }

  return {
    cashTotal,
    creditCardOutstanding,
    loanBalance: loanBalanceTotal,
    netPosition: cashTotal - creditCardOutstanding - loanBalanceTotal,
    thisMonthIncome,
    thisMonthExpense,
    activeSources,
    recentTxs,
  };
}

// Static KPI stat card — Card/CardContent + Separator, matching the
// reports-page Pro statistic-card idiom (no trend badge here — this
// dashboard's KPIs are point-in-time balances, not period deltas).
function KPICard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-primary"
      : tone === "negative"
        ? "text-red-500"
        : tone === "warning"
          ? "text-orange-500"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`mt-2 text-3xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
        {hint !== undefined && (
          <>
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">{hint}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default async function BankingDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenantId = await getTenantId(slug);
  if (tenantId === null) return <div>Tenant not found</div>;
  const data = await getDashboardData(tenantId);
  const monthLabel = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banking & Finance"
        description={
          <>
            {data.activeSources.length} active fund source{data.activeSources.length === 1 ? "" : "s"}
            {" · "}
            <Link
              href={`/${slug}/banking/fund-sources`}
              className="text-primary hover:underline"
            >
              Manage sources
            </Link>
            {" · "}
            <Link
              href={`/${slug}/banking/transactions`}
              className="text-primary hover:underline"
            >
              All transactions
            </Link>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Total Real Cash"
          value={formatPHP(data.cashTotal)}
          hint="cash + bank + e-wallet"
          tone="positive"
        />
        <KPICard
          label="Credit Card Outstanding"
          value={formatPHP(data.creditCardOutstanding)}
          hint="balance owed across cards"
          tone={data.creditCardOutstanding > 0 ? "warning" : "neutral"}
        />
        <KPICard
          label="Loan Balance"
          value={formatPHP(data.loanBalance)}
          hint="outstanding loan principal"
          tone={data.loanBalance > 0 ? "warning" : "neutral"}
        />
        <KPICard
          label="Net Position"
          value={formatPHP(data.netPosition)}
          hint="cash − credit card − loans"
          tone={data.netPosition >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* This month activity */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold">This Month Activity</h2>
              <p className="text-xs text-muted-foreground">{monthLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="px-6 py-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Income (incl. refunds)
              </p>
              <p className="mt-2 text-xl font-semibold text-primary">
                {formatPHP(data.thisMonthIncome)}
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Expense
              </p>
              <p className="mt-2 text-xl font-semibold text-red-500">
                {formatPHP(data.thisMonthExpense)}
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Net (Income − Expense)
              </p>
              <p
                className={`mt-2 text-xl font-semibold ${
                  data.thisMonthIncome - data.thisMonthExpense >= 0
                    ? "text-primary"
                    : "text-red-500"
                }`}
              >
                {formatPHP(data.thisMonthIncome - data.thisMonthExpense)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active fund sources quick view */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Active Fund Sources</h2>
            <Link
              href={`/${slug}/banking/fund-sources`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              All →
            </Link>
          </div>
          {data.activeSources.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Landmark}
                title="No active fund sources."
                description="Add one in fund sources to start tracking balances."
                action={
                  <Link
                    href={`/${slug}/banking/fund-sources`}
                    className="text-sm text-primary hover:underline"
                  >
                    Fund sources →
                  </Link>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activeSources.map((s) => {
                  const isLiability = s.type === "credit_card" || s.type === "loan";
                  const displayBalance = isLiability
                    ? s.type === "credit_card"
                      ? s.outstandingBalance ?? 0
                      : s.loanBalance ?? s.loanPrincipal ?? 0
                    : s.currentBalance;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {TYPE_LABELS[s.type] ?? s.type}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-xs ${
                          isLiability ? "text-orange-500" : "text-primary"
                        }`}
                      >
                        {formatPHP(displayBalance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/${slug}/banking/${s.id}/transactions`}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Transactions →
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Recent Transactions</h2>
            <Link
              href={`/${slug}/banking/transactions`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              All →
            </Link>
          </div>
          {data.recentTxs.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No transactions yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTxs.map((tx) => {
                  const dir = TX_TYPE_DIR[tx.type] ?? "neutral";
                  const sign = dir === "in" ? "+" : dir === "out" ? "−" : "";
                  const amtColor =
                    dir === "in"
                      ? "text-primary"
                      : dir === "out"
                        ? "text-red-500"
                        : "text-muted-foreground";
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(tx.transactionDate)}
                      </TableCell>
                      <TableCell className="text-xs">{tx.fundSource.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {TX_TYPE_LABELS[tx.type] ?? tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {tx.description ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-xs ${amtColor}`}>
                        {sign}
                        {formatPHP(tx.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
