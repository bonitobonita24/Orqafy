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

interface TenantStatusActionsProps {
  tenantId: string;
  status: string;
}

export function TenantStatusActions({
  tenantId,
  status,
}: TenantStatusActionsProps) {
  const router = useRouter();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [reactivateReason, setReactivateReason] = useState("");

  const suspend = trpc.platform.suspendTenant.useMutation({
    onSuccess: () => {
      toast.success("Workspace suspended.");
      router.refresh();
      setSuspendOpen(false);
      setSuspendReason("");
    },
    onError: (err) => {
      toast.error(err.message);
      setSuspendOpen(false);
    },
  });

  const reactivate = trpc.platform.reactivateTenant.useMutation({
    onSuccess: () => {
      toast.success("Workspace reactivated.");
      router.refresh();
      setReactivateOpen(false);
      setReactivateReason("");
    },
    onError: (err) => {
      toast.error(err.message);
      setReactivateOpen(false);
    },
  });

  const canSuspend = status === "active" || status === "provisioning";
  const canReactivate = status === "suspended";

  return (
    <div className="flex gap-2">
      {canSuspend && (
        <Dialog
          open={suspendOpen}
          onOpenChange={(next) => {
            setSuspendOpen(next);
            if (!next) setSuspendReason("");
          }}
        >
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              Suspend workspace
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Suspend Workspace</DialogTitle>
              <DialogDescription>
                This will immediately suspend tenant access. A reason is
                required and will be recorded in the audit log.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension…"
                rows={3}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSuspendOpen(false);
                  setSuspendReason("");
                }}
                disabled={suspend.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  suspend.mutate({ tenantId, reason: suspendReason.trim() })
                }
                disabled={suspend.isPending || suspendReason.trim().length === 0}
              >
                {suspend.isPending ? "Suspending…" : "Confirm Suspend"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canReactivate && (
        <Dialog
          open={reactivateOpen}
          onOpenChange={(next) => {
            setReactivateOpen(next);
            if (!next) setReactivateReason("");
          }}
        >
          <DialogTrigger asChild>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-background transition-all hover:bg-primary"
            >
              Reactivate workspace
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reactivate Workspace</DialogTitle>
              <DialogDescription>
                This will restore tenant access. A reason is required and will
                be recorded in the audit log.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={reactivateReason}
                onChange={(e) => setReactivateReason(e.target.value)}
                placeholder="Reason for reactivation…"
                rows={3}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReactivateOpen(false);
                  setReactivateReason("");
                }}
                disabled={reactivate.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  reactivate.mutate({
                    tenantId,
                    reason: reactivateReason.trim(),
                  })
                }
                disabled={
                  reactivate.isPending || reactivateReason.trim().length === 0
                }
                className="bg-primary text-primary-foreground hover:bg-primary"
              >
                {reactivate.isPending ? "Reactivating…" : "Confirm Reactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
