import type { Metadata } from "next";
import { RepairDetailClient } from "./repair-detail-client";

// Never indexable — authed customer-portal surface (mirrors layout.tsx's
// fail-closed robots posture; see PortalAppLayout comment).
export const metadata: Metadata = {
  title: "Repair Detail",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function PortalRepairDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  return (
    <div data-fdl="portal-repair-detail">
      <RepairDetailClient slug={slug} id={id} />
    </div>
  );
}
