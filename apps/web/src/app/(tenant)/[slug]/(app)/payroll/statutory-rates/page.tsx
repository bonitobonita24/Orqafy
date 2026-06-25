import type { Metadata } from "next";
import Link from "next/link";
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
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Statutory Rates</h1>
        <p className="text-sm text-muted-foreground">
          PH statutory contribution rates (SSS / PhilHealth / Pag-IBIG / BIR withholding) used by
          payroll processing. Effective-dated and cited — owner edits annually (D-2 R7).
        </p>
      </div>
      <StatutoryRatesClient slug={slug} />
    </div>
  );
}
