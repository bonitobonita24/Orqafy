"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PoActionsProps {
  slug: string;
  poId: string;
  status: string;
}

export function PoActions({ slug, poId, status }: PoActionsProps) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const submitMut = trpc.purchasing.po.submit.useMutation({
    onSuccess: () => {
      toast.success("Purchase order submitted.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMut = trpc.purchasing.po.approve.useMutation({
    onSuccess: () => {
      toast.success("Purchase order approved.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const markOrderedMut = trpc.purchasing.po.markOrdered.useMutation({
    onSuccess: () => {
      toast.success("Purchase order marked as ordered.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMut = trpc.purchasing.po.cancel.useMutation({
    onSuccess: () => {
      toast.success("Purchase order cancelled.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const closeMut = trpc.purchasing.po.close.useMutation({
    onSuccess: () => {
      toast.success("Purchase order closed.");
      router.push(`/${slug}/purchasing`);
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const anyPending =
    submitMut.isPending ||
    approveMut.isPending ||
    markOrderedMut.isPending ||
    cancelMut.isPending ||
    closeMut.isPending;

  const canCancel = ["draft", "pending_approval", "approved", "ordered"].includes(status);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {status === "draft" && (
          <Button
            size="sm"
            onClick={() => submitMut.mutate({ id: poId })}
            disabled={anyPending}
          >
            {submitMut.isPending ? "Submitting…" : "Submit"}
          </Button>
        )}

        {status === "pending_approval" && (
          <Button
            size="sm"
            onClick={() => approveMut.mutate({ id: poId })}
            disabled={anyPending}
          >
            {approveMut.isPending ? "Approving…" : "Approve"}
          </Button>
        )}

        {status === "approved" && (
          <Button
            size="sm"
            onClick={() => markOrderedMut.mutate({ id: poId })}
            disabled={anyPending}
          >
            {markOrderedMut.isPending ? "Updating…" : "Mark Ordered"}
          </Button>
        )}

        {status === "received" && (
          <Button
            size="sm"
            onClick={() => setCloseOpen(true)}
            disabled={anyPending}
          >
            Close
          </Button>
        )}

        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCancelOpen(true)}
            disabled={anyPending}
            className="border-red-500/30 text-red-400 hover:border-red-500/50 hover:bg-red-500/10"
          >
            Cancel PO
          </Button>
        )}
      </div>

      {/* Cancel confirm dialog */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the purchase order. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep PO</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMut.mutate({ id: poId })}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Cancel PO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close confirm dialog */}
      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close purchase order?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing marks this PO as complete. No further goods receipts can be recorded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Open</AlertDialogCancel>
            <AlertDialogAction onClick={() => closeMut.mutate({ id: poId })}>
              Close PO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
