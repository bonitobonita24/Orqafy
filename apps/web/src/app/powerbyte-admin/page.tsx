import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "@/components/ui/icons";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Platform Admin — Orqafy" };

export const dynamic = "force-dynamic";

async function getAllTenants() {
  return prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      createdAt: true,
      plan: { select: { name: true } },
    },
  });
}

const STATUS_BADGE: Record<string, string> = {
  active: "border-primary/30 bg-primary/10 text-primary",
  provisioning: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400",
  suspended: "border-destructive/30 bg-destructive/10 text-destructive",
  demo: "border-blue-400/30 bg-blue-400/10 text-blue-400",
};

export default async function PlatformAdminPage() {
  const tenants = await getAllTenants();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description={`${tenants.length} workspace${tenants.length !== 1 ? "s" : ""} total`}
      />

      <Card>
        <CardContent className="p-0">
          {tenants.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Building2} title="No tenants yet." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => {
                  const statusClass =
                    STATUS_BADGE[tenant.status] ??
                    "border-border bg-muted text-muted-foreground";
                  return (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div className="font-medium">{tenant.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {tenant.slug}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tenant.plan?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full capitalize ${statusClass}`}
                        >
                          {tenant.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tenant.createdAt.toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/powerbyte-admin/${tenant.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Manage →
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
