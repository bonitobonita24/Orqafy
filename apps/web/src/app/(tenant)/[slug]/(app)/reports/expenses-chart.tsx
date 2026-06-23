"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { trpc } from "@/lib/trpc";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";

// ─── chart colour config ──────────────────────────────────────────────────────
// Uses chart-1..5 CSS tokens from globals.css so colours respect the theme.
const CHART_KEYS = ["cat0", "cat1", "cat2", "cat3", "cat4", "cat5", "cat6", "cat7"] as const;

const chartConfig = {
  cat0: { label: "Category 1", color: "hsl(var(--chart-1))" },
  cat1: { label: "Category 2", color: "hsl(var(--chart-2))" },
  cat2: { label: "Category 3", color: "hsl(var(--chart-3))" },
  cat3: { label: "Category 4", color: "hsl(var(--chart-4))" },
  cat4: { label: "Category 5", color: "hsl(var(--chart-5))" },
  cat5: { label: "Category 6", color: "hsl(220, 70%, 55%)" },
  cat6: { label: "Category 7", color: "hsl(250, 70%, 60%)" },
  cat7: { label: "Category 8", color: "hsl(270, 60%, 55%)" },
} satisfies ChartConfig;

// Derive fill colour for a bar index — modulo always stays in bounds
function barFill(index: number): string {
  const key = CHART_KEYS[index % CHART_KEYS.length] ?? "cat0";
  return chartConfig[key].color;
}

// ─── types ────────────────────────────────────────────────────────────────────
interface ChartRow {
  name: string;
  label: string; // full category name for tooltip
  total: number;
  count: number;
  categoryId: string;
}

// ─── preset ranges ────────────────────────────────────────────────────────────
type RangeKey = "mtd" | "30d" | "90d" | "custom";

function firstDayOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d;
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

// ─── component ────────────────────────────────────────────────────────────────
interface ExpensesChartProps {
  slug: string;
}

export function ExpensesChart({ slug: _slug }: ExpensesChartProps) {
  const [activeRange, setActiveRange] = useState<RangeKey>("mtd");
  const [customStart, setCustomStart] = useState(
    toDateInput(firstDayOfMonth()),
  );
  const [customEnd, setCustomEnd] = useState(toDateInput(new Date()));

  const { startDate, endDate } = (() => {
    if (activeRange === "custom") {
      return {
        startDate: new Date(`${customStart}T00:00:00`),
        endDate: new Date(`${customEnd}T23:59:59`),
      };
    }
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start =
      activeRange === "mtd"
        ? firstDayOfMonth()
        : activeRange === "30d"
          ? daysAgo(30)
          : daysAgo(90);
    return { startDate: start, endDate: end };
  })();

  const isValid =
    !isNaN(startDate.getTime()) &&
    !isNaN(endDate.getTime()) &&
    startDate <= endDate;

  const { data, isPending, isError } = trpc.report.expensesByCategory.useQuery(
    { startDate, endDate },
    { enabled: isValid },
  );

  // Shape & sort: top 8 by total
  const chartData: ChartRow[] = (data ?? [])
    .map((row) => ({
      name: (row.expenseCategoryId ?? "").slice(0, 6),
      label: row.expenseCategoryId, // will be enriched when category names are available
      total: Number(row._sum.amount ?? 0),
      count: row._count.id,
      categoryId: row.expenseCategoryId,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const totalExpenses = chartData.reduce((s, d) => s + d.total, 0);

  // Build a per-row chartConfig label so ChartTooltipContent shows the real name
  const dynamicConfig: ChartConfig = {
    ...chartConfig,
    total: { label: "Amount" },
  };

  const PRESETS: { key: RangeKey; label: string }[] = [
    { key: "mtd", label: "MTD" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
  ];

  const inputClass =
    "h-7 rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary/50";

  return (
    <section className="rounded-lg border border-border bg-card">
      {/* ── header ── */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Approved Expenses by Category</h2>
          {!isPending && isValid && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatCurrencyFull(totalExpenses)} total
              </span>
              {chartData.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px]">
                  {chartData.length} categor{chartData.length !== 1 ? "ies" : "y"}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setActiveRange(p.key)}
                className={[
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  activeRange === p.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                aria-pressed={activeRange === p.key}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setActiveRange("custom")}
              className={[
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                activeRange === "custom"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
              aria-pressed={activeRange === "custom"}
            >
              Custom
            </button>
          </div>

          {activeRange === "custom" && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className={inputClass}
                aria-label="Expenses chart start date"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={inputClass}
                aria-label="Expenses chart end date"
              />
            </div>
          )}
        </div>
      </header>

      {/* ── chart body ── */}
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
          <ChartContainer config={dynamicConfig} className="h-[220px] w-full">
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
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={56}
                tickFormatter={(v: number) => formatCurrencyShort(v)}
              />
              <ChartTooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => {
                      const row = item.payload as ChartRow | undefined;
                      const amount = formatCurrencyFull(Number(value ?? 0));
                      const records = row?.count ?? 0;
                      return `${amount} (${records} record${records !== 1 ? "s" : ""})`;
                    }}
                    labelFormatter={(_label, payload) => {
                      const row = payload?.[0]?.payload as ChartRow | undefined;
                      return row?.label ?? String(_label);
                    }}
                    indicator="dot"
                  />
                }
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {chartData.map((_row, index) => (
                  <Cell key={`cell-${index}`} fill={barFill(index)} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </section>
  );
}
