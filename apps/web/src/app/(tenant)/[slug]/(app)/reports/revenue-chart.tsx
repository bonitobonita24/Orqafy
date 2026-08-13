"use client";

// ─── Revenue Over Time chart — genuine shadcn-studio Pro charts-component-2 pattern
// Adapted from: iuiPath dashboard-and-application/charts-component-2
// Pro patterns adopted:
//   • Card/CardHeader/CardContent wrapper (replaces raw <section>)
//   • ChartConfig colors: hsl(var(--chart-N)) — THIS app's theme stores --chart-N
//     as bare HSL triplets (globals.css), so the hsl() wrapper is REQUIRED. (The
//     shadcn-studio Pro source omits it only because its theme stores full colors.)
//   • linearGradient: stopOpacity 0.4/0.05 (Pro values, not 0.3/0.02)
//   • Area: isAnimationActive={false} + accessibilityLayer on AreaChart
//   • Underline-tab style for range selector: border-b-2 + data-[state=active]:border-primary
//   • Unique gradient id "revenueGradOrqafy" (avoid collision if multiple charts on page)

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartColumnIncreasing,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

// ─── chart colour config — hsl(var(--chart-N)) (theme stores bare HSL triplets)
// shadcn ChartStyle injects --color-revenue automatically from this config
const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

// ─── preset ranges ────────────────────────────────────────────────────────────
type RangeKey = "7d" | "30d" | "90d" | "custom";

const RANGE_PRESETS: { key: RangeKey; label: string; days: number }[] = [
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
];

function rangeFromDays(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── formatters ───────────────────────────────────────────────────────────────
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

// ─── bucket paid invoices into daily data points ──────────────────────────────
function bucketByDay(
  invoices: Array<{ paidAt: Date | null; totalAmount: unknown }>,
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

// ─── component ────────────────────────────────────────────────────────────────
interface RevenueChartProps {
  slug: string;
}

export function RevenueChart({ slug: _slug }: RevenueChartProps) {
  const [activeRange, setActiveRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState(
    toDateInput(rangeFromDays(30).start),
  );
  const [customEnd, setCustomEnd] = useState(toDateInput(new Date()));

  // Derive dates from either a preset or custom range
  const { startDate, endDate } = (() => {
    if (activeRange === "custom") {
      return {
        startDate: new Date(`${customStart}T00:00:00`),
        endDate: new Date(`${customEnd}T23:59:59`),
      };
    }
    const preset = RANGE_PRESETS.find((p) => p.key === activeRange)!;
    const r = rangeFromDays(preset.days);
    return { startDate: r.start, endDate: r.end };
  })();

  const isValid =
    !isNaN(startDate.getTime()) &&
    !isNaN(endDate.getTime()) &&
    startDate <= endDate;

  const { data, isPending, isError } = trpc.report.revenueByPeriod.useQuery(
    { startDate, endDate },
    { enabled: isValid },
  );

  // ── Prior comparison window: the equal-length span immediately before the
  // current one, so the header can show a trend delta (Pro charts-component
  // pattern: metric + ↑/↓ vs previous period).
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);
  const { data: prevData } = trpc.report.revenueByPeriod.useQuery(
    { startDate: prevStart, endDate: prevEnd },
    { enabled: isValid },
  );

  const chartData = bucketByDay(data ?? []);
  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);
  const invoiceCount = data?.length ?? 0;

  // Delta vs prior period. null = no comparable baseline (don't show a badge).
  const prevTotal = (prevData ?? []).reduce(
    (s, inv) => s + Number(inv.totalAmount ?? 0),
    0,
  );
  const deltaPct =
    prevTotal > 0
      ? ((totalRevenue - prevTotal) / prevTotal) * 100
      : totalRevenue > 0
        ? 100
        : null;
  const deltaUp = (deltaPct ?? 0) >= 0;

  const inputClass =
    "h-7 rounded-md border border-border bg-background px-2.5 text-xs outline-hidden focus:border-primary/50";

  return (
    // ── Pro wrapper: Card replaces raw <section> (charts-component-2 pattern)
    <Card className="overflow-hidden">
      {/* ── Pro CardHeader: title left · badge + controls right ── */}
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold">Revenue Over Time</span>
          {!isPending && isValid && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatCurrencyFull(totalRevenue)} total
              </span>
              {invoiceCount > 0 && (
                /* Pro: primary/10 tinted badge — not variant="secondary" */
                <Badge className="flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {invoiceCount} invoice{invoiceCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {deltaPct !== null && (
                /* Pro trend delta: ↑/↓ % vs the prior equal-length period. */
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

        {/* ── Pro range controls: pill-button group (charts-component-2 pattern) ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => setActiveRange(preset.key)}
                className={[
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  activeRange === preset.key
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                aria-pressed={activeRange === preset.key}
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => setActiveRange("custom")}
              className={[
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                activeRange === "custom"
                  ? "bg-background text-foreground shadow-xs"
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
                aria-label="Revenue chart start date"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={inputClass}
                aria-label="Revenue chart end date"
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
            Failed to load revenue data.
          </div>
        ) : isPending ? (
          <div className="flex h-52 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-52 items-center justify-center">
            <EmptyState
              icon={ChartColumnIncreasing}
              title="No paid invoices yet"
              description="Once invoices are marked paid in this date range, revenue will chart here."
              className="border-0"
            />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
            {/* Pro: accessibilityLayer on AreaChart (charts-component-2 standard) */}
            <AreaChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 4, right: 12, bottom: 0, left: 12 }}
            >
              <defs>
                {/* Pro gradient: stopOpacity 0.4/0.05 (genuine Pro values) */}
                <linearGradient id="revenueGradOrqafy" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-revenue)"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-revenue)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v: string) =>
                  new Date(v).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={56}
                tickFormatter={(v: number) => formatCurrencyShort(v)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      formatCurrencyFull(Number(value ?? 0))
                    }
                    labelFormatter={(label) =>
                      new Date(String(label)).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    }
                    indicator="line"
                  />
                }
              />
              {/* Pro: isAnimationActive={false} — no mount animation (performance) */}
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                fill="url(#revenueGradOrqafy)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
