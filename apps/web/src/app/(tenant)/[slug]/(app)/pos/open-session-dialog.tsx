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
  openingBalance: number;
  notes: string;
}

interface OpenSessionDialogProps {
  slug: string;
}

export function OpenSessionDialog({ slug }: OpenSessionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { openingBalance: 0, notes: "" },
  });

  const openSession = trpc.pos.session.open.useMutation({
    onSuccess: (session) => {
      toast.success(`Session ${session.sessionNumber} opened.`);
      setOpen(false);
      reset();
      router.push(`/${slug}/pos/${session.id}`);
    },
    onError: (err) => {
      // CONFLICT = already have an open session; surface the server message directly.
      toast.error(err.message);
      setOpen(false);
      reset();
    },
  });

  function onSubmit(values: FormValues) {
    openSession.mutate({
      openingBalance: values.openingBalance,
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
          className="rounded-md border border-[#00d992]/40 bg-[#00d992]/10 px-4 py-2 text-sm font-medium text-[#00d992] transition-colors hover:bg-[#00d992]/20"
        >
          Open Session
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Open POS Session</DialogTitle>
          <DialogDescription>
            Count your starting cash and enter the opening balance.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="openingBalance" className="text-xs font-medium">
              Opening Balance (₱)
            </Label>
            <Input
              id="openingBalance"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              {...register("openingBalance", {
                valueAsNumber: true,
                validate: (v) =>
                  (typeof v === "number" && !Number.isNaN(v) && v >= 0) ||
                  "Opening balance must be 0 or greater.",
              })}
              className="font-mono"
            />
            {errors.openingBalance && (
              <p className="text-xs text-red-500">
                {errors.openingBalance.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium text-muted-foreground">
              Notes{" "}
              <span className="font-normal text-muted-foreground/60">
                (optional)
              </span>
            </Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Any opening notes…"
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
              disabled={openSession.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={openSession.isPending}
              className="bg-[#00d992] text-gray-950 hover:bg-[#00d992]/90"
            >
              {openSession.isPending ? "Opening…" : "Open Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
