"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PayrollRunFormProps {
  slug: string;
  mode: "create" | "edit";
  runId?: string;
  initial?: {
    periodStart?: string;
    periodEnd?: string;
    currency?: string;
    notes?: string;
  };
}

export function PayrollRunForm({ slug, mode, runId, initial = {} }: PayrollRunFormProps) {
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(initial.periodStart ?? today);
  const [periodEnd, setPeriodEnd] = useState(initial.periodEnd ?? today);
  const [currency, setCurrency] = useState(initial.currency ?? "PHP");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const createMut = trpc.payroll.create.useMutation({
    onSuccess: (created) => {
      toast.success("Payroll run created.");
      router.push(`/${slug}/payroll/${created.id}`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const updateMut = trpc.payroll.update.useMutation({
    onSuccess: () => {
      toast.success("Payroll run updated.");
      router.push(`/${slug}/payroll/${runId ?? ""}`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const isPending = createMut.isPending || updateMut.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (periodEnd < periodStart) {
      setError("Period end must be on or after period start.");
      return;
    }

    if (mode === "create") {
      createMut.mutate({ periodStart, periodEnd, currency, notes: notes || undefined });
    } else if (runId != null && runId !== "") {
      updateMut.mutate({ id: runId, periodStart, periodEnd, currency, notes: notes || undefined });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="periodStart">Period Start</Label>
          <Input
            id="periodStart"
            type="date"
            required
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodEnd">Period End</Label>
          <Input
            id="periodEnd"
            type="date"
            required
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="currency">Currency</Label>
        <Input
          id="currency"
          maxLength={3}
          required
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          className="w-28"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={3}
          maxLength={1000}
          placeholder="e.g. Semi-monthly — 1st cut-off"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error !== null && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create Payroll Run"
              : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
