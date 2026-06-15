import type { Metadata } from "next";
import Link from "next/link";
import { PayrollRunForm } from "../payroll-run-form";

export const metadata: Metadata = { title: "New Payroll Run" };

export default async function NewPayrollRunPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${slug}/payroll`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to Payroll
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">New Payroll Run</h1>
        <p className="text-sm text-muted-foreground">
          Create a draft payroll run. Add payslips manually after creation.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <PayrollRunForm slug={slug} mode="create" />
      </div>
    </div>
  );
}
