import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
      <p className="text-sm text-muted-foreground">
        Inventory management — scaffold placeholder for Phase 8.
      </p>
    </div>
  );
}
