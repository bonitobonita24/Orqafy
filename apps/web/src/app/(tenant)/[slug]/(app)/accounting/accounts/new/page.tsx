import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <PageHeader
        title="New Account"
        description="Add an account to the chart of accounts."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${slug}/accounting/accounts`}>← Chart of Accounts</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="px-6 py-6">
          <AccountForm slug={slug} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
