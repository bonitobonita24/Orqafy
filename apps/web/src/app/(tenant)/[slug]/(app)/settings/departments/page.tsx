import type { Metadata } from "next";
import { DepartmentsClient } from "./departments-client";

export const metadata: Metadata = { title: "Departments settings" };

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
        <p className="text-sm text-muted-foreground">
          Organize your team by department. Departments are used to group employees and users for
          reporting and access control.
        </p>
      </div>
      <DepartmentsClient />
    </div>
  );
}
