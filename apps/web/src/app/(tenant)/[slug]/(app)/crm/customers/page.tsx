import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "@/components/ui/icons";
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

export const metadata: Metadata = { title: "Customers" };

export const dynamic = "force-dynamic";

async function getCustomers(tenantId: string) {
  return prisma.customer.findMany({
    where: { tenantId },
    orderBy: { companyName: "asc" },
    select: {
      id: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      city: true,
      province: true,
      tier: true,
      isActive: true,
    },
  });
}

const TIER_LABELS: Record<string, string> = {
  regular: "Regular",
  vip: "VIP",
  authorized_dealer: "Authorized Dealer",
};

const TIER_COLORS: Record<string, string> = {
  regular: "text-muted-foreground bg-muted border-border",
  vip: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  authorized_dealer: "text-primary bg-primary/10 border-primary/30",
};

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();
  const customers = await getCustomers(tenant.id);
  const active = customers.filter((c) => c.isActive);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${active.length} active of ${customers.length} total`}
        actions={
          <Button asChild>
            <Link href={`/${slug}/crm/customers/new`}>+ New Customer</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {customers.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Users} title="No customers yet." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company / Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => {
                  const tierClass =
                    TIER_COLORS[c.tier] ??
                    "text-muted-foreground bg-muted border-border";
                  const tierLabel = TIER_LABELS[c.tier] ?? c.tier;
                  const fullName = `${c.firstName} ${c.lastName}`;
                  const location =
                    c.city !== null && c.province !== null
                      ? `${c.city}, ${c.province}`
                      : c.city !== null
                        ? c.city
                        : c.province !== null
                          ? c.province
                          : null;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/${slug}/crm/customers/${c.id}`}
                          className="hover:underline"
                        >
                          {c.companyName !== null ? (
                            <>
                              <div className="font-medium text-primary">
                                {c.companyName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {fullName}
                              </div>
                            </>
                          ) : (
                            <div className="font-medium text-primary">
                              {fullName}
                            </div>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.email !== null && (
                          <div className="text-xs">{c.email}</div>
                        )}
                        {c.phone !== null && (
                          <div className="text-xs">{c.phone}</div>
                        )}
                        {c.email === null && c.phone === null && "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {location ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${tierClass}`}
                        >
                          {tierLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.isActive ? (
                          <Badge
                            variant="outline"
                            className="rounded-full border-primary/30 bg-primary/10 text-primary"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full border-border bg-muted text-muted-foreground"
                          >
                            Inactive
                          </Badge>
                        )}
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
