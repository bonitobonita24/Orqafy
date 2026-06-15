import type { Metadata } from "next";
import Link from "next/link";
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
      <div>
        <Link href={`/${slug}/accounting`} className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to Accounting
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Accounting Settings</h1>
        <p className="text-sm text-muted-foreground">
          Default GL account mapping used to auto-post journal entries on goods receipt and payroll
          (DECISIONS_LOG §B/§C). Until these are set, auto-posting is skipped (goods receipt) or
          blocked with a clear error (payroll).
        </p>
      </div>
      <AccountingSettingsForm />
    </div>
  );
}
