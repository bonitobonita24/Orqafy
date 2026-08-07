import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
      </div>
      <PageHeader
        title="New Payroll Run"
        description="Create a draft payroll run. Add payslips manually after creation."
      />

      <Card>
        <CardContent className="p-6">
          <PayrollRunForm slug={slug} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
