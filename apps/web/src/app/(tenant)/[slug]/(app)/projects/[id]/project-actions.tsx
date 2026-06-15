"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ProjectActionsProps {
  projectId: string;
  status: string;
  slug: string;
}

export function ProjectActions({ projectId, status, slug }: ProjectActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const archive = trpc.project.archive.useMutation({
    onSuccess: () => {
      toast.success("Project archived.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setPending(null),
  });

  const isPending = pending !== null;
  const canEdit = status !== "completed" && status !== "cancelled";
  const canArchive = status !== "cancelled";

  return (
    <div className="flex items-center gap-2">
      {canEdit ? (
        <Link
          href={`/${slug}/projects/${projectId}/edit`}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          Edit
        </Link>
      ) : null}
      {canArchive ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Archive this project? This sets it to cancelled.")) return;
            setPending("archive");
            archive.mutate({ id: projectId });
          }}
          className="rounded-md border border-red-400/50 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "archive" ? "Archiving…" : "Archive"}
        </button>
      ) : null}
    </div>
  );
}
