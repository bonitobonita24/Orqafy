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

interface CustomerToggleActiveProps {
  customerId: string;
  isActive: boolean;
}

export function CustomerToggleActive({
  customerId,
  isActive,
}: CustomerToggleActiveProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const toggle = trpc.crm.customerToggleActive.useMutation({
    onSuccess: () => {
      toast.success(isActive ? "Customer deactivated." : "Customer activated.");
      router.refresh();
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            isActive
              ? "rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              : "rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          }
        >
          {isActive ? "Deactivate" : "Activate"}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isActive ? "Deactivate customer?" : "Activate customer?"}
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? "The customer will be marked inactive. You can reactivate at any time."
              : "The customer will be marked active again."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ id: customerId })}
            className={
              isActive
                ? "rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                : "rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {toggle.isPending
              ? "Saving…"
              : isActive
                ? "Yes, Deactivate"
                : "Yes, Activate"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
