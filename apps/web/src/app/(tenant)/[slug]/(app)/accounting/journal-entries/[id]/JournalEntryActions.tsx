"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

interface JournalEntryActionsProps {
  entryId: string;
  status: string;
  slug: string;
}

export function JournalEntryActions({ entryId, status, slug }: JournalEntryActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const postMutation = trpc.accounting.journalEntry.post.useMutation({
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const reverseMutation = trpc.accounting.journalEntry.reverse.useMutation({
    onSuccess: (data) => {
      setError(null);
      // Navigate to the new reversal entry
      router.push(`/${slug}/accounting/journal-entries/${data.id}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const isPending = postMutation.isPending || reverseMutation.isPending;

  return (
    <div className="flex items-center gap-2">
      {status === "draft" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            postMutation.mutate({ id: entryId });
          }}
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {postMutation.isPending ? "Posting…" : "Post Entry"}
        </button>
      )}
      {status === "posted" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            reverseMutation.mutate({ id: entryId });
          }}
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reverseMutation.isPending ? "Reversing…" : "Reverse Entry"}
        </button>
      )}
      {error !== null && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
