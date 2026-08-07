import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ExpenseListClient } from "./expense-list-client";

export const metadata: Metadata = { title: "Expenses" };

export const dynamic = "force-dynamic";

async function getExpenses(tenantId: string) {
  return prisma.expense.findMany({
    where: { tenantId },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true,
      expenseNumber: true,
      description: true,
      amount: true,
      currency: true,
      date: true,
      status: true,
      expenseCategory: {
        select: { name: true, code: true },
      },
      createdBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });
}

function formatCurrency(amount: unknown, currency: string): string {
  const num = typeof amount === "object" && amount !== null && "toNumber" in amount
    ? (amount as { toNumber: () => number }).toNumber()
    : Number(amount);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();
  const expenses = await getExpenses(tenant.id);

  const pending = expenses.filter((e) => e.status === "pending");
  const pendingTotal = pending.reduce((sum, e) => sum + Number(e.amount), 0);
  const approvedCount = expenses.filter((e) => e.status === "approved" || e.status === "reimbursed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={
          <>
            {expenses.length} total · {approvedCount} approved ·{" "}
            <span className="text-foreground">
              {pending.length} pending ({formatCurrency(pendingTotal, "PHP")})
            </span>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          <ExpenseListClient expenses={expenses} />
        </CardContent>
      </Card>
    </div>
  );
}
