import type { Metadata } from "next";

export const metadata: Metadata = { title: "Job Orders" };

export default function JobOrdersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Job Orders</h1>
      <p className="text-sm text-muted-foreground">
        Job order tracking — scaffold placeholder for Phase 8.
      </p>
    </div>
  );
}
