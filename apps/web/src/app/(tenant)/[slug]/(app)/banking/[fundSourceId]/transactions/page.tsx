import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { prisma } from "@orqafy/db";
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
import { NewTransactionButton } from "../../transactions/transaction-form";

export const metadata: Metadata = { title: "Account Transactions" };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface PageProps {
  params: Promise<{ slug: string; fundSourceId: string }>;
  searchParams: Promise<{ page?: string; type?: string }>;
}

async function getFundSource(fundSourceId: string, _tenantId: string) {
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
  withdrawal: "text-red-500 bg-red-500/10 border-red-500/30",
  expense: "text-red-500 bg-red-500/10 border-red-500/30",
  transfer_out: "text-orange-500 bg-orange-500/10 border-orange-500/30",
  loan_disbursement: "text-orange-500 bg-orange-500/10 border-orange-500/30",
  loan_repayment: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  credit_card_charge: "text-red-500 bg-red-500/10 border-red-500/30",
  refund: "text-blue-500 bg-blue-500/10 border-blue-500/30",
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
            <Link href="../.." className="hover:text-foreground">
              Banking
            </Link>
            <span>/</span>
            <Link href="../../fund-sources" className="hover:text-foreground">
              Fund Sources
            </Link>
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
              <Badge variant="outline" className="rounded-full border-border bg-muted text-muted-foreground">
                Inactive
              </Badge>
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
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
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
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted/50 focus:outline-hidden focus:ring-1 focus:ring-ring"
        >
          Filter
        </button>

        {typeFilter !== undefined && (
          <Link
            href="?"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Receipt} title="No transactions found." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const typeClass =
                    TYPE_COLORS[tx.type] ??
                    "text-muted-foreground bg-muted border-border";
                  const typeLabel = TYPE_LABELS[tx.type] ?? tx.type;
                  const isCredit = CREDIT_TYPES.has(tx.type);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.transactionDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-full ${typeClass}`}>
                          {typeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {tx.description ?? (tx.category ?? "—")}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-xs ${
                          isCredit ? "text-primary" : "text-red-500"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {formatAmount(tx.amount, fundSource.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatAmount(tx.runningBalance, fundSource.currency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tx.createdBy.displayName ??
                          (`${tx.createdBy.firstName} ${tx.createdBy.lastName}`.trim() ||
                            "—")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {from}–{to} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?page=${page - 1}${typeFilter !== undefined ? `&type=${typeFilter}` : ""}`}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted/50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?page=${page + 1}${typeFilter !== undefined ? `&type=${typeFilter}` : ""}`}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted/50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
