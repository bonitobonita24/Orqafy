"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface LeaveRequestActionsProps {
  leaveRequestId: string;
  status: string;
  /** True when the leave request belongs to the currently authenticated user. */
  isOwn?: boolean;
}

export function LeaveRequestActions({
  leaveRequestId,
  status,
  isOwn = false,
}: LeaveRequestActionsProps) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const approve = trpc.dtr.leaveRequestApprove.useMutation({
    onSuccess: () => {
      toast.success("Leave request approved.");
      router.refresh();
      setApproveOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setApproveOpen(false);
    },
  });

  const reject = trpc.dtr.leaveRequestReject.useMutation({
    onSuccess: () => {
      toast.success("Leave request rejected.");
      router.refresh();
      setRejectOpen(false);
      setRejectReason("");
    },
    onError: (err) => {
      toast.error(err.message);
      setRejectOpen(false);
    },
  });

  const cancel = trpc.dtr.leaveRequestCancel.useMutation({
    onSuccess: () => {
      toast.success("Leave request cancelled.");
      router.refresh();
      setCancelOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setCancelOpen(false);
    },
  });

  // Nothing to show if not pending and not the owner (owner cancel only applies to pending anyway)
  if (status !== "pending") {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Approve */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="rounded border border-[#00d992]/40 bg-[#00d992]/10 px-2 py-0.5 text-xs font-medium text-[#00d992] hover:bg-[#00d992]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve Leave Request</DialogTitle>
            <DialogDescription>
              This will approve the leave request and notify the employee.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApproveOpen(false)}
              disabled={approve.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => approve.mutate({ leaveRequestId })}
              disabled={approve.isPending}
              className="bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90"
            >
              {approve.isPending ? "Approving…" : "Confirm Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog
        open={rejectOpen}
        onOpenChange={(next) => {
          setRejectOpen(next);
          if (!next) setRejectReason("");
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for the rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Reason{" "}
              <span className="text-muted-foreground/60 font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…"
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRejectOpen(false);
                setRejectReason("");
              }}
              disabled={reject.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                reject.mutate({
                  leaveRequestId,
                  ...(rejectReason.trim().length > 0 && {
                    reason: rejectReason.trim(),
                  }),
                })
              }
              disabled={reject.isPending}
            >
              {reject.isPending ? "Rejecting…" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel (self-service — own pending requests only) */}
      {isOwn && (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel Request
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Cancel Leave Request</DialogTitle>
              <DialogDescription>
                This will cancel your pending leave request. This action cannot
                be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelOpen(false)}
                disabled={cancel.isPending}
              >
                Keep Request
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => cancel.mutate({ leaveRequestId })}
                disabled={cancel.isPending}
              >
                {cancel.isPending ? "Cancelling…" : "Confirm Cancel"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
