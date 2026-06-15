import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Job Orders" };
export const dynamic = "force-dynamic";

function customerLabel(
  c: { firstName: string | null; lastName: string | null; companyName: string | null } | null,
): string {
  if (c === null) return "—";
  if (c.companyName !== null && c.companyName !== "") return c.companyName;
  return `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
}

function technicianLabel(
  t: { firstName: string; lastName: string; displayName: string | null } | null,
): string {
  if (t === null) return "Unassigned";
  return t.displayName ?? `${t.firstName} ${t.lastName}`.trim();
}

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  diagnosing: "Diagnosing",
  quoted: "Quoted",
  approved: "Approved",
  in_progress: "In Progress",
  testing: "Testing",
  completed: "Completed",
  released: "Released",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<string, string> = {
  received: "border-border bg-muted text-muted-foreground",
  diagnosing: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  quoted: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  approved: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  in_progress: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  testing: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  completed: "border-primary/30 bg-primary/10 text-primary",
  released: "border-primary/30 bg-primary/10 text-primary",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-400",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  urgent: "border-red-500/30 bg-red-500/10 text-red-400",
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "received", label: "Received" },
  { key: "diagnosing", label: "Diagnosing" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "released", label: "Released" },
];

async function getJobOrders(tenantId: string, status: string) {
  return prisma.jobOrder.findMany({
    where: {
      tenantId,
      ...(status !== "all" ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      jobOrderNumber: true,
      title: true,
      status: true,
      priority: true,
      deviceBrand: true,
      deviceModel: true,
      createdAt: true,
      customer: {
        select: { firstName: true, lastName: true, companyName: true },
      },
      technician: {
        select: { firstName: true, lastName: true, displayName: true },
      },
    },
  });
}

export default async function JobOrdersPage({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, searchParamsResolved] = await Promise.all([
    paramsPromise,
    searchParams,
  ]);
  const activeStatus = searchParamsResolved.status ?? "all";

  // Resolve tenant for scoped query — middleware already verifies the slug is
  // valid, but we need the tenantId for the Prisma filter.
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (tenant === null) notFound();

  const jobOrders = await getJobOrders(tenant.id, activeStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Orders</h1>
          <p className="text-sm text-muted-foreground">
            {jobOrders.length} job order{jobOrders.length === 1 ? "" : "s"}
            {activeStatus !== "all" ? ` — ${STATUS_LABELS[activeStatus] ?? activeStatus}` : ""}
          </p>
        </div>
        <Link
          href={`/${slug}/service/job-orders/new`}
          className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          + New Job Order
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?status=${tab.key}`}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              activeStatus === tab.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card">
        {jobOrders.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No job orders found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Job Order #</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Device</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Technician</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobOrders.map((jo) => (
                <tr
                  key={jo.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`job-orders/${jo.id}`}
                      className="font-mono text-xs font-medium text-primary hover:underline"
                    >
                      {jo.jobOrderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{jo.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {customerLabel(jo.customer)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {jo.deviceBrand !== null || jo.deviceModel !== null
                      ? `${jo.deviceBrand ?? ""} ${jo.deviceModel ?? ""}`.trim() || "—"
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[jo.status] ?? STATUS_BADGE["received"]
                      }`}
                    >
                      {STATUS_LABELS[jo.status] ?? jo.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        PRIORITY_BADGE[jo.priority] ?? PRIORITY_BADGE["medium"]
                      }`}
                    >
                      {jo.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {technicianLabel(jo.technician)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {jo.createdAt.toLocaleDateString()}
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
