import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

type ExpenseWhere = { projectId: string; type?: string };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  labor: "Labor",
  materials: "Materials",
  equipment: "Equipment",
  subcontractor: "Subcontractor",
  overhead: "Overhead",
  other: "Other",
};

const EXPENSE_TYPE_COLORS: Record<string, string> = {
  labor: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  materials: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  equipment: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  subcontractor: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  overhead: "text-pink-400 bg-pink-400/10 border-pink-400/30",
  other: "text-muted-foreground bg-muted border-border",
};

async function getProjectHeader(id: string) {
  return prisma.project.findUnique({
    where: { id },
    select: { id: true, projectNumber: true, name: true },
  });
}

async function getExpenseTypeCounts(
  projectId: string,
): Promise<Record<string, number>> {
  const grouped = await prisma.projectExpense.groupBy({
    by: ["type"],
    where: { projectId },
    _count: { id: true },
  });
  const counts: Record<string, number> = {};
  for (const row of grouped) {
    counts[row.type] = row._count.id;
  }
  return counts;
}

async function fetchExpenses(
  _projectId: string,
  page: number,
  where: ExpenseWhere,
) {
  return prisma.projectExpense.findMany({
    where,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      date: true,
    },
  });
}

async function getExpenses(
  projectId: string,
  page: number,
  typeFilter: string | undefined,
): Promise<{
  expenses: Awaited<ReturnType<typeof fetchExpenses>>;
  total: number;
  totalAmount: unknown;
}> {
  const where: ExpenseWhere =
    typeFilter !== undefined ? { projectId, type: typeFilter } : { projectId };

  const [expenses, total, aggregate] = await Promise.all([
    fetchExpenses(projectId, page, where),
    prisma.projectExpense.count({ where }),
    prisma.projectExpense.aggregate({ where, _sum: { amount: true } }),
  ]);

  return { expenses, total, totalAmount: aggregate._sum.amount };
}

function formatAmount(amount: unknown): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDate(date: Date | null | undefined): string {
  if (date === null || date === undefined) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, projectNumber: true },
  });
  if (project === null) return { title: "Expenses" };
  return { title: `Expenses — ${project.projectNumber} ${project.name}` };
}

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ page?: string; type?: string }>;
}

export default async function ProjectExpensesPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, id } = await params;
  const rawParams = await searchParams;
  const page = Math.max(1, Number(rawParams.page ?? "1"));
  const typeFilter =
    rawParams.type !== undefined && rawParams.type !== ""
      ? rawParams.type
      : undefined;

  const [project, typeCounts, { expenses, total, totalAmount }] =
    await Promise.all([
      getProjectHeader(id),
      getExpenseTypeCounts(id),
      getExpenses(id, page, typeFilter),
    ]);

  if (project === null) notFound();

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const expenseTypes = Object.keys(EXPENSE_TYPE_LABELS);

  const buildPageUrl = (p: number, t?: string): string => {
    const parts: string[] = [];
    if (p > 1) parts.push(`page=${p}`);
    if (t !== undefined) parts.push(`type=${t}`);
    return parts.length > 0 ? `?${parts.join("&")}` : "?";
  };

  const allCount = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/${slug}/projects/${id}?tab=expenses`}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← {project.projectNumber} — {project.name}
        </Link>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {total} record{total !== 1 ? "s" : ""}
              {typeFilter !== undefined
                ? ` · filtered by ${EXPENSE_TYPE_LABELS[typeFilter] ?? typeFilter}`
                : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {typeFilter !== undefined ? "Filtered total" : "Total spent"}
            </p>
            <p className="text-2xl font-bold text-primary">
              {totalAmount !== null ? formatAmount(totalAmount) : "₱0.00"}
            </p>
          </div>
        </div>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildPageUrl(1)}
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            typeFilter === undefined
              ? "bg-primary text-[#050507] border-primary"
              : "bg-muted border-border hover:border-primary/50"
          }`}
        >
          All ({allCount})
        </Link>
        {expenseTypes.map((t) => (
          <Link
            key={t}
            href={buildPageUrl(1, t)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              typeFilter === t
                ? "bg-primary text-[#050507] border-primary"
                : "bg-muted border-border hover:border-primary/50"
            }`}
          >
            {EXPENSE_TYPE_LABELS[t] ?? t} ({typeCounts[t] ?? 0})
          </Link>
        ))}
      </div>

      {/* Table */}
      {expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No expenses{typeFilter !== undefined ? " for this type" : ""} yet.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Description
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(expense.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
                        EXPENSE_TYPE_COLORS[expense.type] ??
                        "bg-muted border-border"
                      }`}
                    >
                      {EXPENSE_TYPE_LABELS[expense.type] ?? expense.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {expense.description !== null ? expense.description : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {expense.amount !== null
                      ? formatAmount(expense.amount)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildPageUrl(page - 1, typeFilter)}
                className="px-3 py-1 rounded border border-border hover:border-primary/50 transition-colors"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageUrl(page + 1, typeFilter)}
                className="px-3 py-1 rounded border border-border hover:border-primary/50 transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
