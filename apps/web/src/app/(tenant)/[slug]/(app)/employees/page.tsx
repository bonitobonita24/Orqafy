import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employees" };

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
      <p className="text-sm text-muted-foreground">
        Employee directory — scaffold placeholder for Phase 8.
      </p>
    </div>
  );
}
