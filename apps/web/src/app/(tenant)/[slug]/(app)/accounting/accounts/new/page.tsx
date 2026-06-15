import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "../account-form";

export const metadata: Metadata = { title: "New Account" };

export default async function NewAccountPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Account</h1>
          <p className="text-sm text-muted-foreground">Add an account to the chart of accounts.</p>
        </div>
        <Link
          href={`/${slug}/accounting/accounts`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Chart of Accounts
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <AccountForm slug={slug} mode="create" />
      </div>
    </div>
  );
}
