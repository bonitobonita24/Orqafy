"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RateType = "sss" | "philhealth" | "pagibig" | "withholding";

const TYPE_LABELS: Record<RateType, string> = {
  sss: "SSS",
  philhealth: "PhilHealth",
  pagibig: "Pag-IBIG",
  withholding: "Withholding",
};

const RATE_TYPES: RateType[] = ["sss", "philhealth", "pagibig", "withholding"];

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export function StatutoryRatesClient({ slug: _slug }: { slug: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: rows, isLoading } = trpc.payroll.statutoryRate.list.useQuery();

  const [type, setType] = useState<RateType>("sss");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [source, setSource] = useState("");
  const [configJson, setConfigJson] = useState("{}");

  // Pre-fill source + config when type changes and a matching row exists
  useEffect(() => {
    if (!rows) return;
    const match = rows.find((r) => r.type === type);
    if (match) {
      setSource(match.source);
      setConfigJson(JSON.stringify(match.config, null, 2));
    } else {
      setSource("");
      setConfigJson("{}");
    }
  }, [type, rows]);

  const seedMut = trpc.payroll.statutoryRate.seedDefaults.useMutation({
    onSuccess: (result) => {
      toast.success(`Seeded ${result.created} default rate(s).`);
      void utils.payroll.statutoryRate.list.invalidate();
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const upsertMut = trpc.payroll.statutoryRate.upsert.useMutation({
    onSuccess: () => {
      toast.success("Statutory rate saved.");
      void utils.payroll.statutoryRate.list.invalidate();
      router.refresh();
      // Reset form
      setEffectiveFrom("");
      setSource("");
      setConfigJson("{}");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configJson) as Record<string, unknown>;
    } catch {
      toast.error("Config must be valid JSON.");
      return;
    }
    if (!effectiveFrom) {
      toast.error("Effective from date is required.");
      return;
    }
    upsertMut.mutate({
      type,
      config: parsed,
      source,
      effectiveFrom,
      isActive: true,
    });
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading statutory rates…</p>;
  }

  const rateRows = rows ?? [];

  return (
    <div className="space-y-6">
      {/* Rate list */}
      <div className="rounded-lg border border-border bg-card">
        {rateRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No statutory rates on record. Use "Seed 2025 defaults" to populate.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Effective From</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Config</th>
              </tr>
            </thead>
            <tbody>
              {rateRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">
                    {TYPE_LABELS[row.type as RateType] ?? row.type}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(row.effectiveFrom)}</td>
                  <td className="px-4 py-3">
                    {row.isActive ? (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-border bg-muted text-muted-foreground text-xs">
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{row.source}</td>
                  <td className="px-4 py-3">
                    <pre className="text-xs font-mono text-muted-foreground max-w-xs max-h-24 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(row.config, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Seed defaults button */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => seedMut.mutate()}
          disabled={seedMut.isPending}
        >
          {seedMut.isPending ? "Seeding…" : "Seed 2025 defaults"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Populates missing rate types with cited 2025 PH statutory defaults.
        </p>
      </div>

      {/* Add / update form */}
      <div className="rounded-lg border border-border bg-card px-6 py-5">
        <p className="mb-4 text-sm font-medium">Add / update a rate</p>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div className="space-y-1.5">
            <Label htmlFor="rate-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as RateType)}>
              <SelectTrigger id="rate-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="effective-from">Effective From</Label>
            <Input
              id="effective-from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source">Source / Citation</Label>
            <Input
              id="source"
              type="text"
              placeholder="e.g. SSS Circular 2025-001"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
              minLength={1}
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="config-json">Config (JSON)</Label>
            <Textarea
              id="config-json"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder="{}"
            />
            <p className="text-xs text-muted-foreground">
              Paste the rate table as a JSON object. Each upsert creates a new effective-dated row.
            </p>
          </div>

          <Button type="submit" disabled={upsertMut.isPending}>
            {upsertMut.isPending ? "Saving…" : "Save Rate"}
          </Button>
        </form>
      </div>
    </div>
  );
}
