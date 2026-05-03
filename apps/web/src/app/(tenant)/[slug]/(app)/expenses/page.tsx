import type { Metadata } from "next";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
      <p className="text-muted-foreground">Expense tracking — Phase 8</p>
    </div>
  );
}
