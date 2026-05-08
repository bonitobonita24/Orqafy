import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@orqafy/db";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  project: { id: string; name: string };
  assignments: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      displayName: string | null;
    };
  }[];
};

const COLUMNS: { key: string; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
  { key: "blocked", label: "Blocked" },
];

const PRIORITY_BADGE: Record<string, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-border bg-muted text-foreground",
  high: "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992]",
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
};

const TASK_SELECT = {
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
} as const;

async function getTasks(projectId: string | undefined): Promise<TaskRow[]> {
  if (projectId !== undefined) {
    return prisma.task.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: TASK_SELECT,
    });
  }
  return prisma.task.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: TASK_SELECT,
  });
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; view?: string }>;
}) {
  const params = await searchParams;
  const tasks = await getTasks(params.projectId);
  const view = params.view === "calendar" ? "calendar" : "kanban";

  const grouped: Record<string, TaskRow[]> = Object.fromEntries(
    COLUMNS.map((c) => [c.key, []]),
  );
  for (const t of tasks) {
    const bucket = grouped[t.status] ?? grouped["todo"]!;
    bucket.push(t);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
            {params.projectId !== undefined ? " in this project" : " across all projects"}
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-card p-1 text-sm">
          <Link
            href={`?${params.projectId !== undefined ? `projectId=${params.projectId}&` : ""}view=kanban`}
            className={`rounded px-3 py-1 transition-colors ${
              view === "kanban"
                ? "bg-[#00d992]/10 text-[#00d992]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Kanban
          </Link>
          <Link
            href={`?${params.projectId !== undefined ? `projectId=${params.projectId}&` : ""}view=calendar`}
            className={`rounded px-3 py-1 transition-colors ${
              view === "calendar"
                ? "bg-[#00d992]/10 text-[#00d992]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Calendar
          </Link>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Calendar view coming in Phase 2.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = grouped[col.key] ?? [];
            return (
              <div
                key={col.key}
                className="flex flex-col rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-medium">{col.label}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {items.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Empty
                    </p>
                  ) : (
                    items.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-md border border-border bg-background p-3 transition-colors hover:border-[#00d992]/40"
                      >
                        <div className="text-sm font-medium leading-snug">
                          {t.title}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t.project.name}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE["medium"]
                            }`}
                          >
                            {t.priority}
                          </span>
                          {t.dueDate !== null && (
                            <span className="text-[10px] text-muted-foreground">
                              Due {t.dueDate.toLocaleDateString()}
                            </span>
                          )}
                          {t.assignments.length > 0 && (
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {t.assignments.length} assignee
                              {t.assignments.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
