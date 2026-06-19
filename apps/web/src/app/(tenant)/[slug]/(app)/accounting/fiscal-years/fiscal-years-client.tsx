"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FiscalYearForm } from "./fiscal-year-form";

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

export function FiscalYearsClient() {
  const { data, isLoading } = trpc.accounting.fiscalYear.list.useQuery({ limit: 200 });
  const [creating, setCreating] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading fiscal years…</p>;
  }

  const years = data?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        {years.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No fiscal years yet. Add one below.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {years.map((fy) => (
                <tr
                  key={fy.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{fy.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(fy.startDate)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(fy.endDate)}</td>
                  <td className="px-4 py-3">
                    {fy.isClosed ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Closed
                      </span>
                    ) : (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Open
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create form */}
      {creating ? (
        <div className="rounded-lg border border-border bg-card px-6 py-5">
          <p className="mb-4 text-sm font-medium">New fiscal year</p>
          <FiscalYearForm onCancel={() => setCreating(false)} />
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add fiscal year
        </button>
      )}
    </div>
  );
}
