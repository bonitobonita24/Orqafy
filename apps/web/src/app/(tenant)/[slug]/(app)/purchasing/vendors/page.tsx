import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
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

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

async function getVendors(tenantId: string, activeOnly: boolean) {
  return prisma.vendor.findMany({
    // tenant-scoped: prevents cross-tenant data leak
    where: activeOnly ? { tenantId, isActive: true } : { tenantId },
    orderBy: { companyName: "asc" },
    select: {
      id: true,
      companyName: true,
      contactName: true,
      email: true,
      phone: true,
      isActive: true,
      _count: { select: { purchaseOrders: true } },
    },
  });
}

export default async function VendorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const activeOnly = sp.filter !== "all";

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return <div>Tenant not found</div>;

  const vendors = await getVendors(tenant.id, activeOnly);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description={`${vendors.length} vendor${vendors.length === 1 ? "" : "s"}${
          activeOnly ? " — active only" : ""
        }`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`/${slug}/purchasing`}>← Purchase Orders</Link>
            </Button>
            <Button asChild>
              <Link href={`/${slug}/purchasing/vendors/new`}>+ New Vendor</Link>
            </Button>
          </>
        }
      />

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="?filter=active"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            activeOnly
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          Active
        </Link>
        <Link
          href="?filter=all"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            !activeOnly
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {vendors.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Building2}
                title="No vendors found."
                action={
                  <Button asChild>
                    <Link href={`/${slug}/purchasing/vendors/new`}>Create your first vendor</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>POs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.companyName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor.contactName !== null ? vendor.contactName : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor.email !== null ? (
                        <a
                          href={`mailto:${vendor.email}`}
                          className="hover:text-foreground hover:underline"
                        >
                          {vendor.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor.phone !== null ? vendor.phone : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {vendor._count.purchaseOrders}
                    </TableCell>
                    <TableCell>
                      {vendor.isActive ? (
                        <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-border bg-muted text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/${slug}/purchasing/vendors/${vendor.id}/edit`}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
