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

interface VoidSaleActionProps {
  saleId: string;
  saleNumber: string;
}

export function VoidSaleAction({ saleId, saleNumber }: VoidSaleActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const voidSale = trpc.pos.sale.void.useMutation({
    onSuccess: () => {
      toast.success(`Sale ${saleNumber} voided. Inventory reversed.`);
      setOpen(false);
      setReason("");
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function handleConfirm() {
    if (reason.trim().length === 0) return;
    voidSale.mutate({ id: saleId, reason: reason.trim() });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setReason("");
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Void
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Void Sale {saleNumber}</DialogTitle>
          <DialogDescription>
            This will void the sale and reverse all inventory movements. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="voidReason" className="text-xs font-medium">
            Reason{" "}
            <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="voidReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for voiding this sale…"
            rows={3}
            className="resize-none"
          />
          {reason.trim().length === 0 && voidSale.isError && (
            <p className="text-xs text-red-500">Reason is required.</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(false);
              setReason("");
            }}
            disabled={voidSale.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={voidSale.isPending || reason.trim().length === 0}
          >
            {voidSale.isPending ? "Voiding…" : "Confirm Void"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
