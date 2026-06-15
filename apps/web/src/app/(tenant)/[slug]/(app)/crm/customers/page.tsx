import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} active of {customers.length} total
          </p>
        </div>
        <Link
          href={`/${slug}/crm/customers/new`}
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          + New Customer
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {customers.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No customers yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Company / Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
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
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.email !== null && (
                        <div className="text-xs">{c.email}</div>
                      )}
                      {c.phone !== null && (
                        <div className="text-xs">{c.phone}</div>
                      )}
                      {c.email === null && c.phone === null && "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {location ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierClass}`}
                      >
                        {tierLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.isActive ? (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
