import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payroll" };

export default function PayrollPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
      <p className="text-sm text-muted-foreground">
        Payroll management — scaffold placeholder for Phase 8.
      </p>
    </div>
  );
}
