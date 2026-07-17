import type { Metadata } from "next";
import { guardPage } from "@/server/rbac/guard-page";
import { ExpenseCategoriesClient } from "./expense-categories-client";

export const metadata: Metadata = { title: "Expense categories settings" };

export default async function ExpenseCategoriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await guardPage(slug, "settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expense Categories</h1>
        <p className="text-sm text-muted-foreground">
          Categorize expenses for reporting and accounting. Categories are used when creating
          expense records across the workspace.
        </p>
      </div>
      <ExpenseCategoriesClient />
    </div>
  );
}
