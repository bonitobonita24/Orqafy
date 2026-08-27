import type { Metadata } from "next";
import { OrdersListClient } from "./orders-list-client";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

// Customer-facing order history list (W3b). Data fetched client-side via
// trpc.portal.orders.list (customer-scoped by portalProcedure's ctx — see
// server/trpc/routers/portal.ts). Renders inside the (portal-app) shell.
export default function PortalOrdersPage(): React.ReactNode {
  return <OrdersListClient />;
}
