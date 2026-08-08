import type { Metadata } from "next";
import type { ReactNode } from "react";

// Server layout that hosts metadata for the /orders segment — the
// track/page.tsx child is a "use client" component, so `export const
// metadata` on that page would be silently ignored (Scenario 44 / SEO
// Foundation Rule 35). Public utility route: noindex, follow.
export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: true },
};

export default function OrdersLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return children;
}
