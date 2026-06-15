import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { AccountForm } from "../../account-form";
import { AccountDeactivateButton } from "./account-deactivate-button";

export const metadata: Metadata = { title: "Edit Account" };
export const dynamic = "force-dynamic";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ slug: string; accountId: string }>;
}) {
  const { slug, accountId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) notFound();

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      subtype: true,
      description: true,
      isActive: true,
      isSystem: true,
      tenantId: true,
    },
  });

  if (!account || account.tenantId !== tenant.id) notFound();
  if (account.isSystem) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">System Account</h1>
          <Link
            href={`/${slug}/accounting/accounts`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            ← Chart of Accounts
          </Link>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-6 py-4 text-sm text-amber-400">
          System accounts cannot be edited. They are managed automatically by the platform.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Account</h1>
          <p className="text-sm text-muted-foreground font-mono">{account.code} — {account.name}</p>
        </div>
        <Link
          href={`/${slug}/accounting/accounts`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Chart of Accounts
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <AccountForm
          slug={slug}
          mode="edit"
          accountId={account.id}
          initial={{
            code: account.code,
            name: account.name,
            type: account.type as "asset" | "liability" | "equity" | "revenue" | "expense",
            subtype: account.subtype ?? undefined,
            description: account.description ?? undefined,
          }}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold">Account Status</h2>
        <AccountDeactivateButton accountId={account.id} slug={slug} isActive={account.isActive} />
      </div>
    </div>
  );
}
