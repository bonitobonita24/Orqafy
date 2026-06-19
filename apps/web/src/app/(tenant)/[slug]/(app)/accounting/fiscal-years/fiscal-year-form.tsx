"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FiscalYearFormProps {
  onCancel: () => void;
}

export function FiscalYearForm({ onCancel }: FiscalYearFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMut = trpc.accounting.fiscalYear.create.useMutation({
    onSuccess: () => {
      toast.success("Fiscal year created.");
      void utils.accounting.fiscalYear.list.invalidate();
      router.refresh();
      onCancel();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim() === "") {
      setError("Fiscal year name is required.");
      return;
    }
    if (startDate === "") {
      setError("Start date is required.");
      return;
    }
    if (endDate === "") {
      setError("End date is required.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }

    createMut.mutate({ name: name.trim(), startDate, endDate });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error !== null && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="fy-name">
            Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="fy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="FY 2026"
            required
          />
        </div>

        {/* Start date */}
        <div className="space-y-2">
          <Label htmlFor="fy-start">
            Start Date <span className="text-red-400">*</span>
          </Label>
          <Input
            id="fy-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        {/* End date */}
        <div className="space-y-2">
          <Label htmlFor="fy-end">
            End Date <span className="text-red-400">*</span>
          </Label>
          <Input
            id="fy-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={createMut.isPending}>
          {createMut.isPending ? "Saving…" : "Create Fiscal Year"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={createMut.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
