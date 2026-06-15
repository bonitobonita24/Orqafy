import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
            {activeOnly ? " — active only" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/purchasing`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            ← Purchase Orders
          </Link>
          <Link
            href={`/${slug}/purchasing/vendors/new`}
            className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            + New Vendor
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-md border border-border bg-card p-1">
        <Link
          href="?filter=active"
          className={`rounded px-3 py-1 text-sm transition-colors ${
            activeOnly
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Active
        </Link>
        <Link
          href="?filter=all"
          className={`rounded px-3 py-1 text-sm transition-colors ${
            !activeOnly
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {vendors.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No vendors found.{" "}
            <Link
              href={`/${slug}/purchasing/vendors/new`}
              className="text-primary hover:underline"
            >
              Create your first vendor.
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Vendor Name</th>
                <th className="px-4 py-3 font-medium">Contact Person</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">POs</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{vendor.companyName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {vendor.contactName !== null ? vendor.contactName : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
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
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {vendor.phone !== null ? vendor.phone : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {vendor._count.purchaseOrders}
                  </td>
                  <td className="px-4 py-3">
                    {vendor.isActive ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${slug}/purchasing/vendors/${vendor.id}/edit`}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
