import type { Metadata } from "next";
import { RepairsListClient } from "./repairs-list-client";

// Never indexable — authed customer-portal surface (mirrors layout.tsx's
// fail-closed robots posture; see PortalAppLayout comment).
export const metadata: Metadata = {
  title: "Repairs",
  robots: { index: false, follow: false },
};

export default function PortalRepairsPage() {
  return (
    <div data-fdl="portal-repairs-list" className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Repairs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track the status of your device repairs.
        </p>
      </div>
      <RepairsListClient />
    </div>
  );
}
