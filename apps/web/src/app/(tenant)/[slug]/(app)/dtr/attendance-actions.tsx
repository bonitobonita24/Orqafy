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

interface AttendanceActionsProps {
  attendanceId: string;
  status: string;
}

export function AttendanceActions({
  attendanceId,
  status,
}: AttendanceActionsProps) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const approve = trpc.dtr.attendanceApprove.useMutation({
    onSuccess: () => {
      toast.success("Attendance record approved.");
      router.refresh();
      setApproveOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setApproveOpen(false);
    },
  });

  const reject = trpc.dtr.attendanceReject.useMutation({
    onSuccess: () => {
      toast.success("Attendance record rejected.");
      router.refresh();
      setRejectOpen(false);
      setRejectReason("");
    },
    onError: (err) => {
      toast.error(err.message);
      setRejectOpen(false);
    },
  });

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
            <DialogTitle>Approve Attendance</DialogTitle>
            <DialogDescription>
              Confirm approval of this attendance record.
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
              onClick={() => approve.mutate({ attendanceId })}
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
            <DialogTitle>Reject Attendance</DialogTitle>
            <DialogDescription>
              Optionally provide a reason. It will be stored in the record
              notes.
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
                  attendanceId,
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
    </div>
  );
}
