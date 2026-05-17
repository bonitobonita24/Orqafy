"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const CONTACT_LOG_TYPES = ["call", "email", "meeting", "note"] as const;
type ContactLogType = (typeof CONTACT_LOG_TYPES)[number];

const TYPE_LABELS: Record<ContactLogType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

const TYPE_BADGE: Record<ContactLogType, string> = {
  call: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  email: "text-violet-400 bg-violet-400/10 border-violet-400/30",
  meeting: "text-[#00d992] bg-[#00d992]/10 border-[#00d992]/30",
  note: "text-muted-foreground bg-muted border-border",
};

const TYPE_INITIAL: Record<ContactLogType, string> = {
  call: "C",
  email: "E",
  meeting: "M",
  note: "N",
};

export interface ContactLogEntry {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  occurredAt: Date;
  createdAt: Date;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
  };
}

interface ContactLogTimelineProps {
  initialLogs: ContactLogEntry[];
}

function formatOccurredAt(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function fullCreatorName(c: ContactLogEntry["createdBy"]): string {
  if (c.displayName !== null && c.displayName.length > 0) return c.displayName;
  return `${c.firstName} ${c.lastName}`;
}

export function ContactLogTimeline({ initialLogs }: ContactLogTimelineProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<ContactLogEntry[]>(initialLogs);
  const [filter, setFilter] = useState<ContactLogType | "all">("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const deleteMutation = trpc.crm.contactLogDelete.useMutation({
    onSuccess: () => {
      toast.success("Touchpoint deleted.");
      router.refresh();
    },
    onError: (err, _vars, _ctx) => {
      toast.error(err.message);
      // restore on error
      setLogs(initialLogs);
    },
    onSettled: () => setPendingId(null),
  });

  const visible =
    filter === "all" ? logs : logs.filter((l) => l.type === filter);

  function onDelete(id: string) {
    setPendingId(id);
    // optimistic remove
    setLogs((prev) => prev.filter((l) => l.id !== id));
    deleteMutation.mutate({ id });
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="All"
          active={filter === "all"}
          count={logs.length}
          onClick={() => setFilter("all")}
        />
        {CONTACT_LOG_TYPES.map((t) => (
          <FilterChip
            key={t}
            label={TYPE_LABELS[t]}
            active={filter === t}
            count={logs.filter((l) => l.type === t).length}
            onClick={() => setFilter(t)}
          />
        ))}
      </div>

      {/* Timeline */}
      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
          {filter === "all"
            ? "No touchpoints recorded yet."
            : `No ${TYPE_LABELS[filter].toLowerCase()} touchpoints yet.`}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((log) => {
            const t = (CONTACT_LOG_TYPES as readonly string[]).includes(log.type)
              ? (log.type as ContactLogType)
              : "note";
            return (
              <li
                key={log.id}
                className="flex gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:bg-muted/30"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${TYPE_BADGE[t]}`}
                  aria-label={TYPE_LABELS[t]}
                >
                  {TYPE_INITIAL[t]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {log.subject}
                      </span>
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGE[t]}`}
                      >
                        {TYPE_LABELS[t]}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={pendingId === log.id}
                      onClick={() => onDelete(log.id)}
                      className="text-xs text-muted-foreground hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Delete touchpoint"
                    >
                      {pendingId === log.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                  {log.body !== null && log.body.length > 0 && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {log.body}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatOccurredAt(new Date(log.occurredAt))} ·{" "}
                    {fullCreatorName(log.createdBy)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-[#00d992]/40 bg-[#00d992]/10 text-[#00d992]"
          : "border-border bg-card text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
      <span className="ml-1.5 opacity-70">{count}</span>
    </button>
  );
}
