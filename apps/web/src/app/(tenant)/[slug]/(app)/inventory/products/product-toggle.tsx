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

interface ProductToggleProps {
  id: string;
  name: string;
  isActive: boolean;
}

export function ProductToggle({ id, name, isActive }: ProductToggleProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const toggle = trpc.inventory.productToggleActive.useMutation({
    onSuccess: () => {
      toast.success(isActive ? "Product deactivated." : "Product activated.");
      setOpen(false);
      router.refresh();
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
          className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${
            isActive
              ? "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992]"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isActive ? "Deactivate" : "Activate"} Product
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? `Deactivating "${name}" will hide it from selection lists. You can reactivate it later.`
              : `Activating "${name}" will make it available for use across the app.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={toggle.isPending}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ id })}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive
                ? "border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20"
                : "border-[#00d992]/30 bg-[#00d992]/10 text-[#00d992] hover:bg-[#00d992]/20"
            }`}
          >
            {toggle.isPending
              ? "Saving…"
              : isActive
                ? "Deactivate"
                : "Activate"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
