"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { trpc } from "@/lib/trpc";

// Default range: last 30 days
function defaultRange(): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(0)}K`;
  return `₱${value.toFixed(0)}`;
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

// Bucket paid invoices by calendar day for the area chart
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bucketByDay(
  invoices: Array<{ paidAt: Date | null; totalAmount: any }>
): Array<{ date: string; revenue: number }> {
  const map = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.paidAt == null) continue;
    const day = new Date(inv.paidAt).toISOString().slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + Number(inv.totalAmount ?? 0));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
}

interface RevenueChartProps {
  slug: string;
}

export function RevenueChart({ slug: _slug }: RevenueChartProps) {
  const defaults = defaultRange();
  const [startStr, setStartStr] = useState(toDateInput(defaults.start));
  const [endStr, setEndStr] = useState(toDateInput(defaults.end));

  const startDate = new Date(`${startStr}T00:00:00`);
  const endDate = new Date(`${endStr}T23:59:59`);
  const isValid = !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate;

  const { data, isPending, isError } = trpc.report.revenueByPeriod.useQuery(
    { startDate, endDate },
    { enabled: isValid }
  );

  const chartData = bucketByDay(data ?? []);
  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);

  const inputClass =
    "h-8 rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary/50";

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold">Revenue Over Time</h2>
          {!isPending && isValid && (
            <p className="text-xs text-muted-foreground">
              {formatCurrencyFull(totalRevenue)} total · {data?.length ?? 0} paid invoice
              {data?.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-muted-foreground">From</label>
          <input
            type="date"
            value={startStr}
            onChange={(e) => setStartStr(e.target.value)}
            className={inputClass}
            aria-label="Revenue chart start date"
          />
          <label className="text-muted-foreground">To</label>
          <input
            type="date"
            value={endStr}
            onChange={(e) => setEndStr(e.target.value)}
            className={inputClass}
            aria-label="Revenue chart end date"
          />
        </div>
      </header>

      <div className="px-4 py-5">
        {!isValid ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            Select a valid date range.
          </div>
        ) : isError ? (
          <div className="flex h-52 items-center justify-center text-sm text-red-400">
            Failed to load revenue data.
          </div>
        ) : isPending ? (
          <div className="flex h-52 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            No paid invoices in this date range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
                }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatCurrencyShort(v)}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "hsl(var(--foreground))",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [formatCurrencyFull(Number(value ?? 0)), "Revenue"]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any) =>
                  new Date(String(label)).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                }
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
