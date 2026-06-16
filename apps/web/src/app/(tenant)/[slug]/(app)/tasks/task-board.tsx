"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CreateTaskDialog } from "./create-task-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface ProjectOption {
  id: string;
  name: string;
}

interface AssigneeOption {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
  };
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  project: { id: string; name: string };
  assignments: AssigneeOption[];
}

interface TaskBoardProps {
  slug: string;
  initialTasks: TaskRow[];
  projects: ProjectOption[];
  projectId?: string | undefined;
}

const COLUMNS: { key: string; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
  { key: "blocked", label: "Blocked" },
];

// Status transitions mirror the server-side TASK_STATUS_TRANSITIONS map.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  todo: ["in_progress", "blocked"],
  in_progress: ["review", "blocked", "todo"],
  review: ["done", "in_progress", "blocked"],
  blocked: ["todo", "in_progress"],
  done: [],
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-border bg-muted text-foreground",
  high: "border-primary/30 bg-primary/10 text-primary",
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
};

function formatDue(d: Date | string | null): string | null {
  if (d === null) return null;
  return new Date(d).toLocaleDateString();
}

export function TaskBoard({ slug, initialTasks, projects, projectId }: TaskBoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [dialogOpen, setDialogOpen] = useState(false);

  const updateStatusMutation = trpc.tasks.taskUpdateStatus.useMutation({
    onSuccess: (updated) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...t, status: updated.status } : t)),
      );
      toast.success("Task status updated.");
    },
    onError: (err) => {
      toast.error(err.message);
      router.refresh();
    },
  });

  const deleteMutation = trpc.tasks.taskDelete.useMutation({
    onSuccess: (_, vars) => {
      setTasks((prev) => prev.filter((t) => t.id !== vars.id));
      toast.success("Task deleted.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function handleStatusChange(taskId: string, newStatus: string) {
    updateStatusMutation.mutate({ id: taskId, status: newStatus as "todo" | "in_progress" | "review" | "done" | "blocked" });
  }

  function handleDelete(taskId: string) {
    deleteMutation.mutate({ id: taskId });
  }

  const grouped: Record<string, TaskRow[]> = Object.fromEntries(
    COLUMNS.map((c) => [c.key, []]),
  );
  for (const t of tasks) {
    const bucket = grouped[t.status] ?? grouped["todo"]!;
    bucket.push(t);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
            {projectId !== undefined ? " in this project" : " across all projects"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { setDialogOpen(true); }}
          disabled={projects.length === 0}
        >
          + New Task
        </Button>
      </div>

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
                  items.map((t) => {
                    const allowedTransitions = STATUS_TRANSITIONS[t.status] ?? [];
                    const dueLabel = formatDue(t.dueDate);
                    return (
                      <div
                        key={t.id}
                        className="rounded-md border border-border bg-background p-3 transition-colors hover:border-primary/40"
                      >
                        <div className="text-sm font-medium leading-snug">{t.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{t.project.name}</div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE["medium"]
                            }`}
                          >
                            {t.priority}
                          </span>
                          {dueLabel !== null && (
                            <span className="text-[10px] text-muted-foreground">
                              Due {dueLabel}
                            </span>
                          )}
                          {t.assignments.length > 0 && (
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {t.assignments.length} assignee
                              {t.assignments.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>

                        {allowedTransitions.length > 0 && (
                          <div className="mt-2">
                            <Select
                              onValueChange={(val) => { handleStatusChange(t.id, val); }}
                              disabled={updateStatusMutation.isPending}
                            >
                              <SelectTrigger className="h-6 text-[10px]">
                                <SelectValue placeholder="Move to…" />
                              </SelectTrigger>
                              <SelectContent>
                                {allowedTransitions.map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs capitalize">
                                    {s.replace("_", " ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="mt-1.5 flex justify-end">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="rounded p-1 text-muted-foreground transition-colors hover:text-red-400"
                                aria-label="Delete task"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete task?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  &ldquo;{t.title}&rdquo; will be permanently deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => { handleDelete(t.id); }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CreateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        slug={slug}
        projects={projects}
        defaultProjectId={projectId}
        onCreated={(newTask) => {
          setTasks((prev) => [newTask as TaskRow, ...prev]);
        }}
      />
    </>
  );
}
