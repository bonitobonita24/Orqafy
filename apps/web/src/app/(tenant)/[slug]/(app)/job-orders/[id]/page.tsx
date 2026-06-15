import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Job Order" };
export const dynamic = "force-dynamic";

function customerLabel(c: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}): string {
  if (c.companyName !== null && c.companyName !== "") return c.companyName;
  return `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
}

function userDisplayName(
  u: { displayName: string | null; firstName: string; lastName: string } | null,
): string {
  if (u === null) return "—";
  return u.displayName ?? `${u.firstName} ${u.lastName}`.trim();
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

const STATUS_ORDER = [
  "received",
  "diagnosing",
  "quoted",
  "approved",
  "in_progress",
  "testing",
  "completed",
  "released",
];

function formatMoney(value: unknown, currency: string): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getJobOrder(id: string, tenantId: string) {
  return prisma.jobOrder.findFirst({
    where: { id, tenantId },
    include: {
      customer: true,
      createdBy: { select: { firstName: true, lastName: true, displayName: true } },
      technician: { select: { firstName: true, lastName: true, displayName: true } },
      parts: { orderBy: { createdAt: "asc" } },
    },
  });
}

function totalParts(parts: { totalPrice: unknown }[]): number {
  return parts.reduce((sum, p) => {
    const n = typeof p.totalPrice === "number" ? p.totalPrice : Number(p.totalPrice);
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);
}

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (tenant === null) notFound();
  const jo = await getJobOrder(id, tenant.id);
  if (jo === null) notFound();

  const currentStepIdx = STATUS_ORDER.indexOf(jo.status);
  const isCancelled = jo.status === "cancelled";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href=".."
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to Job Orders
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{jo.title}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {jo.jobOrderNumber}
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              STATUS_BADGE[jo.status] ?? STATUS_BADGE["received"]
            }`}
          >
            {STATUS_LABELS[jo.status] ?? jo.status}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              PRIORITY_BADGE[jo.priority] ?? PRIORITY_BADGE["medium"]
            }`}
          >
            {jo.priority}
          </span>
        </div>
      </div>

      {!isCancelled && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Progress
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((s, idx) => {
              const reached = idx <= currentStepIdx;
              return (
                <div
                  key={s}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                    reached
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span className="font-mono text-[10px]">{idx + 1}</span>
                  <span>{STATUS_LABELS[s] ?? s}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Customer
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{customerLabel(jo.customer)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{jo.customer.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{jo.customer.phone ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Device
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{jo.deviceType ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Brand</dt>
              <dd>{jo.deviceBrand ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Model</dt>
              <dd>{jo.deviceModel ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Serial #</dt>
              <dd className="font-mono text-xs">{jo.serialNumber ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            People
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created By</dt>
              <dd>{userDisplayName(jo.createdBy)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Technician</dt>
              <dd>
                {jo.technician !== null ? (
                  userDisplayName(jo.technician)
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd>{jo.createdAt.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Completed</dt>
              <dd>
                {jo.completedAt !== null ? jo.completedAt.toLocaleString() : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Released</dt>
              <dd>
                {jo.releasedAt !== null ? jo.releasedAt.toLocaleString() : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Costs
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Estimated</dt>
              <dd className="font-mono text-xs">
                {formatMoney(jo.estimatedCost, jo.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Actual</dt>
              <dd className="font-mono text-xs">
                {formatMoney(jo.actualCost, jo.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Labor</dt>
              <dd className="font-mono text-xs">
                {formatMoney(jo.laborCost, jo.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Warranty</dt>
              <dd>{jo.warranty ?? "—"}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Reported Issue
        </h2>
        <p className="whitespace-pre-wrap text-sm">{jo.reportedIssue}</p>
      </section>

      {jo.description !== "" && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Description
          </h2>
          <p className="whitespace-pre-wrap text-sm">{jo.description}</p>
        </section>
      )}

      {jo.diagnosis !== null && jo.diagnosis !== "" && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Diagnosis
          </h2>
          <p className="whitespace-pre-wrap text-sm">{jo.diagnosis}</p>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">
            Parts
            <span className="ml-2 text-muted-foreground">
              ({jo.parts.length})
            </span>
          </h2>
        </div>
        {jo.parts.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No parts attached.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Unit Price</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {jo.parts.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{p.description}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.isFromInventory ? "Inventory" : "External"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {String(p.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatMoney(p.unitPrice, jo.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                    {formatMoney(p.totalPrice, jo.currency)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/30">
                <td colSpan={4} className="px-4 py-3 text-right font-medium">
                  Parts Total
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                  {formatMoney(totalParts(jo.parts), jo.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
