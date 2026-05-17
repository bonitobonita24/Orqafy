"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type JobOrderStatus =
  | "received"
  | "diagnosing"
  | "quoted"
  | "approved"
  | "in_progress"
  | "testing"
  | "completed"
  | "released"
  | "cancelled";

// Mirrors the server's allowed-transitions table. Server is the source of
// truth — this is for button rendering only.
const allowedTransitions: Record<JobOrderStatus, readonly JobOrderStatus[]> = {
  received: ["diagnosing", "cancelled"],
  diagnosing: ["quoted", "in_progress", "cancelled"],
  quoted: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["testing", "cancelled"],
  testing: ["completed", "in_progress"],
  completed: ["released"],
  released: [],
  cancelled: [],
};

const STATUS_LABEL: Record<JobOrderStatus, string> = {
  received: "Received",
  diagnosing: "Diagnosing",
  quoted: "Quoted",
  approved: "Approved",
  in_progress: "In progress",
  testing: "Testing",
  completed: "Completed",
  released: "Released",
  cancelled: "Cancel",
};

function isDestructiveTransition(target: JobOrderStatus): boolean {
  return target === "cancelled";
}

function isAdvancingTransition(target: JobOrderStatus): boolean {
  return target === "released" || target === "completed";
}

interface JobOrderStatusActionsProps {
  jobOrderId: string;
  currentStatus: JobOrderStatus;
  hasCustomerSignature: boolean;
  hasTechnicianSignature: boolean;
}

export function JobOrderStatusActions({
  jobOrderId,
  currentStatus,
  hasCustomerSignature,
  hasTechnicianSignature,
}: JobOrderStatusActionsProps): React.ReactElement | null {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<JobOrderStatus | null>(null);

  const updateStatus = trpc.jobOrder.updateStatus.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(`Status updated to ${STATUS_LABEL[variables.status]}.`);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
    onSettled: () => {
      setPendingTarget(null);
    },
  });

  const targets = allowedTransitions[currentStatus];
  if (targets.length === 0) return null;

  const signaturesReady = hasCustomerSignature && hasTechnicianSignature;

  const handleClick = (target: JobOrderStatus): void => {
    if (target === "cancelled") {
      const confirmed = window.confirm(
        "Cancel this job order? This cannot be reversed from the UI.",
      );
      if (!confirmed) return;
    }
    setPendingTarget(target);
    updateStatus.mutate({ id: jobOrderId, status: target });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {targets.map((target) => {
        const isCompletedTransition =
          currentStatus === "testing" && target === "completed";
        const blockedBySignature = isCompletedTransition && !signaturesReady;
        const isPending = pendingTarget === target && updateStatus.isPending;
        const variant: "default" | "outline" | "destructive" = isDestructiveTransition(target)
          ? "destructive"
          : isAdvancingTransition(target)
            ? "default"
            : "outline";

        return (
          <Button
            key={target}
            type="button"
            size="sm"
            variant={variant}
            disabled={blockedBySignature || updateStatus.isPending}
            title={
              blockedBySignature
                ? "Both customer and technician signatures are required first."
                : undefined
            }
            onClick={() => {
              handleClick(target);
            }}
          >
            {isPending ? "Updating…" : `→ ${STATUS_LABEL[target]}`}
          </Button>
        );
      })}
    </div>
  );
}
