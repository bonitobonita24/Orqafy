import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatutoryRatesClient } from "./statutory-rates-client";

export const metadata: Metadata = { title: "Statutory Rates" };
export const dynamic = "force-dynamic";

export default async function StatutoryRatesPage({
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
        title="Statutory Rates"
        description="PH statutory contribution rates (SSS / PhilHealth / Pag-IBIG / BIR withholding) used by payroll processing. Effective-dated and cited — owner edits annually (D-2 R7)."
      />
      <StatutoryRatesClient slug={slug} />
    </div>
  );
}
