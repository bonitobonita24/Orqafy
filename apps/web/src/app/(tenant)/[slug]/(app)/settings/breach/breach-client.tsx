"use client";

/**
 * BreachClient — Data Breach Register UI — V32.9 / RA 10173
 *
 * Covers:
 *  - List breaches (compliance.breach.list)
 *  - Record a breach (compliance.breach.create)
 *  - Per-row actions: markNpcNotified · markSubjectsNotified · fileReport · close
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | Date | null | undefined) {
  if (d == null) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "critical") return "destructive";
  if (s === "high") return "destructive";
  if (s === "medium") return "secondary";
  return "outline";
}

function statusBadgeClass(s: string) {
  const map: Record<string, string> = {
    open: "bg-yellow-500/10 text-yellow-600",
    notified: "bg-blue-500/10 text-blue-600",
    subjects_notified: "bg-purple-500/10 text-purple-600",
    reported: "bg-green-500/10 text-green-600",
    closed: "bg-muted text-muted-foreground",
  };
  return map[s] ?? "bg-muted text-muted-foreground";
}

// ─── Record a breach form ─────────────────────────────────────────────────────

type CreateResult = {
  id: string;
  title: string;
  fullReportDueAt: Date | string | null;
};

function RecordBreachForm({ onCreated }: { onCreated: (r: CreateResult) => void }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discoveredAt, setDiscoveredAt] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [affectedSubjects, setAffectedSubjects] = useState("");
  const [open, setOpen] = useState(false);

  const createMut = trpc.compliance.breach.create.useMutation({
    onSuccess: (record) => {
      toast.success("Breach recorded.");
      void utils.compliance.breach.list.invalidate();
      router.refresh();
      onCreated(record);
      // Reset
      setTitle("");
      setDescription("");
      setDiscoveredAt("");
      setSeverity("medium");
      setAffectedSubjects("");
      setOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="text-sm">
        + Record a breach
      </Button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !discoveredAt) {
      toast.error("Title, description, and discovery date are required.");
      return;
    }
    createMut.mutate({
      title: title.trim(),
      description: description.trim(),
      discoveredAt: new Date(discoveredAt).toISOString(),
      severity,
      ...(affectedSubjects !== "" ? { affectedSubjects: Number(affectedSubjects) } : {}),
    });
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-base font-semibold">Record a new breach</h2>

        <div className="space-y-1.5">
          <Label htmlFor="breach-title">Title *</Label>
          <Input
            id="breach-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief description of the breach"
            maxLength={300}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="breach-description">Description *</Label>
          <Textarea
            id="breach-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened, how it was discovered, what data was affected…"
            rows={4}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="breach-discoveredAt">Date &amp; time discovered *</Label>
            <Input
              id="breach-discoveredAt"
              type="datetime-local"
              value={discoveredAt}
              onChange={(e) => setDiscoveredAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="breach-severity">Severity *</Label>
            {/* Use native select — shadcn Select requires Radix which may need extra wiring */}
            <select
              id="breach-severity"
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value as "low" | "medium" | "high" | "critical")
              }
              className="mt-0 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              required
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="breach-affectedSubjects">Estimated affected subjects</Label>
          <Input
            id="breach-affectedSubjects"
            type="number"
            min={0}
            value={affectedSubjects}
            onChange={(e) => setAffectedSubjects(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={createMut.isPending} className="text-sm">
            {createMut.isPending ? "Saving…" : "Record breach"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="text-sm"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Created-breach deadline callout ─────────────────────────────────────────

function DeadlineCallout({ record }: { record: CreateResult }) {
  if (record.fullReportDueAt == null) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 text-sm"
    >
      <p className="font-semibold text-yellow-700 dark:text-yellow-400">
        NPC Full Report deadline
      </p>
      <p className="mt-0.5 text-muted-foreground">
        The 5-business-day full report for{" "}
        <strong className="text-foreground">{record.title}</strong> is due by{" "}
        <strong className="text-foreground">{formatDate(record.fullReportDueAt)}</strong>. File it
        using "File full report" in the table below.
      </p>
    </div>
  );
}

// ─── Per-row actions ──────────────────────────────────────────────────────────

function BreachRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  function invalidate() {
    void utils.compliance.breach.list.invalidate();
    router.refresh();
  }

  const npcMut = trpc.compliance.breach.markNpcNotified.useMutation({
    onSuccess: () => { toast.success("Marked NPC as notified."); invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const subjMut = trpc.compliance.breach.markSubjectsNotified.useMutation({
    onSuccess: () => { toast.success("Marked data subjects as notified."); invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const reportMut = trpc.compliance.breach.fileReport.useMutation({
    onSuccess: () => { toast.success("Full report filed."); invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const closeMut = trpc.compliance.breach.close.useMutation({
    onSuccess: () => { toast.success("Breach record closed."); invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const isClosed = status === "closed";

  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "open" && (
        <button
          type="button"
          onClick={() => npcMut.mutate({ id })}
          disabled={npcMut.isPending}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Mark NPC notified
        </button>
      )}
      {(status === "notified") && (
        <button
          type="button"
          onClick={() => subjMut.mutate({ id })}
          disabled={subjMut.isPending}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Mark subjects notified
        </button>
      )}
      {(status === "subjects_notified" || status === "notified") && (
        <button
          type="button"
          onClick={() => reportMut.mutate({ id })}
          disabled={reportMut.isPending}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          File full report
        </button>
      )}
      {!isClosed && status !== "open" && (
        <button
          type="button"
          onClick={() => closeMut.mutate({ id })}
          disabled={closeMut.isPending}
          className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Close
        </button>
      )}
      {isClosed && (
        <span className="text-xs text-muted-foreground">Closed</span>
      )}
    </div>
  );
}

// ─── Breach list table ────────────────────────────────────────────────────────

function BreachList() {
  const { data, isLoading, error } = trpc.compliance.breach.list.useQuery({ page: 1, limit: 50 });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading breach records…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error.message ?? "Could not load breach records. You may not have admin access."}
      </p>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No breach records yet. Use the form above to record a breach.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Discovered</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>NPC notified</TableHead>
            <TableHead>Full report due</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{b.title}</TableCell>
              <TableCell>
                <Badge variant={severityVariant(b.severity)} className="capitalize text-xs">
                  {b.severity}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {formatDate(b.discoveredAt)}
              </TableCell>
              <TableCell>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(b.status)}`}
                >
                  {b.status.replace("_", " ")}
                </span>
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {b.npcNotifiedAt ? (
                  <span className="text-green-600">{formatDate(b.npcNotifiedAt)}</span>
                ) : (
                  <span className="text-muted-foreground">Not yet</span>
                )}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {b.fullReportDueAt ? (
                  <span
                    className={
                      new Date(b.fullReportDueAt) < new Date() && b.status !== "reported" && b.status !== "closed"
                        ? "font-semibold text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {formatDate(b.fullReportDueAt)}
                    {new Date(b.fullReportDueAt) < new Date() &&
                      b.status !== "reported" &&
                      b.status !== "closed" && (
                        <span className="ml-1 text-xs">(overdue)</span>
                      )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <BreachRowActions id={b.id} status={b.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Root client component ────────────────────────────────────────────────────

export function BreachClient() {
  const [lastCreated, setLastCreated] = useState<CreateResult | null>(null);

  return (
    <div className="space-y-6">
      {lastCreated && <DeadlineCallout record={lastCreated} />}

      <RecordBreachForm onCreated={(r) => setLastCreated(r)} />

      <div>
        <h2 className="mb-3 text-base font-semibold">Breach records</h2>
        <BreachList />
      </div>
    </div>
  );
}
