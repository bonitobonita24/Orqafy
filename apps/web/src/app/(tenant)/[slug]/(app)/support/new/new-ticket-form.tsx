"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface NewTicketFormProps {
  slug: string;
}

export function NewTicketForm({ slug }: NewTicketFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [error, setError] = useState<string | null>(null);

  const createMut = trpc.support.ticket.create.useMutation({
    onSuccess: (ticket) => {
      toast.success(`Ticket ${ticket.ticketNumber} created.`);
      router.push(`/${slug}/support/${ticket.id}`);
    },
    onError: (err) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  const fieldClass =
    "mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    createMut.mutate({
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || undefined,
      priority,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 rounded-lg border border-border bg-card p-6">
      {error !== null && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <label className="block text-sm">
        <span className="font-medium">Title <span className="text-red-400">*</span></span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief summary of the issue"
          maxLength={200}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Description <span className="text-red-400">*</span></span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detailed description of the issue…"
          rows={5}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Category</span>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. hardware, software, network"
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Priority</span>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className={fieldClass}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={createMut.isPending}
          className="rounded-md border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          {createMut.isPending ? "Submitting…" : "Submit ticket"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${slug}/support`)}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
