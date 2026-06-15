"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { trpc } from "@/lib/trpc";

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(1); // first day of current month
  start.setHours(0, 0, 0, 0);
  return { start, end };
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

// Palette — cycles through teal/blue tones that suit the dark theme
const BAR_COLORS = [
  "hsl(var(--primary))",
  "hsl(175, 70%, 45%)",
  "hsl(200, 70%, 50%)",
  "hsl(220, 70%, 55%)",
  "hsl(250, 70%, 60%)",
  "hsl(270, 60%, 55%)",
];

interface ChartRow {
  name: string; // truncated category id for x-axis label
  total: number;
  count: number;
  categoryId: string;
}

interface ExpensesChartProps {
  slug: string;
}

export function ExpensesChart({ slug: _slug }: ExpensesChartProps) {
  const defaults = defaultRange();
  const [startStr, setStartStr] = useState(toDateInput(defaults.start));
  const [endStr, setEndStr] = useState(toDateInput(defaults.end));

  const startDate = new Date(`${startStr}T00:00:00`);
  const endDate = new Date(`${endStr}T23:59:59`);
  const isValid =
    !isNaN(startDate.getTime()) &&
    !isNaN(endDate.getTime()) &&
    startDate <= endDate;

  const { data, isPending, isError } = trpc.report.expensesByCategory.useQuery(
    { startDate, endDate },
    { enabled: isValid }
  );

  // groupBy returns: { expenseCategoryId, _sum: { amount }, _count: { id } }
  const chartData: ChartRow[] = (data ?? [])
    .map((row) => ({
      name: row.expenseCategoryId.slice(0, 8),
      total: Number(row._sum.amount ?? 0),
      count: row._count.id,
      categoryId: row.expenseCategoryId,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const totalExpenses = chartData.reduce((s, d) => s + d.total, 0);

  const inputClass =
    "h-8 rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary/50";

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold">Approved Expenses by Category</h2>
          {!isPending && isValid && (
            <p className="text-xs text-muted-foreground">
              {formatCurrencyFull(totalExpenses)} total · {chartData.length}{" "}
              categor{chartData.length !== 1 ? "ies" : "y"}
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
            aria-label="Expenses chart start date"
          />
          <label className="text-muted-foreground">To</label>
          <input
            type="date"
            value={endStr}
            onChange={(e) => setEndStr(e.target.value)}
            className={inputClass}
            aria-label="Expenses chart end date"
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
            Failed to load expense data.
          </div>
        ) : isPending ? (
          <div className="flex h-52 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            No approved expenses in this date range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
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
                formatter={(value: any, _name: any, props: any) => [
                  `${formatCurrencyFull(Number(value ?? 0))} (${(props.payload as ChartRow | undefined)?.count ?? 0} records)`,
                  "Approved",
                ]}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {chartData.map((_row, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAR_COLORS[index % BAR_COLORS.length] ?? "hsl(var(--primary))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
