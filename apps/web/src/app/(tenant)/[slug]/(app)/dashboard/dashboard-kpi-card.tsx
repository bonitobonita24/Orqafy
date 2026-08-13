"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card, CardContent } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Separator } from "@/components/ui/separator";

interface DashboardKpiCardProps {
  href: string;
  label: string;
  icon: ReactNode;
  /** Raw numeric value — NumberTicker animates it client-side. */
  valueNumber: number;
  /** Text prefix rendered before the animated number, e.g. "₱". */
  valuePrefix?: string | undefined;
  decimalPlaces?: number;
  sub: string;
  /** Optional accent slot (e.g. a CircularProgress) rendered beside the value. */
  accent?: ReactNode | undefined;
}

/**
 * AdminCN-style statistic card: muted label + icon chip top row, large
 * animated value, separator, badge sub-label. Presentation only — all
 * data is passed in from the server-fetched dashboard query, unchanged.
 */
export function DashboardKpiCard({
  href,
  label,
  icon,
  valueNumber,
  valuePrefix,
  decimalPlaces = 0,
  sub,
  accent,
}: DashboardKpiCardProps) {
  return (
    <Link href={href} className="group">
      <Card className="relative overflow-hidden transition-all group-hover:border-primary/30 group-hover:shadow-xs">
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <BorderBeam
            size={60}
            duration={5}
            colorFrom="var(--primary)"
            colorTo="transparent"
          />
        </div>
        <CardContent className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 transition-colors group-hover:border-primary/20 group-hover:bg-primary/5">
              {icon}
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
              {valuePrefix}
              <NumberTicker value={valueNumber} decimalPlaces={decimalPlaces} />
            </p>
            {accent}
          </div>

          <Separator className="my-2" />
          <Badge
            variant="secondary"
            className="rounded-sm px-2 py-0.5 text-[10px] font-medium"
          >
            {sub}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
