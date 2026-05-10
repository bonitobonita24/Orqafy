import type { Metadata } from "next";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Transactions Ledger" };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string; type?: string; fundSourceId?: string }>;
}

async function getTransactions(page: number, type?: string, fundSourceId?: string) {
  const skip = (page - 1) * PAGE_SIZE;
  const where = {
    ...(type !== undefined && { type }),
    ...(fundSourceId !== undefined && { fundSourceId }),
  };

  const [transactions, total] = await Promise.all([
    prisma.fundTransaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        amount: true,
        runningBalance: true,
        description: true,
        category: true,
        transactionDate: true,
        createdAt: true,
        fundSource: { select: { id: true, name: true, type: true } },
        createdBy: { select: { firstName: true, lastName: true, displayName: true } },
      },
    }),
    prisma.fundTransaction.count({ where }),
  ]);

  return { transactions, total };
}

async function getFundSources() {
  return prisma.fundSource.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

const TYPE_LABELS: Record<string, string> = {
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

const TYPE_COLORS: Record<string, string> = {
  deposit: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  income: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  transfer_in: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  loan_payback: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  credit_card_payment: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  withdrawal: "text-red-400 bg-red-400/10 border-red-400/30",
  expense: "text-red-400 bg-red-400/10 border-red-400/30",
  transfer_out: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  loan_disbursement: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  loan_repayment: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  credit_card_charge: "text-red-400 bg-red-400/10 border-red-400/30",
  refund: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  adjustment: "text-muted-foreground bg-muted border-border",
};

function formatAmount(amount: unknown): string {
  const num = Number(amount);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const CREDIT_TYPES = new Set([
  "deposit",
  "income",
  "transfer_in",
  "loan_payback",
  "credit_card_payment",
  "refund",
]);

export default async function TransactionsLedgerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));
  const typeFilter = params.type ?? undefined;
  const fundSourceFilter = params.fundSourceId ?? undefined;

  const [{ transactions, total }, fundSources] = await Promise.all([
    getTransactions(page, typeFilter, fundSourceFilter),
    getFundSources(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions Ledger</h1>
          <p className="text-sm text-muted-foreground">
            All fund transactions across sources
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="fundSourceId" className="text-xs text-muted-foreground whitespace-nowrap">
            Fund Source
          </label>
          <select
            id="fundSourceId"
            name="fundSourceId"
            defaultValue={fundSourceFilter ?? ""}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All sources</option>
            {fundSources.map((fs) => (
              <option key={fs.id} value={fs.id}>
                {fs.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="type" className="text-xs text-muted-foreground">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={typeFilter ?? ""}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          Filter
        </button>

        {(typeFilter !== undefined || fundSourceFilter !== undefined) && (
          <a
            href="?"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </a>
        )}
      </form>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No transactions found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Fund Source</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Running Balance</th>
                <th className="px-4 py-3 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const typeClass =
                  TYPE_COLORS[tx.type] ??
                  "text-muted-foreground bg-muted border-border";
                const typeLabel = TYPE_LABELS[tx.type] ?? tx.type;
                const isCredit = CREDIT_TYPES.has(tx.type);
                return (
                  <tr
                    key={tx.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.transactionDate)}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`../banking/${tx.fundSource.id}/transactions`}
                        className="font-medium hover:underline"
                      >
                        {tx.fundSource.name}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${typeClass}`}
                      >
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {tx.description ?? (tx.category ?? "—")}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${
                        isCredit ? "text-[#00d992]" : "text-red-400"
                      }`}
                    >
                      {isCredit ? "+" : "-"}
                      {formatAmount(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {formatAmount(tx.runningBalance)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {tx.createdBy.displayName ??
                        (`${tx.createdBy.firstName} ${tx.createdBy.lastName}`.trim() ||
                          "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {from}–{to} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?page=${page - 1}${typeFilter !== undefined ? `&type=${typeFilter}` : ""}${fundSourceFilter !== undefined ? `&fundSourceId=${fundSourceFilter}` : ""}`}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted/50"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`?page=${page + 1}${typeFilter !== undefined ? `&type=${typeFilter}` : ""}${fundSourceFilter !== undefined ? `&fundSourceId=${fundSourceFilter}` : ""}`}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted/50"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
