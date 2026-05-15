import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

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

async function getDashboardData() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [activeSources, monthTxs, recentTxs] = await Promise.all([
    prisma.fundSource.findMany({
      where: { isActive: true },
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
      where: { transactionDate: { gte: monthStart } },
      select: { type: true, amount: true },
    }),
    prisma.fundTransaction.findMany({
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
      ? "text-[#00d992]"
      : tone === "negative"
        ? "text-red-400"
        : tone === "warning"
          ? "text-orange-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint !== undefined && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export default async function BankingDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getDashboardData();
  const monthLabel = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Banking & Finance</h1>
          <p className="text-sm text-muted-foreground">
            {data.activeSources.length} active fund source{data.activeSources.length === 1 ? "" : "s"}
            {" · "}
            <Link
              href={`/${slug}/banking/fund-sources`}
              className="text-[#00d992] hover:underline"
            >
              Manage sources
            </Link>
            {" · "}
            <Link
              href={`/${slug}/banking/transactions`}
              className="text-[#00d992] hover:underline"
            >
              All transactions
            </Link>
          </p>
        </div>
      </div>

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
      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold">This Month Activity</h2>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </div>
        </header>
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="px-6 py-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Income (incl. refunds)
            </p>
            <p className="mt-2 text-xl font-semibold text-[#00d992]">
              {formatPHP(data.thisMonthIncome)}
            </p>
          </div>
          <div className="px-6 py-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Expense
            </p>
            <p className="mt-2 text-xl font-semibold text-red-400">
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
                  ? "text-[#00d992]"
                  : "text-red-400"
              }`}
            >
              {formatPHP(data.thisMonthIncome - data.thisMonthExpense)}
            </p>
          </div>
        </div>
      </section>

      {/* Active fund sources quick view */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Active Fund Sources</h2>
          <Link
            href={`/${slug}/banking/fund-sources`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            All →
          </Link>
        </header>
        {data.activeSources.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No active fund sources. Add one in{" "}
            <Link
              href={`/${slug}/banking/fund-sources`}
              className="text-[#00d992] hover:underline"
            >
              fund sources
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.activeSources.map((s) => {
                const isLiability = s.type === "credit_card" || s.type === "loan";
                const displayBalance = isLiability
                  ? s.type === "credit_card"
                    ? s.outstandingBalance ?? 0
                    : s.loanBalance ?? s.loanPrincipal ?? 0
                  : s.currentBalance;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {TYPE_LABELS[s.type] ?? s.type}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono text-xs ${
                        isLiability ? "text-orange-400" : "text-[#00d992]"
                      }`}
                    >
                      {formatPHP(displayBalance)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/${slug}/banking/${s.id}/transactions`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Transactions →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Recent transactions */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Recent Transactions</h2>
          <Link
            href={`/${slug}/banking/transactions`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            All →
          </Link>
        </header>
        {data.recentTxs.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTxs.map((tx) => {
                const dir = TX_TYPE_DIR[tx.type] ?? "neutral";
                const sign = dir === "in" ? "+" : dir === "out" ? "−" : "";
                const amtColor =
                  dir === "in"
                    ? "text-[#00d992]"
                    : dir === "out"
                      ? "text-red-400"
                      : "text-muted-foreground";
                return (
                  <tr
                    key={tx.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {formatDate(tx.transactionDate)}
                    </td>
                    <td className="px-4 py-2 text-xs">{tx.fundSource.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {TX_TYPE_LABELS[tx.type] ?? tx.type}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {tx.description ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono text-xs ${amtColor}`}>
                      {sign}
                      {formatPHP(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
