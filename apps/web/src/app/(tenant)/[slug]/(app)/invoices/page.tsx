import type { Metadata } from "next";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
      <p className="text-muted-foreground">Invoice management — Phase 8</p>
    </div>
  );
}
