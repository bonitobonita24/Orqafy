import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wrench } from "@/components/ui/icons";
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

  // Resolve tenant to scope the query — middleware already validates the slug,
  // but we need the tenantId for the Prisma where clause.
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (tenant === null) notFound();

  const jobOrders = await getJobOrders(tenant.id, activeStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Orders"
        description={`${jobOrders.length} job order${jobOrders.length === 1 ? "" : "s"}${
          activeStatus !== "all" ? ` — ${STATUS_LABELS[activeStatus] ?? activeStatus}` : ""
        }`}
        actions={
          <Button asChild>
            <Link href={`/${slug}/service/job-orders/new`}>+ New Job Order</Link>
          </Button>
        }
      />

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

      <Card>
        <CardContent className="p-0">
          {jobOrders.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Wrench} title="No job orders found." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Order #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobOrders.map((jo) => (
                  <TableRow key={jo.id}>
                    <TableCell>
                      <Link
                        href={`job-orders/${jo.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {jo.jobOrderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{jo.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {customerLabel(jo.customer)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {jo.deviceBrand !== null || jo.deviceModel !== null
                        ? `${jo.deviceBrand ?? ""} ${jo.deviceModel ?? ""}`.trim() || "—"
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${STATUS_BADGE[jo.status] ?? STATUS_BADGE["received"]}`}
                      >
                        {STATUS_LABELS[jo.status] ?? jo.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${PRIORITY_BADGE[jo.priority] ?? PRIORITY_BADGE["medium"]}`}
                      >
                        {jo.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {technicianLabel(jo.technician)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {jo.createdAt.toLocaleDateString()}
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
