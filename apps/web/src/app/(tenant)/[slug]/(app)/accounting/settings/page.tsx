import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AccountingSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Accounting Settings" };
export const dynamic = "force-dynamic";

export default async function AccountingSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting Settings"
        description="Default GL account mapping used to auto-post journal entries on goods receipt and payroll (DECISIONS_LOG §B/§C). Until these are set, auto-posting is skipped (goods receipt) or blocked with a clear error (payroll)."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/accounting`}>← Accounting</Link>
          </Button>
        }
      />
      <AccountingSettingsForm />
    </div>
  );
}
