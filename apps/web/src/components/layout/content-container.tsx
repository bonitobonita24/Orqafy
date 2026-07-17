"use client";

import { usePathname } from "next/navigation";

/**
 * Design-defaults Entry 1: readable/dense content sits in a centered max-width
 * container with a mobile-first responsive gutter (never full-bleed on wide
 * monitors, never edge-touching on mobile). Immersive point-of-work / full-bleed
 * routes (Entry 1 exemption) opt OUT of the max-width cap via the allowlist below.
 */
const IMMERSIVE_PATTERNS: RegExp[] = [
  /\/pos\/new-sale(\/|$)/, // POS register (two-pane Add Products | Cart) — wants full width
];

export function ContentContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fluid = IMMERSIVE_PATTERNS.some((re) => re.test(pathname));
  return (
    <div
      className={
        fluid
          ? "w-full px-4 sm:px-6 lg:px-8"
          : "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
      }
    >
      {children}
    </div>
  );
}
