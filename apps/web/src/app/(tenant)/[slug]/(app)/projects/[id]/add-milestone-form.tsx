"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface AddMilestoneFormProps {
  projectId: string;
}

export function AddMilestoneForm({ projectId }: AddMilestoneFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  const createMutation = trpc.project.milestone.create.useMutation({
    onSuccess: () => {
      toast.success("Milestone added.");
      setName("");
      setDueDate("");
      setDescription("");
      setOpen(false);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error("Failed to add milestone.");
    },
  });

  function submit() {
    setError(null);
    if (name.trim().length === 0) {
      setError("Milestone name is required.");
      return;
    }
    createMutation.mutate({
      projectId,
      name: name.trim(),
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
      >
        + Add Milestone
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        New Milestone
      </p>
      {error !== null && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          maxLength={200}
          placeholder="Milestone name"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Due Date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputCls}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputCls}
          maxLength={1000}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={createMutation.isPending}
          onClick={submit}
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createMutation.isPending ? "Saving…" : "Add Milestone"}
        </button>
      </div>
    </div>
  );
}
