import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderKanban } from "lucide-react";
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

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  planning: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  active: "text-primary bg-primary/10 border-primary/30",
  on_hold: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  completed: "text-muted-foreground bg-muted border-border",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/30",
};

async function getTenantId(slug: string): Promise<string | null> {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return t?.id ?? null;
}

async function getStatusCounts(tenantId: string): Promise<Record<string, number>> {
  const grouped = await prisma.project.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { id: true },
  });
  const counts: Record<string, number> = {
    planning: 0,
    active: 0,
    on_hold: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of grouped) {
    counts[row.status] = row._count.id;
  }
  return counts;
}

type CustomerSummary = {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
};

async function fetchProjects(
  page: number,
  where: { tenantId: string; status?: string },
) {
  return prisma.project.findMany({
    where,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      projectNumber: true,
      name: true,
      status: true,
      priority: true,
      budget: true,
      targetEndDate: true,
      customerId: true,
      manager: {
        select: { firstName: true, lastName: true, displayName: true },
      },
    },
  });
}

async function getProjects(
  tenantId: string,
  page: number,
  status: string | undefined,
): Promise<{
  projects: Awaited<ReturnType<typeof fetchProjects>>;
  total: number;
  customerMap: Map<string, CustomerSummary>;
}> {
  const where: { tenantId: string; status?: string } =
    status !== undefined ? { tenantId, status } : { tenantId };

  const [projects, total] = await Promise.all([
    fetchProjects(page, where),
    prisma.project.count({ where }),
  ]);

  const customerIds = projects
    .map((p) => p.customerId)
    .filter((id): id is string => id !== null);
  const customers =
    customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds }, tenantId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        })
      : [];
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  return { projects, total, customerMap };
}

function formatAmount(amount: unknown): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDate(date: Date | null | undefined): string {
  if (date === null || date === undefined) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function getCustomerName(
  customer: {
    firstName: string;
    lastName: string;
    companyName: string | null;
  } | null,
): string {
  if (customer === null) return "—";
  if (customer.companyName !== null && customer.companyName !== "")
    return customer.companyName;
  return `${customer.firstName} ${customer.lastName}`;
}

function getManagerName(manager: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}): string {
  if (manager.displayName !== null) return manager.displayName;
  return `${manager.firstName} ${manager.lastName}`;
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function ProjectsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const rawParams = await searchParams;
  const page = Math.max(1, Number(rawParams.page ?? "1"));
  const statusFilter =
    rawParams.status !== undefined && rawParams.status !== ""
      ? rawParams.status
      : undefined;

  const tenantId = await getTenantId(slug);
  if (tenantId === null) notFound();

  const [statusCounts, projectsResult] = await Promise.all([
    getStatusCounts(tenantId),
    getProjects(tenantId, page, statusFilter),
  ]);
  const { projects, total, customerMap } = projectsResult;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const statuses = [
    "planning",
    "active",
    "on_hold",
    "completed",
    "cancelled",
  ] as const;

  const buildPageUrl = (p: number, s?: string): string => {
    const parts: string[] = [];
    if (p > 1) parts.push(`page=${p}`);
    if (s !== undefined) parts.push(`status=${s}`);
    return parts.length > 0 ? `?${parts.join("&")}` : "?";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`${total} project${total !== 1 ? "s" : ""} total`}
        actions={
          <Button asChild>
            <Link href={`/${slug}/projects/new`}>New Project</Link>
          </Button>
        }
      />

      {/* Status counts chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="?"
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            statusFilter === undefined
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted border-border hover:border-primary/50"
          }`}
        >
          All (
          {Object.values(statusCounts).reduce((a, b) => a + b, 0)})
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={buildPageUrl(1, s)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted border-border hover:border-primary/50"
            }`}
          >
            {STATUS_LABELS[s]} ({statusCounts[s] ?? 0})
          </Link>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {projects.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FolderKanban}
                title="No projects yet."
                action={
                  <Button asChild>
                    <Link href={`/${slug}/projects/new`}>
                      Create your first project
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead>Target End</TableHead>
                  <TableHead>Manager</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {project.projectNumber}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/${slug}/projects/${project.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getCustomerName(
                        project.customerId !== null
                          ? customerMap.get(project.customerId) ?? null
                          : null,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${STATUS_COLORS[project.status] ?? "bg-muted border-border"}`}
                      >
                        {STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {project.budget !== null
                        ? formatAmount(project.budget)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(project.targetEndDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getManagerName(project.manager)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildPageUrl(page - 1, statusFilter)}
                className="px-3 py-1 rounded border border-border hover:border-primary/50 transition-colors"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageUrl(page + 1, statusFilter)}
                className="px-3 py-1 rounded border border-border hover:border-primary/50 transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
