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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CONTACT_LOG_TYPES = ["call", "email", "meeting", "note"] as const;
type ContactLogType = (typeof CONTACT_LOG_TYPES)[number];

const TYPE_LABELS: Record<ContactLogType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

interface QuickAddContactLogProps {
  customerId: string;
}

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function QuickAddContactLog({ customerId }: QuickAddContactLogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ContactLogType>("call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState<string>(
    toDateInputValue(new Date()),
  );
  const [error, setError] = useState<string | null>(null);

  const create = trpc.crm.contactLogCreate.useMutation({
    onSuccess: () => {
      toast.success("Touchpoint logged.");
      router.refresh();
      reset();
      setOpen(false);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function reset() {
    setType("call");
    setSubject("");
    setBody("");
    setOccurredAt(toDateInputValue(new Date()));
    setError(null);
  }

  function submit() {
    setError(null);
    const trimmedSubject = subject.trim();
    if (trimmedSubject.length === 0) {
      setError("Subject is required.");
      return;
    }
    const occurred = new Date(`${occurredAt}T00:00:00`);
    if (Number.isNaN(occurred.getTime())) {
      setError("Invalid date.");
      return;
    }
    create.mutate({
      customerId,
      type,
      subject: trimmedSubject,
      occurredAt: occurred,
      ...(body.trim().length > 0 && { body: body.trim() }),
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
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          + Log touchpoint
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a touchpoint</DialogTitle>
          <DialogDescription>
            Record a call, email, meeting, or internal note for this customer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as ContactLogType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_LOG_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              maxLength={255}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Notes (optional)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Details, follow-ups, etc."
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              maxLength={5000}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Occurred on
            </label>
            <input
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
            />
          </div>

          {error !== null && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={create.isPending}
            onClick={submit}
            className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {create.isPending ? "Saving…" : "Save touchpoint"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
