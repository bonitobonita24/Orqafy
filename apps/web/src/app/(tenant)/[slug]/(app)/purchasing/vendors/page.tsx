import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

async function getVendors(activeOnly: boolean) {
  return prisma.vendor.findMany({
    ...(activeOnly ? { where: { isActive: true } } : {}),
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
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const activeOnly = params.filter !== "all";
  const vendors = await getVendors(activeOnly);

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
        <Link
          href="../purchasing"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          ← Purchase Orders
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-md border border-border bg-card p-1">
        <Link
          href="?filter=active"
          className={`rounded px-3 py-1 text-sm transition-colors ${
            activeOnly
              ? "bg-[#00d992]/10 text-[#00d992]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Active
        </Link>
        <Link
          href="?filter=all"
          className={`rounded px-3 py-1 text-sm transition-colors ${
            !activeOnly
              ? "bg-[#00d992]/10 text-[#00d992]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {vendors.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No vendors found.
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
                      <span className="rounded-full border border-[#00d992]/30 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992]">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
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
