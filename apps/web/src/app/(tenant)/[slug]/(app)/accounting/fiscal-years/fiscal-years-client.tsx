"use client";

import { useState } from "react";
import { CalendarRange, Plus } from "@/components/ui/icons";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <Card>
        <CardContent className="p-0">
          {years.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CalendarRange}
                title="No fiscal years yet."
                description="Add one below."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((fy) => (
                  <TableRow key={fy.id}>
                    <TableCell className="font-medium">{fy.name}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(fy.startDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(fy.endDate)}</TableCell>
                    <TableCell>
                      {fy.isClosed ? (
                        <Badge variant="outline" className="rounded-full border-border bg-muted text-muted-foreground">
                          Closed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">
                          Open
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create form */}
      {creating ? (
        <Card>
          <CardContent className="px-6 py-5">
            <p className="mb-4 text-sm font-medium">New fiscal year</p>
            <FiscalYearForm onCancel={() => setCreating(false)} />
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreating(true)}
          className="border-dashed text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add fiscal year
        </Button>
      )}
    </div>
  );
}
