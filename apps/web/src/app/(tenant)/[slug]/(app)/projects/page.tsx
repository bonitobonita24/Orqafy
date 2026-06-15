import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

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

async function getStatusCounts(): Promise<Record<string, number>> {
  const grouped = await prisma.project.groupBy({
    by: ["status"],
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

async function fetchProjects(page: number, where: { status?: string }) {
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
  page: number,
  status: string | undefined,
): Promise<{
  projects: Awaited<ReturnType<typeof fetchProjects>>;
  total: number;
  customerMap: Map<string, CustomerSummary>;
}> {
  const where: { status?: string } = status !== undefined ? { status } : {};

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
          where: { id: { in: customerIds } },
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

  const [statusCounts, projectsResult] = await Promise.all([
    getStatusCounts(),
    getProjects(page, statusFilter),
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} project{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link
          href={`/${slug}/projects/new`}
          className="px-4 py-2 rounded-md bg-primary text-[#050507] text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          New Project
        </Link>
      </div>

      {/* Status counts chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="?"
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            statusFilter === undefined
              ? "bg-primary text-[#050507] border-primary"
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
                ? "bg-primary text-[#050507] border-primary"
                : "bg-muted border-border hover:border-primary/50"
            }`}
          >
            {STATUS_LABELS[s]} ({statusCounts[s] ?? 0})
          </Link>
        ))}
      </div>

      {/* Table */}
      {projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No projects yet.</p>
          <Link
            href={`/${slug}/projects/new`}
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            Create your first project →
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Project #
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Customer
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Budget
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Target End
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Manager
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {project.projectNumber}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/projects/${project.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {getCustomerName(
                      project.customerId !== null
                        ? customerMap.get(project.customerId) ?? null
                        : null,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[project.status] ?? "bg-muted border-border"}`}
                    >
                      {STATUS_LABELS[project.status] ?? project.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {project.budget !== null
                      ? formatAmount(project.budget)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(project.targetEndDate)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {getManagerName(project.manager)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
