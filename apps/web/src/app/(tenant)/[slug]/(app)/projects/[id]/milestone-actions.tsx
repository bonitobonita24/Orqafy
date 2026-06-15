"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface MilestoneActionsProps {
  milestoneId: string;
  isCompleted: boolean;
}

export function MilestoneActions({ milestoneId, isCompleted }: MilestoneActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const complete = trpc.project.milestone.complete.useMutation({
    onSuccess: () => {
      toast.success("Milestone completed.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  const del = trpc.project.milestone.delete.useMutation({
    onSuccess: () => {
      toast.success("Milestone deleted.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  const isPending = pending !== null;

  return (
    <div className="flex items-center gap-2">
      {!isCompleted ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setPending("complete");
            complete.mutate({ milestoneId });
          }}
          className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "complete" ? "Completing…" : "Complete"}
        </button>
      ) : null}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Delete this milestone?")) return;
          setPending("delete");
          del.mutate({ milestoneId });
        }}
        className="rounded border border-red-400/40 bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending === "delete" ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
