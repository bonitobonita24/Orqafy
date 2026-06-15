"use client";

export default function DashboardError({
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
        className="text-xs text-primary underline-offset-4 hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
