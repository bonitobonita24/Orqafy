"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

interface PromoCountdownProps {
  endsAt: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeTimeLeft(endsAt: string): TimeLeft {
  const diffMs = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const totalSeconds = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(num: number): string {
  return String(num).padStart(2, "0");
}

const UNITS: { key: keyof TimeLeft; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sec" },
];

/**
 * Client-hydrated countdown to a REAL MerchContent.endsAt timestamp (never a
 * hardcoded time, unlike the Shopix reference deals-promotional-card.tsx
 * which fakes a 1d12h45m2s countdown from mount). Skeleton until hydrated to
 * avoid an SSR/client time mismatch.
 */
export function PromoCountdown({ endsAt }: PromoCountdownProps): React.ReactNode {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => computeTimeLeft(endsAt));

  useEffect(() => {
    setMounted(true);
    setTimeLeft(computeTimeLeft(endsAt));
    const timer = setInterval(() => {
      setTimeLeft(computeTimeLeft(endsAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (!mounted) {
    return (
      <div className="flex gap-2">
        {UNITS.map((unit) => (
          <Skeleton key={unit.key} className="size-9.75 rounded-sm xl:size-13.75" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {UNITS.map((unit) => (
        <div key={unit.key} className="flex flex-col items-center gap-1.25">
          <div className="flex size-9.75 items-center justify-center rounded-sm bg-white p-1.5 text-lg font-semibold text-foreground xl:size-13.75">
            {pad(timeLeft[unit.key])}
          </div>
          <span className="text-xs font-medium">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}
