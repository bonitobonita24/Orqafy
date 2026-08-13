"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "waiting"],
  in_progress: ["waiting", "resolved"],
  waiting: ["in_progress", "resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

interface TicketActionsProps {
  ticketId: string;
  currentStatus: string;
  assignedToId: string | null;
}

export function TicketActions({
  ticketId,
  currentStatus,
  assignedToId,
}: TicketActionsProps) {
  const router = useRouter();
  const [commentContent, setCommentContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [assignTo, setAssignTo] = useState(assignedToId ?? "");

  const statusMut = trpc.support.ticket.changeStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const assignMut = trpc.support.ticket.assign.useMutation({
    onSuccess: () => {
      toast.success("Ticket assigned.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const commentMut = trpc.support.comment.create.useMutation({
    onSuccess: () => {
      toast.success("Comment added.");
      setCommentContent("");
      setIsInternal(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const closeMut = trpc.support.ticket.close.useMutation({
    onSuccess: () => {
      toast.success("Ticket closed.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const status = currentStatus as TicketStatus;
  const allowedNextStatuses = VALID_TRANSITIONS[status] ?? [];
  const canClose = status === "resolved";
  const isClosed = status === "closed";

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <h2 className="text-sm font-semibold">Actions</h2>

      {/* Status transitions */}
      {!isClosed && allowedNextStatuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Change status:</span>
          {allowedNextStatuses.map((s) => (
            <button
              key={s}
              onClick={() =>
                statusMut.mutate({ id: ticketId, status: s })
              }
              disabled={statusMut.isPending}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Close button — only from resolved */}
      {canClose && (
        <div>
          <button
            onClick={() => closeMut.mutate({ id: ticketId })}
            disabled={closeMut.isPending}
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            Close ticket
          </button>
        </div>
      )}

      {/* Assign */}
      {!isClosed && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Assign to (user ID)
            </label>
            <input
              type="text"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              placeholder="User ID or leave empty to unassign"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={() =>
              assignMut.mutate({
                id: ticketId,
                assignedToId: assignTo.trim() || null,
              })
            }
            disabled={assignMut.isPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/40 disabled:opacity-50"
          >
            {assignTo.trim() ? "Assign" : "Unassign"}
          </button>
        </div>
      )}

      {/* Add comment */}
      <div className="space-y-2 pt-2 border-t border-border">
        <span className="text-xs font-medium">Add comment</span>
        <textarea
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          placeholder="Write a comment…"
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-1 focus:ring-primary"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-border"
            />
            Internal note (staff only)
          </label>
          <button
            onClick={() => {
              if (!commentContent.trim()) {
                toast.error("Comment cannot be empty.");
                return;
              }
              commentMut.mutate({
                ticketId,
                content: commentContent.trim(),
                isInternal,
              });
            }}
            disabled={commentMut.isPending}
            className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            Post comment
          </button>
        </div>
      </div>
    </div>
  );
}
