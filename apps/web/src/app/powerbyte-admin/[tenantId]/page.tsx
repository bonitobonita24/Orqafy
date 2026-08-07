import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TenantStatusActions } from "./tenant-status-actions";

export const metadata: Metadata = { title: "Tenant — Platform Admin" };

export const dynamic = "force-dynamic";

async function getTenant(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      schemaName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      plan: { select: { name: true, slug: true } },
    },
  });
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);

  if (tenant === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/powerbyte-admin" className="hover:text-foreground">
          Tenants
        </Link>
        <span>/</span>
        <span className="text-foreground">{tenant.name}</span>
      </div>

      <PageHeader
        title={tenant.name}
        description={tenant.slug}
        titleClassName="tracking-tight"
        actions={
          <TenantStatusActions tenantId={tenant.id} status={tenant.status} />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{tenant.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Plan</dt>
                <dd>{tenant.plan?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Schema</dt>
                <dd className="font-mono text-xs">{tenant.schemaName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{tenant.createdAt.toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{tenant.updatedAt.toLocaleDateString()}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Workspace URL</h2>
            <p className="break-all font-mono text-sm text-muted-foreground">
              orqafy.app/{tenant.slug}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
