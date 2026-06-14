"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeactivateButtonProps {
  userId: string;
  displayName: string;
}

export function DeactivateButton({ userId, displayName }: DeactivateButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = trpc.user.deactivate.useMutation({
    onSuccess: () => {
      toast.success(`${displayName} has been deactivated.`);
      setOpen(false);
      setError(null);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function handleConfirm() {
    setError(null);
    mutation.mutate({ id: userId });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
        >
          Deactivate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {displayName}?</DialogTitle>
          <DialogDescription>
            This will set the user&apos;s account to inactive and immediately invalidate
            all of their active sessions. They will not be able to log in until
            an admin reactivates their account.
          </DialogDescription>
        </DialogHeader>
        {error !== null && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={mutation.isPending}
            variant="outline"
            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
          >
            {mutation.isPending ? "Deactivating…" : "Confirm deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
