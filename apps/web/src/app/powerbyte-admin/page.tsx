import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

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

const STATUS_COLORS: Record<string, string> = {
  active: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  provisioning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  suspended: "text-destructive bg-destructive/10 border-destructive/30",
  demo: "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

export default async function PlatformAdminPage() {
  const tenants = await getAllTenants();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            {tenants.length} workspace{tenants.length !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {tenants.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No tenants yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Workspace</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const statusClass =
                  STATUS_COLORS[tenant.status] ??
                  "text-muted-foreground bg-muted border-border";
                return (
                  <tr
                    key={tenant.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{tenant.name}</div>
                      <div className="font-code text-xs text-muted-foreground">
                        {tenant.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tenant.plan?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tenant.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/powerbyte-admin/${tenant.id}`}
                        className="text-xs text-[#00d992] hover:underline"
                      >
                        Manage →
                      </Link>
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
