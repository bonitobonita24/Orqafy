import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListTodo, Receipt, Milestone as MilestoneIcon } from "lucide-react";
import { prisma } from "@orqafy/db";
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
import { ProjectActions } from "./project-actions";
import { MilestoneActions } from "./milestone-actions";
import { AddMilestoneForm } from "./add-milestone-form";
import { ProjectAttachments } from "./project-attachments";

export const dynamic = "force-dynamic";

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

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground bg-muted border-border",
  medium: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  high: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  critical: "text-red-400 bg-red-400/10 border-red-400/30",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "text-muted-foreground bg-muted border-border",
  in_progress: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  review: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  done: "text-primary bg-primary/10 border-primary/30",
  blocked: "text-red-400 bg-red-400/10 border-red-400/30",
};

const TABS = ["overview", "tasks", "expenses", "milestones"] as const;
type Tab = (typeof TABS)[number];

function isValidTab(value: string | undefined): value is Tab {
  return value !== undefined && (TABS as readonly string[]).includes(value);
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

async function getProject(id: string, tenantId: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      projectNumber: true,
      name: true,
      description: true,
      status: true,
      priority: true,
      budget: true,
      startDate: true,
      targetEndDate: true,
      actualEndDate: true,
      createdAt: true,
      customerId: true,
      manager: {
        select: { firstName: true, lastName: true, displayName: true },
      },
    },
  });
  if (project === null || project.tenantId !== tenantId) return null;
  return project;
}

async function getCustomer(customerId: string | null, tenantId: string) {
  if (customerId === null) return null;
  return prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
    },
  });
}

async function getTasks(projectId: string) {
  return prisma.task.findMany({
    where: { projectId },
    take: 50,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      milestone: {
        select: { name: true },
      },
    },
  });
}

async function getExpenseSummary(projectId: string) {
  const [expenses, aggregate] = await Promise.all([
    prisma.projectExpense.findMany({
      where: { projectId },
      take: 5,
      orderBy: { date: "desc" },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        date: true,
      },
    }),
    prisma.projectExpense.aggregate({
      where: { projectId },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);
  return { expenses, total: aggregate._sum.amount, count: aggregate._count.id };
}

async function getMilestones(projectId: string) {
  return prisma.milestone.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      dueDate: true,
      completedAt: true,
      progress: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (tenant === null) return { title: "Project Not Found" };
  const project = await prisma.project.findFirst({
    where: { id, tenantId: tenant.id },
    select: { name: true, projectNumber: true },
  });
  if (project === null) return { title: "Project Not Found" };
  return { title: `${project.projectNumber} — ${project.name}` };
}

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, id } = await params;
  const rawParams = await searchParams;
  const activeTab: Tab = isValidTab(rawParams.tab) ? rawParams.tab : "overview";

  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (tenant === null) notFound();

  const project = await getProject(id, tenant.id);
  if (project === null) notFound();

  const customer = await getCustomer(project.customerId, tenant.id);

  // Conditionally fetch tab data
  const tasks =
    activeTab === "tasks" ? await getTasks(id) : null;
  const expenseSummary =
    activeTab === "expenses" ? await getExpenseSummary(id) : null;
  const milestones =
    activeTab === "milestones" ? await getMilestones(id) : null;

  const buildTabUrl = (tab: Tab): string => `?tab=${tab}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/${slug}/projects`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Projects
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {project.projectNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`rounded-full ${STATUS_COLORS[project.status] ?? "bg-muted border-border"}`}
          >
            {STATUS_LABELS[project.status] ?? project.status}
          </Badge>
          <Badge
            variant="outline"
            className={`rounded-full ${PRIORITY_COLORS[project.priority] ?? "bg-muted border-border"}`}
          >
            {PRIORITY_LABELS[project.priority] ?? project.priority}
          </Badge>
          <ProjectActions projectId={project.id} status={project.status} slug={slug} />
        </div>
      </div>

      {/* Tab chips */}
      <div className="flex gap-2 border-b border-border pb-0">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={buildTabUrl(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize rounded-t-md border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab.replace("_", " ")}
          </Link>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 4-card grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Status & Priority card */}
            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </p>
                <Badge
                  variant="outline"
                  className={`rounded-full ${STATUS_COLORS[project.status] ?? "bg-muted border-border"}`}
                >
                  {STATUS_LABELS[project.status] ?? project.status}
                </Badge>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
                  Priority
                </p>
                <Badge
                  variant="outline"
                  className={`rounded-full ${PRIORITY_COLORS[project.priority] ?? "bg-muted border-border"}`}
                >
                  {PRIORITY_LABELS[project.priority] ?? project.priority}
                </Badge>
              </CardContent>
            </Card>

            {/* Budget card */}
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Budget
                </p>
                <p className="text-xl font-semibold">
                  {project.budget !== null
                    ? formatAmount(project.budget)
                    : "—"}
                </p>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: "0%" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">0% spent</p>
              </CardContent>
            </Card>

            {/* Dates card */}
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Timeline
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Start</span>
                    <span>{formatDate(project.startDate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Target end</span>
                    <span>{formatDate(project.targetEndDate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Actual end</span>
                    <span>{formatDate(project.actualEndDate)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer card */}
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Customer
                </p>
                <p className="text-sm font-medium">
                  {getCustomerName(customer)}
                </p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
                  Manager
                </p>
                <p className="text-sm font-medium">
                  {getManagerName(project.manager)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {project.description !== null && project.description !== "" && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Description
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {project.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          <Card>
            <CardContent className="p-4">
              <ProjectAttachments projectId={project.id} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tasks tab */}
      {activeTab === "tasks" && tasks !== null && (
        <Card>
          <CardContent className="p-0">
            {tasks.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={ListTodo} title="No tasks yet." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${TASK_STATUS_COLORS[task.status] ?? "bg-muted border-border"}`}
                        >
                          {TASK_STATUS_LABELS[task.status] ?? task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full ${PRIORITY_COLORS[task.priority] ?? "bg-muted border-border"}`}
                        >
                          {PRIORITY_LABELS[task.priority] ?? task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {task.milestone !== null
                          ? task.milestone.name
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(task.dueDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expenses tab */}
      {activeTab === "expenses" && expenseSummary !== null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total Spent
              </p>
              <p className="text-2xl font-semibold">
                {expenseSummary.total !== null
                  ? formatAmount(expenseSummary.total)
                  : "₱0.00"}
              </p>
              <p className="text-sm text-muted-foreground">
                {expenseSummary.count} expense
                {expenseSummary.count !== 1 ? "s" : ""} total
              </p>
            </div>
            <Link
              href={`/${slug}/projects/${id}/expenses`}
              className="px-4 py-2 rounded-md border border-border text-sm hover:border-primary/50 transition-colors"
            >
              View All Expenses →
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              {expenseSummary.expenses.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Receipt} title="No expenses yet." />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseSummary.expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="text-muted-foreground">
                          {formatDate(expense.date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="rounded-full bg-muted border-border text-muted-foreground"
                          >
                            {expense.type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(expense.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Milestones tab */}
      {activeTab === "milestones" && milestones !== null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {milestones.length} milestone{milestones.length !== 1 ? "s" : ""}
            </p>
          </div>
          <AddMilestoneForm projectId={id} />
          {milestones.length === 0 ? (
            <EmptyState icon={MilestoneIcon} title="No milestones yet." />
          ) : (
            <div className="space-y-3">
              {milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${milestone.completedAt !== null ? "bg-primary" : "bg-muted-foreground"}`}
                      />
                      <p className="font-medium text-sm">{milestone.name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {milestone.completedAt !== null ? (
                          <span className="text-xs text-primary">
                            Completed {formatDate(milestone.completedAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Due {formatDate(milestone.dueDate)}
                          </span>
                        )}
                      </div>
                      <MilestoneActions
                        milestoneId={milestone.id}
                        isCompleted={milestone.completedAt !== null}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{milestone.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${milestone.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
