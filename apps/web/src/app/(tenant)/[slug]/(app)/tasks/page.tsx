import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@orqafy/db";
import { TaskBoard } from "./task-board";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ projectId?: string; view?: string }>;
}

export default async function TasksPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { projectId, view } = await searchParams;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const taskWhere = projectId !== undefined
    ? { tenantId: tenant.id, projectId }
    : { tenantId: tenant.id };

  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
        assignments: {
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true, displayName: true },
            },
          },
        },
      },
    }),
    prisma.project.findMany({
      where: { tenantId: tenant.id, status: { in: ["planning", "active", "on_hold"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  const currentView = view === "calendar" ? "calendar" : "kanban";

  return (
    <div className="space-y-6">
      {/* View switcher — server-rendered nav, stays stable */}
      <div className="flex justify-end">
        <div className="flex gap-1 rounded-md border border-border bg-card p-1 text-sm">
          <Link
            href={`?${projectId !== undefined ? `projectId=${projectId}&` : ""}view=kanban`}
            className={`rounded px-3 py-1 transition-colors ${
              currentView === "kanban"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Kanban
          </Link>
          <Link
            href={`?${projectId !== undefined ? `projectId=${projectId}&` : ""}view=calendar`}
            className={`rounded px-3 py-1 transition-colors ${
              currentView === "calendar"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Calendar
          </Link>
        </div>
      </div>

      {currentView === "calendar" ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Calendar view coming in Phase 2.
        </div>
      ) : (
        <TaskBoard
          slug={slug}
          initialTasks={tasks}
          projects={projects}
          projectId={projectId}
        />
      )}
    </div>
  );
}
