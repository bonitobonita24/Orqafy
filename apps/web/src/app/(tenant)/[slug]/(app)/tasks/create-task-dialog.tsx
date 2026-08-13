"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectOption {
  id: string;
  name: string;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  projects: ProjectOption[];
  defaultProjectId?: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (task: any) => void;
}

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export function CreateTaskDialog({
  open,
  onOpenChange,
  projects,
  defaultProjectId,
  onCreated,
}: CreateTaskDialogProps) {
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.tasks.taskCreate.useMutation({
    onSuccess: (created) => {
      toast.success("Task created.");
      onCreated(created);
      onOpenChange(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.message);
      toast.error("Failed to create task.");
    },
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length === 0) {
      setError("Title is required.");
      return;
    }
    if (projectId.length === 0) {
      setError("Select a project.");
      return;
    }
    createMutation.mutate({
      projectId,
      title: title.trim(),
      ...(description.trim().length > 0 && { description: description.trim() }),
      priority,
      ...(dueDate.length > 0 && { dueDate: new Date(dueDate) }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!createMutation.isPending) { onOpenChange(val); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="task-project">
              Project
            </label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="task-project">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="task-title">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="task-title"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Task title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); }}
              maxLength={200}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="task-desc">
              Description
            </label>
            <textarea
              id="task-desc"
              className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Optional description"
              value={description}
              onChange={(e) => { setDescription(e.target.value); }}
              maxLength={2000}
            />
          </div>

          {/* Priority + Due date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="task-priority">
                Priority
              </label>
              <Select
                value={priority}
                onValueChange={(v) => { setPriority(v as typeof priority); }}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="task-due">
                Due date
              </label>
              <input
                id="task-due"
                type="date"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); }}
              />
            </div>
          </div>

          {error !== null && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { onOpenChange(false); resetForm(); }}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
