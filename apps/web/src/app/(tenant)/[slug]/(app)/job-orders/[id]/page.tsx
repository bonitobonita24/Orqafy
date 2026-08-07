import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <div>
        <Link
          href=".."
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to Job Orders
        </Link>
        <PageHeader
          className="mt-1"
          title={jo.title}
          description={
            <span className="font-mono text-xs">{jo.jobOrderNumber}</span>
          }
          actions={
            <>
              <Badge
                variant="outline"
                className={`rounded-full ${STATUS_BADGE[jo.status] ?? STATUS_BADGE["received"]}`}
              >
                {STATUS_LABELS[jo.status] ?? jo.status}
              </Badge>
              <Badge
                variant="outline"
                className={`rounded-full ${PRIORITY_BADGE[jo.priority] ?? PRIORITY_BADGE["medium"]}`}
              >
                {jo.priority}
              </Badge>
            </>
          }
        />
      </div>

      {!isCancelled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Device
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              People
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Reported Issue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{jo.reportedIssue}</p>
        </CardContent>
      </Card>

      {jo.description !== "" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{jo.description}</p>
          </CardContent>
        </Card>
      )}

      {jo.diagnosis !== null && jo.diagnosis !== "" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Diagnosis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{jo.diagnosis}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Parts
            <span className="ml-2 text-muted-foreground">({jo.parts.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {jo.parts.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No parts attached.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jo.parts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.isFromInventory ? "Inventory" : "External"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {String(p.quantity)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(p.unitPrice, jo.currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatMoney(p.totalPrice, jo.currency)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={4} className="text-right font-medium">
                    Parts Total
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {formatMoney(totalParts(jo.parts), jo.currency)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
