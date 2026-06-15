"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FiscalYear {
  id: string;
  name: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

interface JournalEntryFormProps {
  slug: string;
  mode: "create" | "edit";
  entryId?: string;
  fiscalYears: FiscalYear[];
  accounts: Account[];
  initial?: {
    fiscalYearId?: string;
    date?: string;
    description?: string;
    lines?: JournalLine[];
  };
}

const EMPTY_LINE: JournalLine = { accountId: "", debit: 0, credit: 0, description: "" };

export function JournalEntryForm({
  slug,
  mode,
  entryId,
  fiscalYears,
  accounts,
  initial = {},
}: JournalEntryFormProps) {
  const router = useRouter();

  const [fiscalYearId, setFiscalYearId] = useState(initial.fiscalYearId ?? (fiscalYears[0]?.id ?? ""));
  const [date, setDate] = useState(initial.date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(initial.description ?? "");
  const [lines, setLines] = useState<JournalLine[]>(
    initial.lines?.length ? initial.lines : [{ ...EMPTY_LINE }, { ...EMPTY_LINE }]
  );
  const [error, setError] = useState<string | null>(null);

  const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001 && totalDebits > 0;

  const createMut = trpc.accounting.journalEntry.create.useMutation({
    onSuccess: () => {
      toast.success("Journal entry created.");
      router.push(`/${slug}/accounting/journal-entries`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const updateMut = trpc.accounting.journalEntry.update.useMutation({
    onSuccess: () => {
      toast.success("Journal entry updated.");
      router.push(`/${slug}/accounting/journal-entries`);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const isPending = createMut.isPending || updateMut.isPending;

  function setLine(idx: number, patch: Partial<JournalLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(idx: number) {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (description.trim() === "") { setError("Description is required."); return; }
    if (!fiscalYearId) { setError("Please select a fiscal year."); return; }

    // Form-level data validation: debits must equal credits (structural, not posting logic)
    if (!isBalanced) {
      setError(`Debits (${totalDebits.toFixed(2)}) must equal credits (${totalCredits.toFixed(2)}).`);
      return;
    }

    const validLines = lines.filter((l) => l.accountId !== "");
    if (validLines.length < 2) { setError("At least 2 lines with accounts are required."); return; }

    const payload = {
      fiscalYearId,
      date,
      description: description.trim(),
      lines: validLines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
        ...(l.description.trim() !== "" ? { description: l.description.trim() } : {}),
      })),
    };

    if (mode === "create") {
      createMut.mutate(payload);
    } else {
      if (entryId === undefined) return;
      updateMut.mutate({ id: entryId, ...payload });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error !== null && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        {/* Fiscal Year */}
        <div className="space-y-2">
          <Label htmlFor="fiscalYear">Fiscal Year <span className="text-red-400">*</span></Label>
          <Select value={fiscalYearId} onValueChange={setFiscalYearId}>
            <SelectTrigger id="fiscalYear">
              <SelectValue placeholder="Select fiscal year…" />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears.map((fy) => (
                <SelectItem key={fy.id} value={fy.id}>{fy.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="date">Entry Date <span className="text-red-400">*</span></Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description <span className="text-red-400">*</span></Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this journal entry…"
          rows={2}
          required
        />
      </div>

      {/* Lines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Debit / Credit Lines</Label>
          <div className={`text-xs font-mono ${isBalanced ? "text-primary" : "text-amber-400"}`}>
            DR {totalDebits.toFixed(2)} / CR {totalCredits.toFixed(2)}
            {isBalanced ? " ✓ balanced" : " — unbalanced"}
          </div>
        </div>

        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium text-right">Debit</th>
                <th className="px-3 py-2 font-medium text-right">Credit</th>
                <th className="px-3 py-2 font-medium">Memo</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Select value={line.accountId} onValueChange={(v) => setLine(idx, { accountId: v })}>
                      <SelectTrigger className="h-8 text-xs w-48">
                        <SelectValue placeholder="Select account…" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 w-28 text-right text-xs"
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.debit === 0 ? "" : line.debit}
                      onChange={(e) => setLine(idx, { debit: parseFloat(e.target.value) || 0, credit: 0 })}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 w-28 text-right text-xs"
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.credit === 0 ? "" : line.credit}
                      onChange={(e) => setLine(idx, { credit: parseFloat(e.target.value) || 0, debit: 0 })}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 text-xs"
                      value={line.description}
                      onChange={(e) => setLine(idx, { description: e.target.value })}
                      placeholder="Memo…"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length <= 2}
                      className="text-xs text-muted-foreground hover:text-red-400 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          + Add Line
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || !isBalanced}>
          {isPending ? "Saving…" : mode === "create" ? "Save as Draft" : "Update Entry"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${slug}/accounting/journal-entries`)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
