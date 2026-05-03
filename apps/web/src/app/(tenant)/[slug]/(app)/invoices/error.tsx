"use client";

export default function InvoicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">{error.message || "Something went wrong."}</p>
      <button
        onClick={reset}
        className="text-xs text-[#00d992] underline-offset-4 hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
