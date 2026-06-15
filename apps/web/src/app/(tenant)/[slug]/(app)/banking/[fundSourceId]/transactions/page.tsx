import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { NewTransactionButton } from "../../transactions/transaction-form";

export const metadata: Metadata = { title: "Account Transactions" };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface PageProps {
  params: Promise<{ slug: string; fundSourceId: string }>;
  searchParams: Promise<{ page?: string; type?: string }>;
}

async function getFundSource(fundSourceId: string, tenantId: string) {
  return prisma.fundSource.findUnique({
    where: { id: fundSourceId },
    select: {
      id: true,
      name: true,
      type: true,
      currentBalance: true,
      currency: true,
      bankName: true,
      accountNumber: true,
      isActive: true,
      tenantId: true,
    },
  });
}

async function getTransactions(tenantId: string, fundSourceId: string, page: number, type?: string) {
  const skip = (page - 1) * PAGE_SIZE;
  const where = {
    tenantId,
    fundSourceId,
    ...(type !== undefined && { type }),
  };

  const [transactions, total] = await Promise.all([
    prisma.fundTransaction.findMany({
      // tenant-scoped: prevents cross-tenant data leak
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
        createdBy: { select: { firstName: true, lastName: true, displayName: true } },
      },
    }),
    prisma.fundTransaction.count({ where }), // tenant-scoped: prevents cross-tenant data leak
  ]);

  return { transactions, total };
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
  deposit: "text-primary bg-primary/10 border-primary/30",
  income: "text-primary bg-primary/10 border-primary/30",
  transfer_in: "text-primary bg-primary/10 border-primary/30",
  loan_payback: "text-primary bg-primary/10 border-primary/30",
  credit_card_payment: "text-primary bg-primary/10 border-primary/30",
  withdrawal: "text-red-400 bg-red-400/10 border-red-400/30",
  expense: "text-red-400 bg-red-400/10 border-red-400/30",
  transfer_out: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  loan_disbursement: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  loan_repayment: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  credit_card_charge: "text-red-400 bg-red-400/10 border-red-400/30",
  refund: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  adjustment: "text-muted-foreground bg-muted border-border",
};

const FUND_SOURCE_TYPE_LABELS: Record<string, string> = {
  cash_on_hand: "Cash on Hand",
  e_wallet: "E-Wallet",
  bank: "Bank Account",
  credit_card: "Credit Card",
  loan: "Loan",
};

function formatAmount(amount: unknown, currency: string): string {
  const num = Number(amount);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
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

export default async function AccountTransactionsPage({ params, searchParams }: PageProps) {
  const { slug, fundSourceId } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1"));
  const typeFilter = sp.type ?? undefined;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const [fundSource, { transactions, total }] = await Promise.all([
    getFundSource(fundSourceId, tenant.id),
    getTransactions(tenant.id, fundSourceId, page, typeFilter),
  ]);

  // tenant-scoped: prevents cross-tenant data leak
  if (!fundSource || fundSource.tenantId !== tenant.id) {
    notFound();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <a href="../.." className="hover:text-foreground">
              Banking
            </a>
            <span>/</span>
            <a href="../../fund-sources" className="hover:text-foreground">
              Fund Sources
            </a>
            <span>/</span>
            <span>{fundSource.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{fundSource.name}</h1>
          <p className="text-sm text-muted-foreground">
            {FUND_SOURCE_TYPE_LABELS[fundSource.type] ?? fundSource.type}
            {fundSource.bankName !== null && ` · ${fundSource.bankName}`}
            {fundSource.accountNumber !== null && ` · ${fundSource.accountNumber}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <NewTransactionButton prefillFundSourceId={fundSource.id} />
          <div className="text-right">
          <div className="text-xs text-muted-foreground mb-1">Current Balance</div>
          <div className="text-2xl font-mono font-semibold">
            {formatAmount(fundSource.currentBalance, fundSource.currency)}
          </div>
          {!fundSource.isActive && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Inactive
            </span>
          )}
          </div>
        </div>
      </div>

      {/* Filter */}
      <form className="flex flex-wrap gap-3">
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

        {typeFilter !== undefined && (
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
                        isCredit ? "text-primary" : "text-red-400"
                      }`}
                    >
                      {isCredit ? "+" : "-"}
                      {formatAmount(tx.amount, fundSource.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {formatAmount(tx.runningBalance, fundSource.currency)}
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
                href={`?page=${page - 1}${typeFilter !== undefined ? `&type=${typeFilter}` : ""}`}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted/50"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`?page=${page + 1}${typeFilter !== undefined ? `&type=${typeFilter}` : ""}`}
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
