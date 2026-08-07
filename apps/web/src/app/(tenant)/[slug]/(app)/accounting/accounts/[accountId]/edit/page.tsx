import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        <PageHeader
          title="System Account"
          actions={
            <Button variant="outline" asChild>
              <Link href={`/${slug}/accounting/accounts`}>← Chart of Accounts</Link>
            </Button>
          }
        />
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="px-6 py-4">
            <p className="text-sm text-amber-400">
              System accounts cannot be edited. They are managed automatically by the platform.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Account"
        description={<span className="font-mono">{account.code} — {account.name}</span>}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/accounting/accounts`}>← Chart of Accounts</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="px-6 py-6">
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-6 py-6">
          <h2 className="mb-4 text-sm font-semibold">Account Status</h2>
          <AccountDeactivateButton accountId={account.id} slug={slug} isActive={account.isActive} />
        </CardContent>
      </Card>
    </div>
  );
}
