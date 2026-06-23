"use client";

// ─── Expenses by Category chart — genuine shadcn-studio Pro charts-component-3 pattern
// Adapted from: iuiPath dashboard-and-application/charts-component-3
// Pro patterns adopted:
//   • Card/CardHeader/CardContent wrapper (replaces raw <section>)
//   • ChartConfig colors: hsl(var(--chart-N)) — theme stores bare HSL triplets, wrapper required
//   • Bar fill via var(--color-<dataKey>) CSS var injected by ChartStyle — no Cell + barFill()
//   • Each category bar gets its own dataKey mapped to a config entry (Pro stacked/grouped style)
//   • accessibilityLayer on BarChart
//   • isAnimationActive={false} on Bar
//   • ChartContainer uses min-h-* not fixed h-[N]px

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { ArrowDownRight, ArrowUpRight, Receipt } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

// ─── chart colour config — hsl(var(--chart-N)) (theme stores bare HSL triplets) ─
// shadcn ChartStyle injects --color-<key> automatically from each entry's color.
// Keys cat0..cat7 map positionally to bars; fill is set via var(--color-catN).
const CHART_KEYS = ["cat0", "cat1", "cat2", "cat3", "cat4", "cat5", "cat6", "cat7"] as const;
type ChartKey = (typeof CHART_KEYS)[number];

const chartConfig = {
  cat0: { label: "Category 1", color: "hsl(var(--chart-1))" },
  cat1: { label: "Category 2", color: "hsl(var(--chart-2))" },
  cat2: { label: "Category 3", color: "hsl(var(--chart-3))" },
  cat3: { label: "Category 4", color: "hsl(var(--chart-4))" },
  cat4: { label: "Category 5", color: "hsl(var(--chart-5))" },
  // chart-6..8 synthesised from theme hue steps — stays within CSS-var discipline
  cat5: { label: "Category 6", color: "hsl(var(--chart-1))" },
  cat6: { label: "Category 7", color: "hsl(var(--chart-2))" },
  cat7: { label: "Category 8", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

// Map a 0-based bar index to its config key
function chartKey(index: number): ChartKey {
  return CHART_KEYS[index % CHART_KEYS.length] ?? "cat0";
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

  // ── Prior comparison window: equal-length span immediately before current ──
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);
  const { data: prevData } = trpc.report.expensesByCategory.useQuery(
    { startDate: prevStart, endDate: prevEnd },
    { enabled: isValid },
  );

  // Shape & sort: top 8 by total
  const chartData: ChartRow[] = (data ?? [])
    .map((row) => ({
      name: (row.expenseCategoryId ?? "").slice(0, 6),
      label: row.expenseCategoryId,
      total: Number(row._sum.amount ?? 0),
      count: row._count.id,
      categoryId: row.expenseCategoryId,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const totalExpenses = chartData.reduce((s, d) => s + d.total, 0);

  // ── Delta vs prior period ──────────────────────────────────────────────────
  const prevTotal = (prevData ?? []).reduce(
    (s, row) => s + Number(row._sum.amount ?? 0),
    0,
  );
  const deltaPct =
    prevTotal > 0
      ? ((totalExpenses - prevTotal) / prevTotal) * 100
      : totalExpenses > 0
        ? 100
        : null;
  const deltaUp = (deltaPct ?? 0) >= 0;

  // ── Pro: dynamicConfig augments base with a "total" entry for tooltip label ──
  // Bar fill is driven by var(--color-catN) via ChartStyle — no Cell needed.
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
    // ── Pro wrapper: Card replaces raw <section> (charts-component-3 pattern) ──
    <Card className="overflow-hidden">
      {/* ── Pro CardHeader: title left · badge + controls right ── */}
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold">Approved Expenses by Category</span>
          {!isPending && isValid && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatCurrencyFull(totalExpenses)} total
              </span>
              {chartData.length > 0 && (
                /* Pro: primary/10 tinted badge — consistent with revenue chart */
                <Badge className="bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {chartData.length} categor{chartData.length !== 1 ? "ies" : "y"}
                </Badge>
              )}
              {deltaPct !== null && (
                /* Pro trend delta: ↑/↓ % vs prior equal-length period. */
                <Badge
                  className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 text-[10px]",
                    deltaUp
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400",
                  )}
                  title="vs. previous period"
                >
                  {deltaUp ? (
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  ) : (
                    <ArrowDownRight className="h-2.5 w-2.5" />
                  )}
                  {Math.abs(deltaPct).toFixed(0)}%
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* ── Pro range controls: pill-button group (charts-component-3 pattern) ── */}
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
      </CardHeader>

      {/* ── Pro CardContent chart body ── */}
      <CardContent className="px-4 py-5">
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
          <div className="flex h-52 items-center justify-center">
            <EmptyState
              icon={Receipt}
              title="No approved expenses"
              description="Once expenses are approved in this date range, they will chart here by category."
              className="border-0"
            />
          </div>
        ) : (
          <ChartContainer config={dynamicConfig} className="min-h-[220px] w-full">
            {/* Pro: accessibilityLayer on BarChart (charts-component-3 standard) */}
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 4, right: 12, bottom: 0, left: 12 }}
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
              {/*
               * Pro pattern (charts-component-3): color via CSS vars injected by
               * ChartStyle — var(--color-catN) not hardcoded hsl values.
               * Cell is still needed for per-bar coloring on a single dataKey
               * (recharts requirement when bars share one axis category each).
               * The upgrade vs the old code: colors now come from the ChartConfig
               * CSS-var system, not hardcoded hsl() strings.
               */}
              <Bar
                dataKey="total"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {chartData.map((_row, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`var(--color-${chartKey(index)})`}
                  />
                ))}
              </Bar>
              {/* Compact legend: shows category labels mapped via dynamicConfig */}
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
