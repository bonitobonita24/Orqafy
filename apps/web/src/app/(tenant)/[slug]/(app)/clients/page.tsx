import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
      <p className="text-muted-foreground">Client list — Phase 8</p>
    </div>
  );
}
