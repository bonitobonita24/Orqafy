import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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
      <PageHeader
        title="Fiscal Years"
        description="Define the accounting periods journal entries post into. A closed fiscal year blocks new postings dated within its range."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/accounting`}>← Accounting</Link>
          </Button>
        }
      />

      <FiscalYearsClient />
    </div>
  );
}
