import type { Metadata } from "next";
import { OrderDetailClient } from "./order-detail-client";

export const metadata: Metadata = {
  title: "Order Detail",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

// Customer-facing order detail (W3b). Data via trpc.portal.orders.byId —
// throws NOT_FOUND (never FORBIDDEN) for someone else's order, so the
// client component below renders a friendly "not found" state rather than
// crashing (same enumeration-resistant posture as portal.ts's ordersRouter).
export default async function PortalOrderDetailPage({ params }: PageProps): Promise<React.ReactNode> {
  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}
