import type { Metadata } from "next";
import Link from "next/link";
import { FiscalYearsClient } from "./fiscal-years-client";

export const metadata: Metadata = { title: "Fiscal Years" };

export default async function FiscalYearsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fiscal Years</h1>
          <p className="text-sm text-muted-foreground">
            Define the accounting periods journal entries post into. A closed fiscal year blocks
            new postings dated within its range.
          </p>
        </div>
        <Link
          href={`/${slug}/accounting`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Accounting
        </Link>
      </div>

      <FiscalYearsClient />
    </div>
  );
}
