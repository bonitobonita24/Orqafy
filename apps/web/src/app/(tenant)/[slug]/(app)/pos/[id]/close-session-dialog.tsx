"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FormValues {
  closingBalance: number;
  notes: string;
}

interface CloseSessionDialogProps {
  sessionId: string;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function CloseSessionDialog({ sessionId }: CloseSessionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { closingBalance: 0, notes: "" },
  });

  const closeSession = trpc.pos.session.close.useMutation({
    onSuccess: (session) => {
      const expected = Number(session.expectedBalance ?? 0);
      const discrepancy = Number(session.discrepancy ?? 0);
      const sign = discrepancy >= 0 ? "+" : "";
      const discrepancyText =
        discrepancy === 0
          ? "No discrepancy — drawer balanced."
          : `Discrepancy: ${sign}${formatAmount(discrepancy)} (expected ${formatAmount(expected)}).`;
      toast.success(`Session closed. ${discrepancyText}`);
      setOpen(false);
      reset();
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function onSubmit(values: FormValues) {
    closeSession.mutate({
      id: sessionId,
      closingBalance: values.closingBalance,
      ...(values.notes !== undefined &&
        values.notes.trim().length > 0 && { notes: values.notes.trim() }),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          Close Session
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Close POS Session</DialogTitle>
          <DialogDescription>
            Count your cash drawer and enter the closing balance. Any discrepancy
            will be recorded automatically.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="closingBalance" className="text-xs font-medium">
              Closing Balance (₱)
            </Label>
            <Input
              id="closingBalance"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              {...register("closingBalance", {
                valueAsNumber: true,
                validate: (v) =>
                  (typeof v === "number" && !Number.isNaN(v) && v >= 0) ||
                  "Closing balance must be 0 or greater.",
              })}
              className="font-mono"
            />
            {errors.closingBalance && (
              <p className="text-xs text-red-500">
                {errors.closingBalance.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="closeNotes"
              className="text-xs font-medium text-muted-foreground"
            >
              Notes{" "}
              <span className="font-normal text-muted-foreground/60">
                (optional)
              </span>
            </Label>
            <Textarea
              id="closeNotes"
              rows={2}
              placeholder="Any closing notes…"
              className="resize-none"
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={closeSession.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={closeSession.isPending}
            >
              {closeSession.isPending ? "Closing…" : "Close Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
